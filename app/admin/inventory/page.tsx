"use client";

import Link from "next/link";
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
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { records, value } from "@/lib/factory-data";

const inventoryFeatures = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns });
type CatalogItem = { id: string; name: string; code: string; unit: string; category: string; threshold: number | null; isActive: boolean };
type CatalogForm = { name: string; code: string; unit: string; category: string; threshold: string };
const emptyForm: CatalogForm = { name: "", code: "", unit: "", category: "", threshold: "" };
const EMPTY_ITEMS: CatalogItem[] = [];

function normalizeCatalogItem(item: Record<string, unknown>): CatalogItem {
  const threshold = value(item, "ReorderThreshold", "reorder_threshold", "reorderThreshold");
  return {
    id: String(value(item, "ID", "id") ?? ""),
    name: String(value(item, "Name", "name") ?? "Unknown item"),
    code: String(value(item, "Code", "code") ?? ""),
    unit: String(value(item, "Unit", "unit") ?? ""),
    category: String(value(item, "Category", "category") ?? ""),
    threshold: threshold == null ? null : Number(threshold),
    isActive: (value(item, "IsActive", "is_active") ?? true) !== false,
  };
}

function CatalogFormFields({ form, setForm, prefix }: { form: CatalogForm; setForm: (form: CatalogForm) => void; prefix: string }) {
  const field = (key: keyof CatalogForm) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });
  return <div className="admin-form-grid"><label className="admin-form-field admin-form-field--full" htmlFor={`${prefix}-name`}>Name<input id={`${prefix}-name`} value={form.name} onChange={field("name")} required maxLength={120} /></label><label className="admin-form-field" htmlFor={`${prefix}-code`}>Code<input id={`${prefix}-code`} value={form.code} onChange={field("code")} required maxLength={32} /></label><label className="admin-form-field" htmlFor={`${prefix}-unit`}>Unit<input id={`${prefix}-unit`} value={form.unit} onChange={field("unit")} required maxLength={32} /></label><label className="admin-form-field" htmlFor={`${prefix}-category`}>Category<input id={`${prefix}-category`} value={form.category} onChange={field("category")} required maxLength={80} /></label><label className="admin-form-field" htmlFor={`${prefix}-threshold`}>Reorder threshold <span className="admin-field-optional">Optional</span><input id={`${prefix}-threshold`} type="number" min="0" step="any" value={form.threshold} onChange={field("threshold")} /></label></div>;
}

function catalogForm(item: CatalogItem): CatalogForm { return { name: item.name, code: item.code, unit: item.unit, category: item.category, threshold: item.threshold == null ? "" : String(item.threshold) }; }
function thresholdValue(raw: string) { return raw.trim() === "" ? null : Number(raw); }

