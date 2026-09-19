"use client";

import { createSortedRowModel, rowSortingFeature, sortFns, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSites } from "@/hooks/use-sites";
import { apiGet } from "@/lib/api";
import { records, value } from "@/lib/factory-data";

const stockFeatures = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns });
type CatalogRecord = { id: string; name: string; threshold: number | null };
type StockRow = { key: string; siteId: string; siteName: string; itemId: string; itemName: string; unit: string; balance: number; threshold: number | null; low: boolean };
type ApiStockRow = { item_id: string; item_name: string; unit: string; balance: number };
const EMPTY_SITES: { id: string; name: string; is_active?: boolean }[] = [];
const EMPTY_CATALOG: CatalogRecord[] = [];

function normalizeCatalog(payload: unknown): CatalogRecord[] {
  return records(payload).map((item) => {
    const threshold = value(item, "ReorderThreshold", "reorder_threshold");
    return { id: String(value(item, "ID", "id", "ItemID", "item_id") ?? ""), name: String(value(item, "Name", "name", "item_name") ?? "Unknown item"), threshold: threshold == null ? null : Number(threshold) };
  }).filter((item) => item.id);
}

function normalizeBalances(payload: unknown): ApiStockRow[] {
  return records(payload).map((row) => {
    const nested = (value(row, "Item", "item") ?? {}) as Record<string, unknown>;
    return {
      item_id: String(value(row, "item_id", "ItemID", "itemId", "id") ?? value(nested, "ID", "id") ?? ""),
      item_name: String(value(row, "item_name", "ItemName", "Name", "name") ?? value(nested, "Name", "name") ?? "Unknown item"),
      unit: String(value(row, "unit", "Unit") ?? value(nested, "Unit", "unit") ?? ""),
      balance: Number(value(row, "balance", "Balance", "CurrentBalance") ?? 0),
    };
  }).filter((row) => Number.isFinite(row.balance));
}

export default function AdminStockOverviewPage() {
  const session = useDashboardSession();
  const sitesQuery = useSites();
  const [siteFilter, setSiteFilter] = useState("all");
  const [itemSearch, setItemSearch] = useState("");
  const sites = sitesQuery.data ?? EMPTY_SITES;
  const stockQueries = useQueries({ queries: sites.map((site) => ({
    queryKey: ["admin-stock-by-site", site.id],
    queryFn: async () => normalizeBalances(await apiGet<unknown>(`/inventory/stock/site/${encodeURIComponent(site.id)}`, session!.token)),
    enabled: Boolean(session?.token && session?.role === "admin" && site.id),
    staleTime: 60_000,
    retry: false,
  })) });
  const catalogQuery = useQuery({ queryKey: ["inventory-items", "catalog"], queryFn: async () => normalizeCatalog(await apiGet<unknown>("/inventory-items", session!.token)), enabled: Boolean(session?.token && session?.role === "admin"), staleTime: 5 * 60_000, retry: false });
  const catalog = catalogQuery.data ?? EMPTY_CATALOG;
  const itemById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const rows: StockRow[] = sites.flatMap((site, index) => (stockQueries[index]?.data ?? []).map((entry, rowIndex) => {
    const catalogItem = itemById.get(entry.item_id) ?? catalog.find((item) => item.name.trim().toLowerCase() === entry.item_name.trim().toLowerCase());
    const threshold = catalogItem?.threshold ?? null;
    return { key: `${site.id}-${entry.item_id || rowIndex}`, siteId: site.id, siteName: site.name, itemId: entry.item_id, itemName: entry.item_name, unit: entry.unit, balance: entry.balance, threshold, low: typeof threshold === "number" && entry.balance < threshold };
  }));
  const filteredRows = rows.filter((row) => (siteFilter === "all" || row.siteId === siteFilter) && row.itemName.toLowerCase().includes(itemSearch.trim().toLowerCase()));
  const columns: Array<ColumnDef<typeof stockFeatures, StockRow>> = useMemo(() => [
    { id: "site", accessorFn: (row) => row.siteName, header: "Site Name", cell: (info) => <span className="admin-table-primary">{info.row.original.siteName}</span> },
    { id: "item", accessorFn: (row) => row.itemName, header: "Item Name", cell: (info) => <span className="admin-stock-item">{info.row.original.itemName}{info.row.original.low && <span className="admin-low-stock-pill">Low Stock</span>}</span> },
    { id: "unit", accessorFn: (row) => row.unit, header: "Unit", cell: (info) => info.row.original.unit || "—" },
    { id: "balance", accessorFn: (row) => row.balance, header: () => <span className="stock-align-right">Balance</span>, cell: (info) => <span className={`stock-balance-value${info.row.original.low ? " admin-low-stock-value" : ""}`}>{info.row.original.balance.toLocaleString()}</span> },
  ], []);
  const table = useTable({ features: stockFeatures, columns, data: filteredRows });
  const isAdmin = session?.role === "admin";
  const siteStockError = stockQueries.find((query) => query.isError)?.error;

  if (!isAdmin) return <div className="admin-management-page"><Alert variant="destructive">Administrator access is required to view cross-site stock levels.</Alert></div>;

  return <div className="admin-management-page">
    <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">ADMIN / STOCK OVERVIEW</div><h1>Stock Overview</h1><p>Read-only inventory balances across all sites.</p></div></div>
    {sitesQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Sites could not be loaded: {sitesQuery.error.message}<button type="button" onClick={() => void sitesQuery.refetch()}>Retry</button></Alert>}
    {siteStockError && <Alert variant="destructive" className="factory-stock-alert">One or more site balances could not be loaded: {siteStockError.message}</Alert>}
    {catalogQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Inventory definitions could not be loaded, so low-stock thresholds may be missing: {catalogQuery.error.message}<button type="button" onClick={() => void catalogQuery.refetch()}>Retry</button></Alert>}
    <Card className="factory-stock-card"><CardContent className="factory-stock-card__content">
      <div className="factory-stock-toolbar"><div className="factory-stock-toolbar__copy"><h2>Site inventory</h2><p>{filteredRows.length} {filteredRows.length === 1 ? "balance" : "balances"}</p></div><div className="admin-stock-filters"><label className="ticket-filter"><span>Site</span><select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)} aria-label="Filter stock by site"><option value="all">All sites</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label><label className="stock-search"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.75" cy="8.75" r="5.75" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg><input type="search" aria-label="Search by item name" placeholder="Search items…" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} /></label></div></div>
      {sitesQuery.isLoading || catalogQuery.isLoading || stockQueries.some((query) => query.isLoading) ? <div className="admin-table-skeleton">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} />)}</div> : <div className="stock-table-scroll"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} className={header.column.id === "balance" ? "stock-align-right" : ""}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.original.key} className={row.original.low ? "admin-stock-low-row" : ""}>{row.getAllCells().map((cell) => <TableCell key={cell.id} className={cell.column.id === "balance" ? "stock-align-right" : ""}><table.FlexRender cell={cell} /></TableCell>)}</TableRow>)}{!filteredRows.length && <TableRow><TableCell colSpan={4} className="stock-empty-cell">No stock balances match these filters.</TableCell></TableRow>}</TableBody></Table></div>}
      <div className="admin-stock-note">Low stock is calculated when balance is below the catalog reorder threshold. Current balances are combined from one request per site; a single cross-site stock report endpoint can replace this client-side merge.</div>
    </CardContent></Card>
  </div>;
}
