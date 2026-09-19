"use client";

import { createSortedRowModel, rowSortingFeature, sortFns, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { AlertDialog, Dialog } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSites } from "@/hooks/use-sites";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { formatDate, records, value } from "@/lib/factory-data";

const userFeatures = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns });
const roles = ["admin", "manager", "factory_manager", "site_engineer"] as const;
type Role = typeof roles[number];
type UserRecord = { id: string; name: string; email: string; role: Role | string; siteId: string; status: string; createdAt: string; isActive: boolean };
type UserForm = { name: string; email: string; password: string; role: Role; siteId: string };
const emptyForm: UserForm = { name: "", email: "", password: "", role: "site_engineer", siteId: "" };
const EMPTY_USERS: UserRecord[] = [];
const EMPTY_SITES: { id: string; name: string; is_active?: boolean }[] = [];

function normalizeUser(user: Record<string, unknown>): UserRecord {
  const active = user.is_active ?? user.IsActive;
  return {
    id: String(value(user, "id", "ID") ?? ""),
    name: String(value(user, "name", "Name") ?? "Unknown user"),
    email: String(value(user, "email", "Email") ?? ""),
    role: String(value(user, "role", "Role") ?? "site_engineer"),
    siteId: String(value(user, "site_id", "SiteID", "siteId") ?? ""),
    status: active === false ? "Inactive" : "Active",
    createdAt: String(value(user, "created_at", "CreatedAt") ?? ""),
    isActive: active !== false,
  };
}

