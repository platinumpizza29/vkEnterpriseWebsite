"use client";

import { createSortedRowModel, rowSortingFeature, sortFns, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { AlertDialog, Dialog } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSites, type SiteOption } from "@/hooks/use-sites";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import { formatDate } from "@/lib/factory-data";

const siteFeatures = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns });
type SiteForm = { name: string; code: string; latitude: string; longitude: string; address: string };
const emptySiteForm: SiteForm = { name: "", code: "", latitude: "", longitude: "", address: "" };

function toOptionalNumber(input: string) { return input.trim() === "" ? null : Number(input); }

function SiteFields({ value, onChange, idPrefix }: { value: SiteForm; onChange: (value: SiteForm) => void; idPrefix: string }) {
  const update = (key: keyof SiteForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [key]: event.target.value });
  return <div className="admin-form-grid"><label className="admin-form-field admin-form-field--full" htmlFor={`${idPrefix}-name`}>Name<input id={`${idPrefix}-name`} value={value.name} onChange={update("name")} required maxLength={120} /></label><label className="admin-form-field" htmlFor={`${idPrefix}-code`}>Code<input id={`${idPrefix}-code`} value={value.code} onChange={update("code")} required maxLength={32} /></label><label className="admin-form-field" htmlFor={`${idPrefix}-address`}>Address<input id={`${idPrefix}-address`} value={value.address} onChange={update("address")} /></label><label className="admin-form-field" htmlFor={`${idPrefix}-latitude`}>Latitude<input id={`${idPrefix}-latitude`} type="number" step="any" value={value.latitude} onChange={update("latitude")} /></label><label className="admin-form-field" htmlFor={`${idPrefix}-longitude`}>Longitude<input id={`${idPrefix}-longitude`} type="number" step="any" value={value.longitude} onChange={update("longitude")} /></label></div>;
}

function SiteFormFromSite(site: SiteOption): SiteForm {
  return { name: site.name, code: site.code ?? "", latitude: site.latitude == null ? "" : String(site.latitude), longitude: site.longitude == null ? "" : String(site.longitude), address: site.address ?? "" };
}

function SiteDetails({ site }: { site: SiteOption }) {
  return <dl className="admin-record-details"><div><dt>Name</dt><dd>{site.name}</dd></div><div><dt>Code</dt><dd>{site.code || "—"}</dd></div><div><dt>Hub site</dt><dd>{site.is_hub ? <span className="hub-pill">HUB</span> : "No"}</dd></div><div><dt>Status</dt><dd><span className={`admin-status-pill ${site.is_active ? "is-active" : "is-inactive"}`}>{site.is_active ? "Active" : "Inactive"}</span></dd></div><div><dt>Address</dt><dd>{site.address || "—"}</dd></div><div><dt>Latitude</dt><dd>{site.latitude ?? "—"}</dd></div><div><dt>Longitude</dt><dd>{site.longitude ?? "—"}</dd></div><div><dt>Created</dt><dd>{formatDate(site.created_at ?? "")}</dd></div><div><dt>Updated</dt><dd>{formatDate(site.updated_at ?? "")}</dd></div></dl>;
}

