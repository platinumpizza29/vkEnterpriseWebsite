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
import { formatDate, normalizeItem, normalizeTicket, records, type DispatchTicket, type FactoryItem } from "@/lib/factory-data";

const ticketFeatures = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns });
type TicketStatus = "all" | "dispatched" | "received" | "closed";
const EMPTY_SITES: { id: string; name: string }[] = [];
const EMPTY_ITEMS: FactoryItem[] = [];

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export default function FactoryTicketsPage() {
  const session = useDashboardSession();
  const hasAccess = session?.role === "factory_manager" || session?.role === "manager" || session?.role === "admin";
  const [status, setStatus] = useState<TicketStatus>("all");
  const [selectedId, setSelectedId] = useState("");
  const sitesQuery = useSites();
  const itemsQuery = useQuery({
    queryKey: ["inventory-items", "catalog"],
    queryFn: async () => records(await apiGet<unknown>("/inventory-items", session!.token)).map(normalizeItem).filter((item) => item.id),
    enabled: Boolean(session?.token && hasAccess),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const ticketsQuery = useQuery({
    queryKey: ["dispatch-tickets", status],
    queryFn: async () => {
      const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
      return records(await apiGet<unknown>(`/dispatch-tickets${query}`, session!.token)).map(normalizeTicket).filter((ticket) => ticket.id);
    },
    enabled: Boolean(session?.token && hasAccess),
    staleTime: 60_000,
    retry: false,
  });
  const detailQuery = useQuery({
    queryKey: ["dispatch-ticket", selectedId],
    queryFn: async () => {
      const payload = await apiGet<unknown>(`/dispatch-tickets/${encodeURIComponent(selectedId)}`, session!.token);
      const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
      return normalizeTicket((root.ticket ?? root.Ticket ?? root) as Record<string, unknown>);
    },
    enabled: Boolean(session?.token && hasAccess && selectedId),
    staleTime: 60_000,
    retry: false,
  });
  const sites = sitesQuery.data ?? EMPTY_SITES;
  const items = itemsQuery.data ?? EMPTY_ITEMS;
  const siteMap = useMemo(() => new Map(sites.map((site) => [site.id, site.name])), [sites]);
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const selectedTicket = detailQuery.data ?? ticketsQuery.data?.find((ticket) => ticket.id === selectedId);

  const columns: Array<ColumnDef<typeof ticketFeatures, DispatchTicket>> = useMemo(() => [
    { id: "site", accessorFn: (ticket) => siteMap.get(ticket.siteId) ?? "Unknown site", header: "Destination Site", cell: (info) => info.getValue() },
    { id: "item", accessorFn: (ticket) => itemMap.get(ticket.itemId)?.name ?? "Unknown item", header: "Item Name", cell: (info) => info.getValue() },
    { id: "quantity", accessorFn: (ticket) => ticket.dispatchedQuantity, header: "Dispatched Quantity", cell: (info) => <span className="stock-balance-value">{info.row.original.dispatchedQuantity.toLocaleString()} {itemMap.get(info.row.original.itemId)?.unit ?? ""}</span> },
    { id: "status", accessorFn: (ticket) => ticket.status, header: "Status", cell: (info) => <span className={`ticket-status ticket-status--${info.row.original.status}`}>{statusLabel(info.row.original.status)}</span> },
    { id: "date", accessorFn: (ticket) => ticket.dispatchedAt, header: "Dispatched Date", cell: (info) => formatDate(info.row.original.dispatchedAt) },
  ], [siteMap, itemMap]);
  const table = useTable({ features: ticketFeatures, columns, data: ticketsQuery.data ?? [] });

  if (!hasAccess) return <div className="factory-data-page"><Alert variant="destructive">Factory Manager or administrator access is required to view dispatch tickets.</Alert></div>;

  const currentStage = (ticket: DispatchTicket) => ticket.status === "closed" ? 2 : ticket.status === "received" ? 1 : 0;

  return (
    <div className="factory-data-page">
      <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">DISPATCH / OVERSIGHT</div><h1>Dispatch tickets</h1><p>Track dispatched materials and their site receipt status.</p></div></div>
      {ticketsQuery.isError && <Alert variant="destructive" className="factory-stock-alert"><span>Dispatch tickets could not be loaded: {ticketsQuery.error.message}</span><button type="button" onClick={() => void ticketsQuery.refetch()}>Retry</button></Alert>}
      {sitesQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Sites could not be loaded: {sitesQuery.error.message}</Alert>}
      {itemsQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Inventory items could not be loaded: {itemsQuery.error.message}</Alert>}
      <Card className="factory-stock-card"><CardContent className="factory-stock-card__content">
        <div className="factory-stock-toolbar"><div className="factory-stock-toolbar__copy"><h2>Ticket register</h2><p>{ticketsQuery.data?.length ?? 0} {ticketsQuery.data?.length === 1 ? "ticket" : "tickets"}</p></div><label className="ticket-filter"><span>Status</span><select aria-label="Filter dispatch tickets by status" value={status} onChange={(event) => setStatus(event.target.value as TicketStatus)}><option value="all">All</option><option value="dispatched">Dispatched</option><option value="received">Received</option><option value="closed">Closed</option></select></label></div>
        {ticketsQuery.isLoading ? <div className="factory-data-skeleton">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} />)}</div> : <div className="stock-table-scroll"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id} className="stock-clickable-row" tabIndex={0} onClick={() => setSelectedId(row.original.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(row.original.id); } }}>{row.getAllCells().map((cell) => <TableCell key={cell.id}><table.FlexRender cell={cell} /></TableCell>)}</TableRow>)}{!ticketsQuery.data?.length && !ticketsQuery.isError && <TableRow><TableCell colSpan={5} className="stock-empty-cell">No dispatch tickets match this status.</TableCell></TableRow>}</TableBody></Table></div>}
      </CardContent></Card>
      <Sheet open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(""); }} title="Dispatch ticket" description={selectedTicket ? `Ticket ${selectedTicket.id}` : "Ticket details"}>
        {detailQuery.isLoading ? <div className="factory-data-skeleton"><Skeleton /><Skeleton /><Skeleton /></div> : detailQuery.isError ? <Alert variant="destructive">Ticket details could not be loaded: {detailQuery.error.message}</Alert> : selectedTicket ? <>
          <dl className="requisition-detail-list"><div><dt>Destination site</dt><dd>{siteMap.get(selectedTicket.siteId) ?? "Unknown site"}</dd></div><div><dt>Item</dt><dd>{itemMap.get(selectedTicket.itemId)?.name ?? "Unknown item"}</dd></div><div><dt>Dispatched quantity</dt><dd>{selectedTicket.dispatchedQuantity.toLocaleString()} {itemMap.get(selectedTicket.itemId)?.unit ?? ""}</dd></div><div><dt>Status</dt><dd><span className={`ticket-status ticket-status--${selectedTicket.status}`}>{statusLabel(selectedTicket.status)}</span></dd></div><div><dt>Requisition</dt><dd>{selectedTicket.requisitionId || "—"}</dd></div></dl>
          <section className="sheet-section"><h3>Status timeline</h3><ol className="ticket-timeline">{[
            { label: "Dispatched", time: selectedTicket.dispatchedAt, index: 0 },
            { label: "Received", time: selectedTicket.receivedAt, index: 1 },
            { label: "Closed", time: selectedTicket.closedAt, index: 2 },
          ].map((stage) => { const current = currentStage(selectedTicket); const done = Boolean(stage.time) || stage.index < current; return <li className={`ticket-timeline__stage${stage.index === current ? " is-current" : done ? " is-done" : " is-future"}`} key={stage.label}><i aria-hidden="true">{done ? "✓" : stage.index + 1}</i><div><strong>{stage.label}</strong><span>{stage.time ? formatDate(stage.time) : stage.index === current ? "Current status" : "Pending"}</span></div></li>; })}</ol></section>
          <p className="sheet-readonly-note">Ticket oversight is read-only here. Site engineers record receipt and close tickets.</p>
        </> : <p className="sheet-muted">Ticket details are unavailable.</p>}
      </Sheet>
    </div>
  );
}
