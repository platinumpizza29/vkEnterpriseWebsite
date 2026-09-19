"use client";

import {
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useHubSite } from "@/hooks/use-hub-site";
import { apiGet } from "@/lib/api";

type StockBalance = {
  item_id: string;
  item_name: string;
  unit: string;
  balance: number;
};

type InventoryItem = {
  ID: string;
  Name: string;
  Unit: string;
  ReorderThreshold: number | null;
};

type StockRow = StockBalance & { reorder_threshold: number | null };

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["items", "data", "balances", "stock"]) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
  }
  return [];
}

function valueOf(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function normalizeInventoryItems(payload: unknown): InventoryItem[] {
  return asArray<Record<string, unknown>>(payload).map((item) => {
    const threshold = valueOf(item, "ReorderThreshold", "reorder_threshold", "reorderThreshold");
    return {
      ID: String(valueOf(item, "ID", "id", "item_id", "ItemID") ?? ""),
      Name: String(valueOf(item, "Name", "name", "item_name", "ItemName") ?? ""),
      Unit: String(valueOf(item, "Unit", "unit") ?? ""),
      ReorderThreshold: threshold == null ? null : Number(threshold),
    };
  });
}

function normalizeStockBalances(payload: unknown): StockBalance[] {
  return asArray<Record<string, unknown>>(payload).map((row) => {
    const nestedItem = (valueOf(row, "item", "Item") ?? {}) as Record<string, unknown>;
    return {
      item_id: String(valueOf(row, "item_id", "itemId", "ItemID", "ID", "id") ?? valueOf(nestedItem, "ID", "id", "item_id") ?? ""),
      item_name: String(valueOf(row, "item_name", "itemName", "ItemName", "Name", "name") ?? valueOf(nestedItem, "Name", "name") ?? ""),
      unit: String(valueOf(row, "unit", "Unit") ?? valueOf(nestedItem, "Unit", "unit") ?? ""),
      balance: Number(valueOf(row, "balance", "Balance", "current_balance", "CurrentBalance") ?? 0),
    };
  }).filter((row) => Number.isFinite(row.balance));
}

const stockFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

function StockTable({ data }: { data: StockRow[] }) {
  const router = useRouter();
  const columns: Array<ColumnDef<typeof stockFeatures, StockRow>> = useMemo(() => [
    {
      id: "item_name",
      accessorFn: (row) => row.item_name,
      header: "Item Name",
      cell: (info) => <span className="stock-item-name">{info.row.original.item_name}</span>,
      enableSorting: false,
    },
    {
      id: "unit",
      accessorFn: (row) => row.unit,
      header: "Unit",
      cell: (info) => <span className="stock-unit">{info.row.original.unit || "—"}</span>,
      enableSorting: false,
    },
    {
      id: "balance",
      accessorFn: (row) => row.balance,
      header: ({ column }) => {
        const direction = column.getIsSorted();
        return (
          <button className="stock-sort-button" onClick={column.getToggleSortingHandler()} type="button" aria-label={`Sort by balance${direction ? `, currently ${direction === "asc" ? "ascending" : "descending"}` : ""}`}>
            Current Balance
            <span className={`stock-sort-indicator${direction ? " is-sorted" : ""}`} aria-hidden="true">{direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}</span>
          </button>
        );
      },
      cell: (info) => <span className="stock-balance-value">{Number(info.row.original.balance).toLocaleString()}</span>,
      sortFn: "basic",
      enableSorting: true,
    },
    {
      id: "reorder_threshold",
      accessorFn: (row) => row.reorder_threshold,
      header: "Reorder Threshold",
      cell: (info) => <span className="stock-threshold">{info.row.original.reorder_threshold ?? "—"}</span>,
      enableSorting: false,
    },
    {
      id: "status",
      header: "Status",
      cell: (info) => {
        const { balance, reorder_threshold: threshold } = info.row.original;
        const isLow = typeof threshold === "number" && balance < threshold;
        return <span className={`stock-status${isLow ? " stock-status--low" : " stock-status--ok"}`}><i />{isLow ? "Low Stock" : "OK"}</span>;
      },
      enableSorting: false,
    },
  ], []);

  const table = useTable({
    features: stockFeatures,
    columns,
    data,
    enableSortingRemoval: false,
    initialState: { sorting: [{ id: "balance", desc: false }] },
  });

  return (
    <div className="stock-table-scroll">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id} className={header.column.id === "balance" ? "stock-align-right" : ""}>
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={row.original.item_id ? "stock-clickable-row" : "stock-row-unavailable"}
              tabIndex={row.original.item_id ? 0 : -1}
              aria-label={row.original.item_id ? `View ${row.original.item_name} stock details` : `${row.original.item_name} details unavailable because the item ID is missing`}
              onClick={row.original.item_id ? () => router.push(`/factory/stock/${encodeURIComponent(row.original.item_id)}`) : undefined}
              onKeyDown={(event) => {
                if (row.original.item_id && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  router.push(`/factory/stock/${encodeURIComponent(row.original.item_id)}`);
                }
              }}
            >
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className={cell.column.id === "balance" ? "stock-align-right" : ""}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <TableRow><TableCell className="stock-empty-cell" colSpan={5}>No stock items match your search.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function StockTableSkeleton() {
  return (
    <div className="stock-table-skeleton" aria-label="Loading stock items">
      {Array.from({ length: 6 }, (_, index) => <div className="stock-table-skeleton__row" key={index}><Skeleton /><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>)}
    </div>
  );
}

export default function FactoryStockPage() {
  const session = useDashboardSession();
  const { hubSite, hubSiteId, isLoading: hubLoading, isError: hubError, error: hubQueryError, refetch: refetchHub } = useHubSite();
  const [search, setSearch] = useState("");
  const token = session?.token;
  const hasAccess = session?.role === "factory_manager" || session?.role === "admin";

  const stockQuery = useQuery({
    queryKey: ["factory-stock", hubSiteId],
    queryFn: async () => normalizeStockBalances(await apiGet<unknown>(`/inventory/stock/site/${hubSiteId}`, token!)),
    enabled: Boolean(token && hubSiteId && hasAccess),
    retry: false,
  });

  const inventoryQuery = useQuery({
    queryKey: ["factory-stock", "items"],
    queryFn: async () => normalizeInventoryItems(await apiGet<unknown>("/inventory-items", token!)),
    enabled: Boolean(token && hasAccess),
    retry: false,
  });

  const rows = useMemo(() => {
    const inventoryItems = inventoryQuery.data ?? [];
    const thresholds = new Map(inventoryItems.map((item) => [String(item.ID ?? ""), item.ReorderThreshold]));
    return (stockQuery.data ?? []).map((item) => {
      const stockName = String(item.item_name ?? "").trim().toLocaleLowerCase();
      const matchingItem = stockName
        ? inventoryItems.find((candidate) => String(candidate.Name ?? "").trim().toLocaleLowerCase() === stockName)
        : undefined;
      const itemId = item.item_id || matchingItem?.ID || "";
      return {
        ...item,
        item_id: itemId,
        reorder_threshold: thresholds.get(itemId) ?? null,
      };
    });
  }, [stockQuery.data, inventoryQuery.data]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return rows;
    return rows.filter((item) => String(item.item_name ?? "").toLocaleLowerCase().includes(query));
  }, [rows, search]);

  const noHub = !hubLoading && !hubError && !hubSite;
  const pageLoading = hubLoading || stockQuery.isLoading || inventoryQuery.isLoading;

  if (!hasAccess) {
    return <div className="factory-stock-page"><div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">INVENTORY / HUB STOCK</div><h1>Factory stock</h1><p>View current quantities and reorder levels for items at your hub.</p></div></div><Alert variant="destructive">Factory Manager or administrator access is required to view hub stock.</Alert></div>;
  }

  return (
    <div className="factory-stock-page">
      <div className="factory-stock-heading">
        <div>
          <div className="dashboard-page-heading__eyebrow">INVENTORY / HUB STOCK</div>
          <h1>Factory stock</h1>
          <p>View current quantities and reorder levels for items at your hub.</p>
        </div>
        <Link className="factory-primary-button" href="/factory/stock/log"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4v12m-6-6h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg> Log Stock</Link>
      </div>

      {hubError && <Alert variant="destructive" className="factory-stock-alert"><span>Could not load the hub site: {hubQueryError instanceof Error ? hubQueryError.message : "Please try again."}</span><button type="button" onClick={() => void refetchHub()}>Retry</button></Alert>}
      {noHub && <Alert variant="destructive" className="factory-stock-alert">No site is marked as the hub. Set <code>is_hub: true</code> on a site before viewing factory stock.</Alert>}
      {stockQuery.isError && <Alert variant="destructive" className="factory-stock-alert"><span>Stock could not be loaded: {stockQuery.error.message}</span><button type="button" onClick={() => void stockQuery.refetch()}>Retry</button></Alert>}
      {inventoryQuery.isError && <Alert variant="destructive" className="factory-stock-alert"><span>Reorder thresholds could not be loaded: {inventoryQuery.error.message}</span><button type="button" onClick={() => void inventoryQuery.refetch()}>Retry</button></Alert>}

      <Card className="factory-stock-card">
        <CardContent className="factory-stock-card__content">
          <div className="factory-stock-toolbar">
            <div className="factory-stock-toolbar__copy"><h2>Hub inventory</h2><p>{hubSite?.name || "Hub site"}{!pageLoading && stockQuery.data ? <span> · {rows.length} {rows.length === 1 ? "item" : "items"}</span> : null}</p></div>
            <label className="stock-search"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.75" cy="8.75" r="5.75" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg><input type="search" aria-label="Search items by name" placeholder="Search items…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          </div>
          {pageLoading ? <StockTableSkeleton /> : stockQuery.isError || hubError || noHub ? <div className="stock-table-unavailable">Resolve the issue above to view hub inventory.</div> : <StockTable data={filteredRows} />}
          {!pageLoading && !stockQuery.isError && !hubError && !noHub && <div className="factory-stock-footnote">Balances are updated from the inventory ledger. Select an item to view its details.</div>}
        </CardContent>
      </Card>
      <Link className="factory-stock-back-link" href="/dashboard"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16 10H4m5-5-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> Back to overview</Link>
    </div>
  );
}
