"use client";

import { createSortedRowModel, rowSortingFeature, sortFns, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { AlertDialog } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSites } from "@/hooks/use-sites";
import { apiGet, apiPut } from "@/lib/api";
import { formatDate, normalizeItem, normalizeRequisition, records, type RequisitionRecord } from "@/lib/factory-data";

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns });
const STATUSES = ["submitted", "approved", "rejected", "closed"];
const ALL_STATUSES = ["draft", ...STATUSES];

export default function AdminRequisitionsPage() {
  const session = useDashboardSession();
  const queryClient = useQueryClient();
  const sitesQuery = useSites();
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | "" > ("");
  const [actionError, setActionError] = useState("");
  const siteNames = useMemo(() => new Map((sitesQuery.data ?? []).map((site) => [site.id, site.name])), [sitesQuery.data]);
  const listQuery = useQuery({ queryKey: ["admin-requisitions", status], queryFn: async () => {
    const statuses = status ? [status] : ALL_STATUSES;
    const responses = await Promise.all(statuses.map((itemStatus) => apiGet<unknown>(`/requisitions?status=${encodeURIComponent(itemStatus)}`, session!.token)));
    const unique = new Map<string, RequisitionRecord>();
    responses.flatMap((payload) => records(payload).map(normalizeRequisition)).forEach((request) => unique.set(request.id, request));
    return [...unique.values()];
  }, enabled: Boolean(session?.token && session.role === "admin"), staleTime: 60_000, retry: false });
  const detailQuery = useQuery({ queryKey: ["admin-requisition", selectedId], queryFn: async () => normalizeRequisition(await apiGet<unknown>(`/requisitions/${encodeURIComponent(selectedId)}`, session!.token)), enabled: Boolean(session?.token && selectedId), staleTime: 60_000, retry: false });
  const itemsQuery = useQuery({ queryKey: ["inventory-items", "catalog"], queryFn: async () => records(await apiGet<unknown>("/inventory-items", session!.token)).map(normalizeItem), enabled: Boolean(session?.token), staleTime: 5 * 60_000, retry: false });
  const decisionMutation = useMutation({ mutationFn: async (kind: "approve" | "reject") => apiPut(`/requisitions/${encodeURIComponent(selectedId)}/${kind}`, session!.token, {}), onSuccess: async () => { setActionError(""); setDecision(""); await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin-requisitions"] }), queryClient.invalidateQueries({ queryKey: ["admin-requisition", selectedId] }), queryClient.invalidateQueries({ queryKey: ["admin-dashboard", "pending-requisitions"] }), queryClient.invalidateQueries({ queryKey: ["admin-dashboard", "recent-requisitions"] }), queryClient.invalidateQueries({ queryKey: ["factory-requisitions"] })]); }, onError: (error: Error) => setActionError(error.message) });
  const itemsById = useMemo(() => new Map((itemsQuery.data ?? []).map((item) => [item.id, item])), [itemsQuery.data]);
  const requisitions = listQuery.data ?? [];
  const columns: Array<ColumnDef<typeof features, RequisitionRecord>> = useMemo(() => [
    { id: "site", accessorFn: (row) => siteNames.get(row.siteId) ?? "Unknown site", header: "Site Name", cell: (info) => <span className="admin-table-primary">{siteNames.get(info.row.original.siteId) ?? "Unknown site"}</span> },
    { id: "task", accessorFn: (row) => row.taskDescription, header: "Task Description", cell: (info) => <span className="admin-table-primary">{info.row.original.taskDescription}</span> },
    { id: "status", accessorFn: (row) => row.status, header: "Status", cell: (info) => <span className={`admin-status-pill admin-requisition-status is-${info.row.original.status.toLowerCase()}`}>{info.row.original.status || "Unknown"}</span> },
    { id: "requestedBy", accessorFn: (row) => row.requestedBy, header: "Requested By", cell: (info) => info.row.original.requestedBy || "—" },
    { id: "created", accessorFn: (row) => row.createdAt, header: "Created Date", cell: (info) => formatDate(info.row.original.createdAt) },
  ], [siteNames]);
  const table = useTable({ features, columns, data: requisitions });
  const detail = detailQuery.data;
  const isAdmin = session?.role === "admin";

  if (!isAdmin) return <div className="admin-management-page"><Alert variant="destructive">Administrator access is required to view requisitions.</Alert></div>;
  return <div className="admin-management-page">
    <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">ADMIN / OPERATIONS</div><h1>Requisitions</h1><p>Review requests across all sites and track their dispatch status.</p></div></div>
    {listQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Requisitions could not be loaded: {listQuery.error.message}<button type="button" onClick={() => void listQuery.refetch()}>Retry</button></Alert>}
    {sitesQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Site names could not be loaded: {sitesQuery.error.message}</Alert>}
    <Card className="factory-stock-card"><CardContent className="factory-stock-card__content"><div className="factory-stock-toolbar"><div className="factory-stock-toolbar__copy"><h2>All requisitions</h2><p>{requisitions.length} {requisitions.length === 1 ? "request" : "requests"}</p></div><label className="ticket-filter"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter requisitions by status"><option value="">All statuses</option>{STATUSES.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label></div>
      {listQuery.isLoading ? <div className="admin-table-skeleton">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} />)}</div> : <div className="stock-table-scroll"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.original.id} className="stock-clickable-row" tabIndex={0} onClick={() => { setSelectedId(row.original.id); setActionError(""); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(row.original.id); setActionError(""); } }}>{row.getAllCells().map((cell) => <TableCell key={cell.id}><table.FlexRender cell={cell} /></TableCell>)}</TableRow>)}{!requisitions.length && <TableRow><TableCell colSpan={5} className="stock-empty-cell">No requisitions match this status.</TableCell></TableRow>}</TableBody></Table></div>}
    </CardContent></Card>
    <Sheet open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) { setSelectedId(""); setDecision(""); setActionError(""); } }} title="Requisition details" description={detail ? `Request ${detail.id}` : "Review request details and line items."}>
      {detailQuery.isLoading ? <div className="admin-table-skeleton">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} />)}</div> : detailQuery.isError ? <Alert variant="destructive">Details could not be loaded: {detailQuery.error.message}</Alert> : detail && <>
        <dl className="admin-record-details"><div><dt>Site</dt><dd>{siteNames.get(detail.siteId) ?? "Unknown site"}</dd></div><div><dt>Task</dt><dd>{detail.taskDescription}</dd></div><div><dt>Status</dt><dd><span className={`admin-status-pill admin-requisition-status is-${detail.status.toLowerCase()}`}>{detail.status}</span></dd></div><div><dt>Requested by</dt><dd>{detail.requestedBy}</dd></div><div><dt>Created</dt><dd>{formatDate(detail.createdAt)}</dd></div><div><dt>Approved</dt><dd>{formatDate(detail.approvedAt)}</dd></div></dl>
        <section className="admin-requisition-lines"><h3>Line items</h3>{detail.lines.length ? <div className="stock-table-scroll"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Requested</TableHead></TableRow></TableHeader><TableBody>{detail.lines.map((line) => <TableRow key={line.id}><TableCell>{itemsById.get(line.itemId)?.name ?? `Item ${line.itemId}`}</TableCell><TableCell>{line.quantity.toLocaleString()} {itemsById.get(line.itemId)?.unit ?? ""}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="admin-inline-muted">No line items are available.</p>}</section>
        {itemsQuery.isError && <Alert variant="destructive">Item names could not be loaded: {itemsQuery.error.message}</Alert>}
        {actionError && <Alert variant="destructive" className="admin-form-error">Action failed: {actionError}</Alert>}
        {detail.status.toLowerCase() === "submitted" && <div className="admin-requisition-actions"><button type="button" className="factory-primary-button" disabled={decisionMutation.isPending} onClick={() => setDecision("approve")}>Approve</button><button type="button" className="destructive-button" disabled={decisionMutation.isPending} onClick={() => setDecision("reject")}>Reject</button><p>Approval permissions depend on the API role policy.</p></div>}
        {detail.status.toLowerCase() === "approved" && <Link className="factory-primary-button admin-view-tickets" href={`/admin/tickets?requisition_id=${encodeURIComponent(detail.id)}`}>View Dispatch Tickets</Link>}
      </>}
    </Sheet>
    <AlertDialog open={Boolean(decision)} onOpenChange={(open) => { if (!open && !decisionMutation.isPending) setDecision(""); }} title={decision === "approve" ? "Approve requisition?" : "Reject requisition?"} description={`Confirm that you want to ${decision} this requisition.`} confirmLabel={decision === "approve" ? "Approve requisition" : "Reject requisition"} pending={decisionMutation.isPending} error={decisionMutation.error?.message} onConfirm={() => { if (decision) decisionMutation.mutate(decision); }} />
  </div>;
}