export default function AdminInventoryPage() {
  const session = useDashboardSession();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<CatalogForm>(emptyForm);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<CatalogForm>(emptyForm);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const itemsQuery = useQuery({ queryKey: ["admin-inventory"], queryFn: async () => records(await apiGet<unknown>("/inventory-items", session!.token)).map(normalizeCatalogItem).filter((item) => item.id), enabled: Boolean(session?.token && session?.role === "admin"), staleTime: 60_000, retry: false });
  const items = itemsQuery.data ?? EMPTY_ITEMS;
  const selectedItem = items.find((item) => item.id === selectedId);
  const invalidateItems = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin-inventory"] }), queryClient.invalidateQueries({ queryKey: ["inventory-items"] }), queryClient.invalidateQueries({ queryKey: ["factory-stock"] }), queryClient.invalidateQueries({ queryKey: ["factory-dashboard", "inventory-items"] })]); };
  const createMutation = useMutation({ mutationFn: () => apiPost("/inventory-items", session!.token, { name: addForm.name.trim(), code: addForm.code.trim(), unit: addForm.unit.trim(), category: addForm.category.trim(), reorder_threshold: thresholdValue(addForm.threshold) }), onSuccess: async () => { await invalidateItems(); setAddOpen(false); setAddForm(emptyForm); toast.success("Inventory item created"); } });
  const updateMutation = useMutation({ mutationFn: () => apiPut(`/inventory-items/${encodeURIComponent(selectedItem!.id)}`, session!.token, { name: editForm.name.trim(), code: editForm.code.trim(), unit: editForm.unit.trim(), category: editForm.category.trim(), reorder_threshold: thresholdValue(editForm.threshold) }), onSuccess: async () => { await invalidateItems(); setEditing(false); toast.success("Inventory item updated"); } });
  const deactivateMutation = useMutation({ mutationFn: () => apiDelete(`/inventory-items/${encodeURIComponent(selectedItem!.id)}`, session!.token), onSuccess: async () => { await invalidateItems(); setConfirmDeactivate(false); setSelectedId(""); setEditing(false); toast.success("Inventory item deactivated"); } });

  const columns: Array<ColumnDef<typeof inventoryFeatures, CatalogItem>> = useMemo(() => [
    { id: "name", accessorFn: (item) => item.name, header: "Name", cell: (info) => <strong className="admin-table-primary">{info.row.original.name}</strong> },
    { id: "code", accessorFn: (item) => item.code, header: "Code", cell: (info) => <span className="admin-table-muted">{info.row.original.code || "—"}</span> },
    { id: "unit", accessorFn: (item) => item.unit, header: "Unit", cell: (info) => info.row.original.unit || "—" },
    { id: "category", accessorFn: (item) => item.category, header: "Category", cell: (info) => info.row.original.category || "—" },
    { id: "threshold", accessorFn: (item) => item.threshold ?? -1, header: "Reorder Threshold", cell: (info) => info.row.original.threshold ?? "—" },
    { id: "status", accessorFn: (item) => item.isActive, header: "Status", cell: (info) => <span className={`admin-status-pill ${info.row.original.isActive ? "is-active" : "is-inactive"}`}>{info.row.original.isActive ? "Active" : "Inactive"}</span> },
  ], []);
  const table = useTable({ features: inventoryFeatures, columns, data: items });

  if (session?.role !== "admin") return <div className="admin-management-page"><Alert variant="destructive">Administrator access is required to manage the inventory catalog.</Alert></div>;

  return <div className="admin-management-page">
    <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">ADMIN / CATALOG</div><h1>Inventory Catalog</h1><p>Manage shared item definitions, units, and reorder thresholds.</p></div><div className="admin-heading-actions"><Link className="factory-secondary-button" href="/admin/stock">View Stock Levels</Link><button className="factory-primary-button" type="button" onClick={() => { setAddForm(emptyForm); createMutation.reset(); setAddOpen(true); }}>＋ Add Item</button></div></div>
    {itemsQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Inventory items could not be loaded: {itemsQuery.error.message}<button type="button" onClick={() => void itemsQuery.refetch()}>Retry</button></Alert>}
    <Card className="factory-stock-card"><CardContent className="factory-stock-card__content"><div className="factory-stock-toolbar"><div className="factory-stock-toolbar__copy"><h2>Catalog items</h2><p>{items.length} {items.length === 1 ? "item" : "items"}</p></div></div>{itemsQuery.isLoading ? <div className="admin-table-skeleton">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} />)}</div> : <div className="stock-table-scroll"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id} className="stock-clickable-row" tabIndex={0} onClick={() => { setSelectedId(row.original.id); setEditing(true); updateMutation.reset(); setEditForm(catalogForm(row.original)); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(row.original.id); setEditing(true); updateMutation.reset(); setEditForm(catalogForm(row.original)); } }}>{row.getAllCells().map((cell) => <TableCell key={cell.id}><table.FlexRender cell={cell} /></TableCell>)}</TableRow>)}{!items.length && !itemsQuery.isError && <TableRow><TableCell colSpan={6} className="stock-empty-cell">No catalog items have been added.</TableCell></TableRow>}</TableBody></Table></div>}</CardContent></Card>

    <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add inventory item" description="Create a catalog definition. This does not add stock." className="admin-form-dialog"><form onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}><CatalogFormFields form={addForm} setForm={setAddForm} prefix="add-item" />{createMutation.isError && <Alert variant="destructive" className="admin-form-error">Item could not be created: {createMutation.error.message}</Alert>}<div className="admin-form-actions"><button className="factory-secondary-button" type="button" onClick={() => setAddOpen(false)}>Cancel</button><button className="factory-primary-button" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating…" : "Create item"}</button></div></form></Dialog>

    <Sheet open={Boolean(selectedItem)} onOpenChange={(open) => { if (!open) { setSelectedId(""); setEditing(false); } }} title={selectedItem?.name ?? "Inventory item"} description={selectedItem?.code ? `Catalog code ${selectedItem.code}` : "Catalog item details"}>
      {selectedItem && <>{editing ? <form className="admin-edit-form" onSubmit={(event) => { event.preventDefault(); updateMutation.mutate(); }}><CatalogFormFields form={editForm} setForm={setEditForm} prefix="edit-item" />{updateMutation.isError && <Alert variant="destructive" className="admin-form-error">Item could not be updated: {updateMutation.error.message}</Alert>}<div className="admin-form-actions"><button className="factory-secondary-button" type="button" onClick={() => { setEditing(false); setEditForm(catalogForm(selectedItem)); }}>Cancel edit</button><button className="factory-primary-button" type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving…" : "Save changes"}</button></div></form> : <><dl className="admin-record-details"><div><dt>Name</dt><dd>{selectedItem.name}</dd></div><div><dt>Code</dt><dd>{selectedItem.code || "—"}</dd></div><div><dt>Unit</dt><dd>{selectedItem.unit || "—"}</dd></div><div><dt>Category</dt><dd>{selectedItem.category || "—"}</dd></div><div><dt>Reorder threshold</dt><dd>{selectedItem.threshold ?? "—"}</dd></div><div><dt>Status</dt><dd><span className={`admin-status-pill ${selectedItem.isActive ? "is-active" : "is-inactive"}`}>{selectedItem.isActive ? "Active" : "Inactive"}</span></dd></div></dl><div className="admin-drawer-actions"><button className="factory-primary-button" type="button" onClick={() => { setEditForm(catalogForm(selectedItem)); updateMutation.reset(); setEditing(true); }}>Edit item</button></div></>}
        {selectedItem.isActive && <div className="admin-deactivate-section"><div><strong>Deactivate item</strong><p>Inactive catalog items cannot be selected for new inventory operations.</p></div><button className="destructive-button" type="button" onClick={() => { deactivateMutation.reset(); setConfirmDeactivate(true); }}>Deactivate</button></div>}
      </>}
    </Sheet>
    <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate} title="Deactivate this item?" description={`“${selectedItem?.name ?? "This item"}” will be marked inactive. Existing stock records will remain unchanged.`} confirmLabel="Deactivate item" pending={deactivateMutation.isPending} error={deactivateMutation.isError ? deactivateMutation.error.message : undefined} onConfirm={() => deactivateMutation.mutate()} />
  </div>;
}
