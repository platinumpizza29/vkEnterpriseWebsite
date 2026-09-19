"use client";

import { createSortedRowModel, rowSortingFeature, sortFns, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSites } from "@/hooks/use-sites";
import { apiGet } from "@/lib/api";
import { formatDate, normalizeItem, normalizeTicket, records, value, type DispatchTicket } from "@/lib/factory-data";

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns });
const STATUSES = ["dispatched", "received", "closed"];
const statusLabel = (status: string) => status ? `${status[0].toUpperCase()}${status.slice(1)}` : "Unknown";

export default function AdminTicketsClient({ requisitionId }: { requisitionId: string }) {
  const session = useDashboardSession();
  const sitesQuery = useSites();
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const siteNames = useMemo(() => new Map((sitesQuery.data ?? []).map((site) => [site.id, site.name])), [sitesQuery.data]);
  const ticketsQuery = useQuery({ queryKey: ["admin-tickets", status, requisitionId], queryFn: async () => {
    const path = requisitionId ? `/dispatch-tickets/requisition/${encodeURIComponent(requisitionId)}` : `/dispatch-tickets?status=${encodeURIComponent(status)}`;
    const result = records(await apiGet<unknown>(path, session!.token)).map(normalizeTicket);
    return requisitionId && status ? result.filter((ticket) => ticket.status === status) : result;
  }, enabled: Boolean(session?.token && session.role === "admin"), staleTime: 60_000, retry: false });
  const itemsQuery = useQuery({ queryKey: ["inventory-items", "catalog"], queryFn: async () => records(await apiGet<unknown>("/inventory-items", session!.token)).map(normalizeItem), enabled: Boolean(session?.token), staleTime: 5 * 60_000, retry: false });
  const detailQuery = useQuery({ queryKey: ["admin-ticket", selectedId], queryFn: async () => {
    const payload = await apiGet<unknown>(`/dispatch-tickets/${encodeURIComponent(selectedId)}`, session!.token);
    const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const ticket = value(root, "ticket", "Ticket") ?? root;
    return normalizeTicket(ticket as Record<string, unknown>);
  }, enabled: Boolean(session?.token && selectedId), staleTime: 60_000, retry: false });
  const itemNames = useMemo(() => new Map((itemsQuery.data ?? []).map((item) => [item.id, item.name])), [itemsQuery.data]);
  const rows = ticketsQuery.data ?? [];
  const columns: Array<ColumnDef<typeof features, DispatchTicket>> = useMemo(() => [
    { id: "site", accessorFn: (ticket) => siteNames.get(ticket.siteId) ?? "Unknown site", header: "Site", cell: (info) => <span className="admin-table-primary">{siteNames.get(info.row.original.siteId) ?? "Unknown site"}</span> },
    { id: "item", accessorFn: (ticket) => itemNames.get(ticket.itemId) ?? ticket.itemId, header: "Item", cell: (info) => itemNames.get(info.row.original.itemId) ?? `Item ${info.row.original.itemId}` },
    { id: "quantity", accessorFn: (ticket) => ticket.dispatchedQuantity, header: "Dispatched Quantity", cell: (info) => info.row.original.dispatchedQuantity.toLocaleString() },
    { id: "status", accessorFn: (ticket) => ticket.status, header: "Status", cell: (info) => <span className={`admin-status-pill admin-ticket-status is-${info.row.original.status}`}>{statusLabel(info.row.original.status)}</span> },
    { id: "date", accessorFn: (ticket) => ticket.dispatchedAt, header: "Dispatched Date", cell: (info) => formatDate(info.row.original.dispatchedAt) },
  ], [siteNames, itemNames]);
  const table = useTable({ features, columns, data: rows });
  const detail = detailQuery.data;
  const isAdmin = session?.role === "admin";

  if (!isAdmin) return <div className="admin-management-page"><Alert variant="destructive">Administrator access is required to view dispatch tickets.</Alert></div>;
  return <div className="admin-management-page">
    <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">ADMIN / OPERATIONS</div><h1>Dispatch Tickets</h1><p>Read-only oversight of dispatches and site receipt progress.</p></div></div>
    {ticketsQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Tickets could not be loaded: {ticketsQuery.error.message}<button type="button" onClick={() => void ticketsQuery.refetch()}>Retry</button></Alert>}
    {sitesQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Site names could not be loaded: {sitesQuery.error.message}</Alert>}
    {itemsQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Item names could not be loaded: {itemsQuery.error.message}</Alert>}
    <Card className="factory-stock-card"><CardContent className="factory-stock-card__content"><div className="factory-stock-toolbar"><div className="factory-stock-toolbar__copy"><h2>{requisitionId ? "Tickets for requisition" : "All dispatch tickets"}</h2><p>{rows.length} {rows.length === 1 ? "ticket" : "tickets"}</p></div><label className="ticket-filter"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter tickets by status"><option value="">All statuses</option>{STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label></div>
      {ticketsQuery.isLoading ? <div className="admin-table-skeleton">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} />)}</div> : <div className="stock-table-scroll"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.original.id} className="stock-clickable-row" tabIndex={0} onClick={() => setSelectedId(row.original.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(row.original.id); } }}>{row.getAllCells().map((cell) => <TableCell key={cell.id}><table.FlexRender cell={cell} /></TableCell>)}</TableRow>)}{!rows.length && <TableRow><TableCell colSpan={5} className="stock-empty-cell">No tickets match this status.</TableCell></TableRow>}</TableBody></Table></div>}
    </CardContent></Card>
    <Sheet open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(""); }} title="Dispatch ticket" description={detail ? `Ticket ${detail.id}` : "Dispatch status timeline."}>
      {detailQuery.isLoading ? <div className="admin-table-skeleton">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} />)}</div> : detailQuery.isError ? <Alert variant="destructive">Ticket details could not be loaded: {detailQuery.error.message}</Alert> : detail && <>
        <dl className="admin-record-details"><div><dt>Destination</dt><dd>{siteNames.get(detail.siteId) ?? "Unknown site"}</dd></div><div><dt>Item</dt><dd>{itemNames.get(detail.itemId) ?? `Item ${detail.itemId}`}</dd></div><div><dt>Quantity</dt><dd>{detail.dispatchedQuantity.toLocaleString()}</dd></div><div><dt>Requisition</dt><dd>{detail.requisitionId || "—"}</dd></div><div><dt>Status</dt><dd><span className={`admin-status-pill admin-ticket-status is-${detail.status}`}>{statusLabel(detail.status)}</span></dd></div></dl>
        <section className="admin-ticket-timeline"><h3>Status timeline</h3>{([ { key: "dispatched", title: "Dispatched", date: detail.dispatchedAt }, { key: "received", title: "Received", date: detail.receivedAt }, { key: "closed", title: "Closed", date: detail.closedAt } ] as const).map((stage, index) => { const activeIndex = Math.max(0, STATUSES.indexOf(detail.status)); const complete = index < activeIndex || Boolean(stage.date); const active = index === activeIndex; return <div key={stage.key} className={`admin-ticket-stage${complete ? " is-complete" : ""}${active ? " is-current" : ""}`}><span className="admin-ticket-stage__marker">{complete ? "✓" : index + 1}</span><div><strong>{stage.title}</strong><small>{stage.date ? formatDate(stage.date) : active ? "Current stage" : "Pending"}</small></div></div>; })}</section>
      </>}
    </Sheet>
  </div>;
}