function roleLabel(role: string) { return role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function UserDetails({ user, siteName }: { user: UserRecord; siteName: string }) {
  return <dl className="admin-record-details"><div><dt>User ID</dt><dd>{user.id}</dd></div><div><dt>Name</dt><dd>{user.name}</dd></div><div><dt>Email</dt><dd>{user.email || "—"}</dd></div><div><dt>Role</dt><dd><span className={`role-badge role-badge--${user.role}`}>{roleLabel(user.role)}</span></dd></div><div><dt>Site</dt><dd>{user.siteId ? siteName : "—"}</dd></div><div><dt>Status</dt><dd><span className={`admin-status-pill ${user.isActive ? "is-active" : "is-inactive"}`}>{user.status}</span></dd></div><div><dt>Created</dt><dd>{formatDate(user.createdAt)}</dd></div></dl>;
}

export default function AdminUsersPage() {
  const session = useDashboardSession();
  const queryClient = useQueryClient();
  const sitesQuery = useSites();
  const [roleFilter, setRoleFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<UserForm>(emptyForm);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<UserForm>(emptyForm);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const queryClientPrefix = ["admin-users"];
  const usersQuery = useQuery({ queryKey: [...queryClientPrefix, roleFilter], queryFn: async () => { const suffix = roleFilter === "all" ? "" : `?role=${encodeURIComponent(roleFilter)}`; return records(await apiGet<unknown>(`/users${suffix}`, session!.token)).map(normalizeUser).filter((user) => user.id); }, enabled: Boolean(session?.token && session?.role === "admin"), staleTime: 60_000, retry: false });
  const users = usersQuery.data ?? EMPTY_USERS;
  const selectedFromList = users.find((user) => user.id === selectedId);
  const detailQuery = useQuery({ queryKey: ["admin-user", selectedId], queryFn: async () => normalizeUser(await apiGet<Record<string, unknown>>(`/users/${encodeURIComponent(selectedId)}`, session!.token)), enabled: Boolean(session?.token && selectedId), staleTime: 60_000, retry: false });
  const selectedUser = detailQuery.data ?? selectedFromList;
  const sites = sitesQuery.data ?? EMPTY_SITES;
  const siteMap = useMemo(() => new Map(sites.map((site) => [site.id, site.name])), [sites]);
  const currentUserId = session && "id" in session ? String((session as typeof session & { id?: string }).id ?? "") : "";
  const isCurrentUser = Boolean(selectedUser && (selectedUser.id === currentUserId || (session?.email && selectedUser.email.toLowerCase() === session.email.toLowerCase())));

  const invalidateUsers = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: queryClientPrefix }), queryClient.invalidateQueries({ queryKey: ["admin-user"] }), queryClient.invalidateQueries({ queryKey: ["admin-dashboard", "users"] })]); };
  const createMutation = useMutation({ mutationFn: () => apiPost("/register", session!.token, { name: addForm.name.trim(), email: addForm.email.trim(), password: addForm.password, role: addForm.role, site_id: addForm.role === "site_engineer" ? addForm.siteId : null }), onSuccess: async () => { await invalidateUsers(); setAddOpen(false); setAddForm(emptyForm); toast.success("User created"); } });
  const updateMutation = useMutation({ mutationFn: () => apiPut(`/users/${encodeURIComponent(selectedUser!.id)}`, session!.token, { name: editForm.name.trim(), role: editForm.role, site_id: editForm.role === "site_engineer" ? editForm.siteId : null }), onSuccess: async () => { await invalidateUsers(); setEditing(false); toast.success("User updated"); } });
  const deactivateMutation = useMutation({ mutationFn: () => apiDelete(`/users/${encodeURIComponent(selectedUser!.id)}`, session!.token), onSuccess: async () => { await invalidateUsers(); setConfirmDeactivate(false); setSelectedId(""); setEditing(false); toast.success("User deactivated"); } });

  const columns: Array<ColumnDef<typeof userFeatures, UserRecord>> = useMemo(() => [
    { id: "name", accessorFn: (user) => user.name, header: "Name", cell: (info) => <strong className="admin-table-primary">{info.row.original.name}</strong> },
    { id: "email", accessorFn: (user) => user.email, header: "Email", cell: (info) => <span className="admin-table-muted">{info.row.original.email || "—"}</span> },
    { id: "role", accessorFn: (user) => user.role, header: "Role", cell: (info) => <span className={`role-badge role-badge--${info.row.original.role}`}>{roleLabel(info.row.original.role)}</span> },
    { id: "site", accessorFn: (user) => siteMap.get(user.siteId) ?? "", header: "Site", cell: (info) => <span className="admin-table-muted">{info.row.original.siteId ? siteMap.get(info.row.original.siteId) ?? "Unknown site" : "—"}</span> },
    { id: "status", accessorFn: (user) => user.isActive, header: "Status", cell: (info) => <span className={`admin-status-pill ${info.row.original.isActive ? "is-active" : "is-inactive"}`}>{info.row.original.status}</span> },
  ], [siteMap]);
  const table = useTable({ features: userFeatures, columns, data: users });

  const selectUser = (user: UserRecord) => { setSelectedId(user.id); setEditing(false); setEditForm({ name: user.name, email: user.email, password: "", role: roles.includes(user.role as Role) ? user.role as Role : "site_engineer", siteId: user.siteId }); };
  const renderForm = (form: UserForm, setForm: (value: UserForm) => void, idPrefix: string, includePassword?: boolean) => <div className="admin-form-grid"><label className="admin-form-field admin-form-field--full" htmlFor={`${idPrefix}-name`}>Name<input id={`${idPrefix}-name`} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={120} /></label><label className="admin-form-field admin-form-field--full" htmlFor={`${idPrefix}-email`}>Email<input id={`${idPrefix}-email`} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required disabled={!includePassword} /></label>{includePassword && <label className="admin-form-field admin-form-field--full" htmlFor={`${idPrefix}-password`}>Password<input id={`${idPrefix}-password`} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} autoComplete="new-password" /></label>}<label className="admin-form-field admin-form-field--full" htmlFor={`${idPrefix}-role`}>Role<select id={`${idPrefix}-role`} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role, siteId: event.target.value === "site_engineer" ? form.siteId : "" })}>{roles.map((role) => <option value={role} key={role}>{roleLabel(role)}</option>)}</select></label>{form.role === "site_engineer" && <label className="admin-form-field admin-form-field--full" htmlFor={`${idPrefix}-site`}>Site<select id={`${idPrefix}-site`} value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })} required><option value="">Select a site</option>{sites.map((site) => <option value={site.id} key={site.id}>{site.name}{!site.is_active ? " (Inactive)" : ""}</option>)}</select></label>}</div>;

  if (session?.role !== "admin") return <div className="admin-management-page"><Alert variant="destructive">Administrator access is required to manage users.</Alert></div>;

  return <div className="admin-management-page">
    <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">ADMIN / ACCESS CONTROL</div><h1>Users</h1><p>Manage accounts, roles, and site assignments.</p></div><button className="factory-primary-button" type="button" onClick={() => { setAddForm(emptyForm); createMutation.reset(); setAddOpen(true); }}>＋ Add User</button></div>
    <div className="admin-table-controls"><label className="ticket-filter"><span>Role</span><select aria-label="Filter users by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">All roles</option>{roles.map((role) => <option value={role} key={role}>{roleLabel(role)}</option>)}</select></label></div>
    {usersQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Users could not be loaded: {usersQuery.error.message}<button type="button" onClick={() => void usersQuery.refetch()}>Retry</button></Alert>}
    {sitesQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Sites could not be loaded: {sitesQuery.error.message}</Alert>}
    <Card className="factory-stock-card"><CardContent className="factory-stock-card__content"><div className="factory-stock-toolbar"><div className="factory-stock-toolbar__copy"><h2>Organization users</h2><p>{users.length} {users.length === 1 ? "user" : "users"}</p></div></div>{usersQuery.isLoading ? <div className="admin-table-skeleton">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} />)}</div> : <div className="stock-table-scroll"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id} className="stock-clickable-row" tabIndex={0} onClick={() => selectUser(row.original)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectUser(row.original); } }}>{row.getAllCells().map((cell) => <TableCell key={cell.id}><table.FlexRender cell={cell} /></TableCell>)}</TableRow>)}{!users.length && !usersQuery.isError && <TableRow><TableCell colSpan={5} className="stock-empty-cell">No users match this role.</TableCell></TableRow>}</TableBody></Table></div>}</CardContent></Card>

    <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add a user" description="Create an account and assign its workspace role." className="admin-form-dialog"><form onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>{renderForm(addForm, setAddForm, "add-user", true)}{addForm.role === "site_engineer" && !sites.length && <p className="admin-form-help">Create a site before assigning a Site Engineer.</p>}{createMutation.isError && <Alert variant="destructive" className="admin-form-error">User could not be created: {createMutation.error.message}</Alert>}<div className="admin-form-actions"><button className="factory-secondary-button" type="button" onClick={() => setAddOpen(false)}>Cancel</button><button className="factory-primary-button" type="submit" disabled={createMutation.isPending || (addForm.role === "site_engineer" && !addForm.siteId)}>{createMutation.isPending ? "Creating…" : "Create user"}</button></div></form></Dialog>

    <Sheet open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) { setSelectedId(""); setEditing(false); } }} title={selectedUser?.name ?? "User details"} description={selectedUser?.email}>
      {detailQuery.isLoading ? <div className="factory-data-skeleton"><Skeleton /><Skeleton /><Skeleton /></div> : detailQuery.isError ? <Alert variant="destructive">User details could not be loaded: {detailQuery.error.message}</Alert> : selectedUser && <>{editing ? <form className="admin-edit-form" onSubmit={(event) => { event.preventDefault(); updateMutation.mutate(); }}>{renderForm(editForm, setEditForm, "edit-user")}{editForm.role === "site_engineer" && !editForm.siteId && <p className="admin-form-help">A site is required for a Site Engineer.</p>}{updateMutation.isError && <Alert variant="destructive" className="admin-form-error">User could not be updated: {updateMutation.error.message}</Alert>}<div className="admin-form-actions"><button className="factory-secondary-button" type="button" onClick={() => setEditing(false)}>Cancel edit</button><button className="factory-primary-button" type="submit" disabled={updateMutation.isPending || (editForm.role === "site_engineer" && !editForm.siteId)}>{updateMutation.isPending ? "Saving…" : "Save changes"}</button></div></form> : <><UserDetails user={selectedUser} siteName={siteMap.get(selectedUser.siteId) ?? "Unknown site"} /><div className="admin-drawer-actions"><button className="factory-primary-button" type="button" onClick={() => { setEditForm({ name: selectedUser.name, email: selectedUser.email, password: "", role: roles.includes(selectedUser.role as Role) ? selectedUser.role as Role : "site_engineer", siteId: selectedUser.siteId }); updateMutation.reset(); setEditing(true); }}>Edit user</button></div></>}
        {selectedUser.isActive && <div className="admin-deactivate-section"><div><strong>Deactivate user</strong><p>This user will no longer be able to sign in.</p></div><span title={isCurrentUser ? "You cannot deactivate your own account." : undefined}><button className="destructive-button" type="button" disabled={isCurrentUser} onClick={() => { deactivateMutation.reset(); setConfirmDeactivate(true); }}>Deactivate User</button></span>{deactivateMutation.isError && <Alert variant="destructive" className="admin-form-error">Could not deactivate user: {deactivateMutation.error.message}</Alert>}</div>}
      </>}
    </Sheet>
    <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate} title="Deactivate this user?" description={`“${selectedUser?.name ?? "This user"}” will be marked inactive and will no longer be able to sign in.`} confirmLabel="Deactivate user" pending={deactivateMutation.isPending} error={deactivateMutation.isError ? deactivateMutation.error.message : undefined} onConfirm={() => deactivateMutation.mutate()} />
  </div>;
}
