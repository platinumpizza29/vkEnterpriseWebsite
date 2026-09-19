"use client";

import { createSortedRowModel, rowSortingFeature, sortFns, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSites } from "@/hooks/use-sites";
import { apiGet } from "@/lib/api";
import { formatDate, normalizeItem, normalizeRequisition, records, type FactoryItem, type RequisitionRecord } from "@/lib/factory-data";

const requisitionFeatures = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns });
const CACHE_TIME = 5 * 60_000;
const EMPTY_SITES: { id: string; name: string }[] = [];
const EMPTY_ITEMS: FactoryItem[] = [];

export default function FactoryRequisitionsPage() {
  const session = useDashboardSession();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const hasAccess = session?.role === "factory_manager" || session?.role === "manager" || session?.role === "admin";
  const requisitionsQuery = useQuery({
    queryKey: ["factory-requisitions", "approved"],
    queryFn: async () => records(await apiGet<unknown>("/requisitions?status=approved", session!.token)).map(normalizeRequisition),
    enabled: Boolean(session?.token && hasAccess),
    staleTime: 60_000,
    retry: false,
  });
  const sitesQuery = useSites();
  const itemsQuery = useQuery({
    queryKey: ["inventory-items", "catalog"],
    queryFn: async () => records(await apiGet<unknown>("/inventory-items", session!.token)).map(normalizeItem).filter((item) => item.id),
    enabled: Boolean(session?.token && hasAccess),
    staleTime: CACHE_TIME,
    retry: false,
  });
  const detailsQueries = useQueries({ queries: (requisitionsQuery.data ?? []).map((requisition) => ({
    queryKey: ["factory-requisition", requisition.id],
    queryFn: async () => normalizeRequisition(await apiGet<unknown>(`/requisitions/${encodeURIComponent(requisition.id)}`, session!.token)),
    enabled: Boolean(session?.token && requisition.id),
    staleTime: CACHE_TIME,
    retry: false,
  })) });
  const selectedIndex = (requisitionsQuery.data ?? []).findIndex((req) => req.id === selectedId);
  const selectedRequisition = (requisitionsQuery.data ?? [])[selectedIndex];
  const selectedDetailsQuery = detailsQueries[selectedIndex];
  const selectedDetail = selectedDetailsQuery?.data ?? selectedRequisition;
  const sites = sitesQuery.data ?? EMPTY_SITES;
  const items = itemsQuery.data ?? EMPTY_ITEMS;
  const siteNames = useMemo(() => new Map(sites.map((site) => [site.id, site.name])), [sites]);
  const itemNames = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const columns: Array<ColumnDef<typeof requisitionFeatures, RequisitionRecord>> = useMemo(() => [
    { id: "site", accessorFn: (row) => siteNames.get(row.siteId) ?? "Loading site…", header: "Site Name", cell: (info) => info.getValue() },
    { id: "task", accessorFn: (row) => row.taskDescription, header: "Task Description", cell: (info) => <span className="requisition-task-cell">{info.row.original.taskDescription}</span> },
    { id: "lines", accessorFn: (row) => row.lines.length, header: "Line Item Count", cell: (info) => {
      const index = (requisitionsQuery.data ?? []).findIndex((req) => req.id === info.row.original.id);
      const count = detailsQueries[index]?.data?.lines.length ?? info.row.original.lines.length;
      return detailsQueries[index]?.isLoading && count === 0 ? "Loading…" : `${count} ${count === 1 ? "item" : "items"}`;
    } },
    { id: "approved_at", accessorFn: (row) => row.approvedAt, header: "Approved Date", cell: (info) => formatDate(info.row.original.approvedAt) },
  ], [siteNames, requisitionsQuery.data, detailsQueries]);
  const table = useTable({ features: requisitionFeatures, columns, data: requisitionsQuery.data ?? [] });

  if (!hasAccess) return <div className="factory-data-page"><div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">REQUISITIONS / DISPATCH QUEUE</div><h1>Requisitions awaiting dispatch</h1><p>Review approved requisitions before preparing dispatch tickets.</p></div></div><Alert variant="destructive">Factory Manager or administrator access is required to view approved requisitions.</Alert></div>;

  return (
    <div className="factory-data-page">
      <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">REQUISITIONS / DISPATCH QUEUE</div><h1>Requisitions awaiting dispatch</h1><p>Review approved requisitions before preparing dispatch tickets.</p></div></div>
      {requisitionsQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Approved requisitions could not be loaded: {requisitionsQuery.error.message}<button type="button" onClick={() => void requisitionsQuery.refetch()}>Retry</button></Alert>}
      {sitesQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Sites could not be loaded: {sitesQuery.error.message}</Alert>}
      {itemsQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Inventory items could not be loaded: {itemsQuery.error.message}</Alert>}
      <Card className="factory-stock-card"><CardContent className="factory-stock-card__content">
        <div className="factory-stock-toolbar"><div className="factory-stock-toolbar__copy"><h2>Approved requisitions</h2><p>Click a row to review requested items and dispatch.</p></div></div>
        {requisitionsQuery.isLoading ? <div className="factory-data-skeleton">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} />)}</div> : <div className="stock-table-scroll"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id} className="stock-clickable-row" tabIndex={0} onClick={() => setSelectedId(row.original.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(row.original.id); } }}>{row.getAllCells().map((cell) => <TableCell key={cell.id}><table.FlexRender cell={cell} /></TableCell>)}</TableRow>)}{!requisitionsQuery.data?.length && !requisitionsQuery.isError && <TableRow><TableCell colSpan={4} className="stock-empty-cell">No approved requisitions are awaiting dispatch.</TableCell></TableRow>}</TableBody></Table></div>}
      </CardContent></Card>
      <Sheet open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(""); }} title="Requisition details" description={selectedRequisition?.taskDescription}>
        {selectedDetailsQuery?.isLoading ? <div className="factory-data-skeleton"><Skeleton /><Skeleton /><Skeleton /></div> : selectedDetailsQuery?.isError ? <Alert variant="destructive">Requisition details could not be loaded: {selectedDetailsQuery.error.message}</Alert> : selectedDetail ? <>
          <dl className="requisition-detail-list"><div><dt>Task description</dt><dd>{selectedDetail.taskDescription}</dd></div><div><dt>Requested by</dt><dd>{selectedDetail.requestedBy}</dd></div><div><dt>Approved date</dt><dd>{formatDate(selectedDetail.approvedAt)}</dd></div><div><dt>Destination site</dt><dd>{siteNames.get(selectedDetail.siteId) ?? "Unknown site"}</dd></div></dl>
          <section className="sheet-section"><h3>Requested line items</h3><div className="requisition-line-list">{selectedDetail.lines.map((line) => { const item: FactoryItem | undefined = itemNames.get(line.itemId); return <div className="requisition-line" key={line.id}><span><strong>{item?.name ?? "Unknown item"}</strong>{item?.unit && <small>{item.unit}</small>}</span><b>{line.quantity.toLocaleString()}</b></div>; })}{!selectedDetail.lines.length && <p className="sheet-muted">No line items are recorded.</p>}</div></section>
          <div className="sheet-footer"><button className="factory-primary-button" type="button" disabled={!selectedDetail.lines.length} onClick={() => router.push(`/factory/requisitions/${encodeURIComponent(selectedDetail.id)}/dispatch`)}>Dispatch requisition <span aria-hidden="true">→</span></button></div>
        </> : <p className="sheet-muted">Select a requisition to view its details.</p>}
      </Sheet>
    </div>
  );
}