export default function AdminSitesPage() {
  const session = useDashboardSession();
  const queryClient = useQueryClient();
  const sitesQuery = useSites();
  const sites = sitesQuery.data ?? [];
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SiteForm>(emptySiteForm);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<SiteForm>(emptySiteForm);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const selectedSite = sites.find((site) => site.id === selectedSiteId);

  const invalidateSites = () => queryClient.invalidateQueries({ queryKey: ["sites"] });
  const createMutation = useMutation({ mutationFn: () => apiPost("/sites", session!.token, { name: createForm.name.trim(), code: createForm.code.trim(), latitude: toOptionalNumber(createForm.latitude), longitude: toOptionalNumber(createForm.longitude), address: createForm.address.trim() }), onSuccess: async () => { await invalidateSites(); setCreateOpen(false); setCreateForm(emptySiteForm); toast.success("Site created"); } });
  const updateMutation = useMutation({ mutationFn: () => apiPut(`/sites/${encodeURIComponent(selectedSite!.id)}`, session!.token, { name: editForm.name.trim(), code: editForm.code.trim(), latitude: toOptionalNumber(editForm.latitude), longitude: toOptionalNumber(editForm.longitude), address: editForm.address.trim(), is_hub: selectedSite!.is_hub }), onSuccess: async () => { await invalidateSites(); setEditing(false); toast.success("Site updated"); } });
  const deactivateMutation = useMutation({ mutationFn: () => apiDelete(`/sites/${encodeURIComponent(selectedSite!.id)}`, session!.token), onSuccess: async () => { await invalidateSites(); setConfirmDeactivate(false); setSelectedSiteId(""); setEditing(false); toast.success("Site deactivated"); } });

  const columns: Array<ColumnDef<typeof siteFeatures, SiteOption>> = useMemo(() => [
    { id: "name", accessorFn: (site) => site.name, header: "Name", cell: (info) => <strong className="admin-table-primary">{info.row.original.name}</strong> },
    { id: "code", accessorFn: (site) => site.code ?? "", header: "Code", cell: (info) => <span className="admin-table-muted">{info.row.original.code || "—"}</span> },
    { id: "hub", accessorFn: (site) => site.is_hub, header: "Hub", cell: (info) => info.row.original.is_hub ? <span className="hub-pill">HUB</span> : <span className="admin-table-muted">—</span> },
    { id: "status", accessorFn: (site) => site.is_active, header: "Status", cell: (info) => <span className={`admin-status-pill ${info.row.original.is_active ? "is-active" : "is-inactive"}`}>{info.row.original.is_active ? "Active" : "Inactive"}</span> },
    { id: "address", accessorFn: (site) => site.address ?? "", header: "Address", cell: (info) => <span className="admin-address-cell">{info.row.original.address || "—"}</span> },
  ], []);
  const table = useTable({ features: siteFeatures, columns, data: sites });

  if (session?.role !== "admin") return <div className="admin-management-page"><Alert variant="destructive">Administrator access is required to manage sites.</Alert></div>;

  return <div className="admin-management-page">
    <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">ADMIN / ORGANIZATION</div><h1>Sites</h1><p>Manage locations and hub configuration across your organization.</p></div><button className="factory-primary-button" type="button" onClick={() => { setCreateForm(emptySiteForm); createMutation.reset(); setCreateOpen(true); }}>＋ Add Site</button></div>
    {sitesQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Sites could not be loaded: {sitesQuery.error.message}<button type="button" onClick={() => void sitesQuery.refetch()}>Retry</button></Alert>}
    {createMutation.isError && !createOpen && <Alert variant="destructive" className="factory-stock-alert">Site could not be created: {createMutation.error.message}</Alert>}
    <Card className="factory-stock-card"><CardContent className="factory-stock-card__content"><div className="factory-stock-toolbar"><div className="factory-stock-toolbar__copy"><h2>Organization sites</h2><p>{sites.length} {sites.length === 1 ? "site" : "sites"}</p></div></div>{sitesQuery.isLoading ? <div className="admin-table-skeleton">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} />)}</div> : <div className="stock-table-scroll"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id} className="stock-clickable-row" tabIndex={0} onClick={() => { setSelectedSiteId(row.original.id); setEditing(false); setEditForm(SiteFormFromSite(row.original)); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedSiteId(row.original.id); setEditing(false); setEditForm(SiteFormFromSite(row.original)); } }}>{row.getAllCells().map((cell) => <TableCell key={cell.id}><table.FlexRender cell={cell} /></TableCell>)}</TableRow>)}{!sites.length && !sitesQuery.isError && <TableRow><TableCell colSpan={5} className="stock-empty-cell">No sites have been added.</TableCell></TableRow>}</TableBody></Table></div>}</CardContent></Card>

    <Dialog open={createOpen} onOpenChange={setCreateOpen} title="Add a site" description="Enter the location details for this organization." className="admin-form-dialog"><form onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}><SiteFields value={createForm} onChange={setCreateForm} idPrefix="create-site" />{createMutation.isError && <Alert variant="destructive" className="admin-form-error">Site could not be created: {createMutation.error.message}</Alert>}<div className="admin-form-actions"><button className="factory-secondary-button" type="button" onClick={() => setCreateOpen(false)}>Cancel</button><button className="factory-primary-button" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating…" : "Create site"}</button></div></form></Dialog>

    <Sheet open={Boolean(selectedSite)} onOpenChange={(open) => { if (!open) { setSelectedSiteId(""); setEditing(false); } }} title={selectedSite?.name ?? "Site details"} description={selectedSite?.code ? `Site code ${selectedSite.code}` : "Organization site details"}>
      {selectedSite && <>{editing ? <form className="admin-edit-form" onSubmit={(event) => { event.preventDefault(); updateMutation.mutate(); }}><SiteFields value={editForm} onChange={setEditForm} idPrefix="edit-site" />{updateMutation.isError && <Alert variant="destructive" className="admin-form-error">Site could not be updated: {updateMutation.error.message}</Alert>}<div className="admin-form-actions"><button className="factory-secondary-button" type="button" onClick={() => { setEditing(false); setEditForm(SiteFormFromSite(selectedSite)); }}>Cancel edit</button><button className="factory-primary-button" type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving…" : "Save changes"}</button></div></form> : <><SiteDetails site={selectedSite} /><div className="admin-drawer-actions"><button className="factory-primary-button" type="button" onClick={() => { setEditForm(SiteFormFromSite(selectedSite)); updateMutation.reset(); setEditing(true); }}>Edit site</button></div></>}
        {selectedSite.is_active && <div className="admin-deactivate-section"><div><strong>Deactivate site</strong><p>Inactive sites remain in records but cannot be used for new operations.</p></div><button className="destructive-button" type="button" onClick={() => { deactivateMutation.reset(); setConfirmDeactivate(true); }}>Deactivate Site</button>{deactivateMutation.isError && <Alert variant="destructive" className="admin-form-error">Could not deactivate site: {deactivateMutation.error.message}</Alert>}</div>}
      </>}
    </Sheet>
    <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate} title="Deactivate this site?" description={`“${selectedSite?.name ?? "This site"}” will be marked inactive. Existing records will remain available.`} confirmLabel="Deactivate site" pending={deactivateMutation.isPending} error={deactivateMutation.isError ? deactivateMutation.error.message : undefined} onConfirm={() => deactivateMutation.mutate()} />
  </div>;
}
