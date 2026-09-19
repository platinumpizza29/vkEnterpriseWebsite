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
import { useMemo } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDashboardSession } from "@/components/dashboard-session";
import { useHubSite } from "@/hooks/use-hub-site";
import { apiGet } from "@/lib/api";

type InventoryItem = {
  ID?: string;
  id?: string;
  Name?: string;
  name?: string;
  Code?: string;
  Unit?: string;
  unit?: string;
  Category?: string;
  ReorderThreshold?: number | null;
};

type SiteStock = { site_id?: string; item_id?: string; balance?: number };

type StockLedgerEntry = {
  id: string;
  occurredAt: string;
  timestamp: number;
  movementType: string;
  movementLabel: string;
  quantity: number;
  loggedBy: string;
};

const historyFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["items", "data", "history", "entries", "ledger"]) {
    if (Array.isArray(record[key])) return record[key] as T[];
  }
  return [];
}

function field(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

const movementLabels: Record<string, string> = {
  factory_inflow: "Stock Added",
  dispatch_out: "Dispatched to Site",
  dispatch_in: "Received at Site",
  consumption: "Consumed",
};

function normalizeLedger(payload: unknown): StockLedgerEntry[] {
  return asArray<Record<string, unknown>>(payload).map((entry, index) => {
    const rawType = String(field(entry, "MovementType", "movement_type", "TransactionType", "transaction_type", "Type", "type", "Action", "action") ?? "unknown");
    const movementType = rawType.toLowerCase().trim().replace(/[\s-]+/g, "_");
    const rawDate = String(field(entry, "CreatedAt", "created_at", "OccurredAt", "occurred_at", "Timestamp", "timestamp", "Date", "date") ?? "");
    const timestamp = Date.parse(rawDate);
    const quantity = Number(field(entry, "Quantity", "quantity", "Amount", "amount") ?? 0);
    const loggedByValue = field(entry, "LoggedByName", "logged_by_name", "UserName", "user_name", "LoggedBy", "logged_by", "CreatedBy", "created_by", "UserID", "user_id");
    const loggedBy = loggedByValue && typeof loggedByValue === "object"
      ? String(field(loggedByValue as Record<string, unknown>, "Name", "name", "Email", "email") ?? "—")
      : String(loggedByValue ?? "—");

    return {
      id: String(field(entry, "ID", "id", "TransactionID", "transaction_id") ?? `${rawDate}-${index}`),
      occurredAt: rawDate,
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
      movementType,
      movementLabel: movementLabels[movementType] ?? rawType.replace(/[_-]+/g, " ").replace(/^\w/, (letter) => letter.toUpperCase()),
      quantity: Number.isFinite(quantity) ? quantity : 0,
      loggedBy,
    };
  }).sort((left, right) => right.timestamp - left.timestamp);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function signedQuantity(entry: StockLedgerEntry) {
  const absolute = Math.abs(entry.quantity).toLocaleString();
  if (["factory_inflow", "dispatch_in"].includes(entry.movementType)) return `+${absolute}`;
  if (["dispatch_out", "consumption"].includes(entry.movementType)) return `−${absolute}`;
  return entry.quantity < 0 ? `−${absolute}` : `+${absolute}`;
}

function HistoryTable({ entries }: { entries: StockLedgerEntry[] }) {
  const columns: Array<ColumnDef<typeof historyFeatures, StockLedgerEntry>> = useMemo(() => [
    {
      id: "date",
      accessorFn: (entry) => entry.timestamp,
      header: "Date",
      cell: (info) => <span className="ledger-date">{formatDate(info.row.original.occurredAt)}</span>,
      sortFn: "basic",
    },
    {
      id: "movement",
      accessorFn: (entry) => entry.movementLabel,
      header: "Movement Type",
      cell: (info) => <span className={`ledger-movement ledger-movement--${info.row.original.movementType}`}><i />{info.row.original.movementLabel}</span>,
      enableSorting: false,
    },
    {
      id: "quantity",
      accessorFn: (entry) => entry.quantity,
      header: () => <span className="ledger-align-right">Quantity</span>,
      cell: (info) => <span className={`ledger-quantity${info.row.original.quantity < 0 || ["dispatch_out", "consumption"].includes(info.row.original.movementType) ? " ledger-quantity--out" : " ledger-quantity--in"}`}>{signedQuantity(info.row.original)}</span>,
      enableSorting: false,
    },
    {
      id: "logged_by",
      accessorFn: (entry) => entry.loggedBy,
      header: "Logged By",
      cell: (info) => <span className="ledger-user">{info.row.original.loggedBy}</span>,
      enableSorting: false,
    },
  ], []);

  const table = useTable({
    features: historyFeatures,
    columns,
    data: entries,
    enableSortingRemoval: false,
    initialState: { sorting: [{ id: "date", desc: true }] },
  });

  return (
    <div className="stock-table-scroll ledger-table-scroll">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => <TableHead key={header.id} className={header.column.id === "quantity" ? "ledger-align-right" : ""}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>)}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => <TableCell key={cell.id} className={cell.column.id === "quantity" ? "ledger-align-right" : ""}><table.FlexRender cell={cell} /></TableCell>)}
            </TableRow>
          ))}
          {entries.length === 0 && <TableRow><TableCell className="stock-empty-cell" colSpan={4}>No stock movements have been recorded for this item.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

export default function StockItemDetail({ itemId }: { itemId: string }) {
  const session = useDashboardSession();
  const { hubSite, hubSiteId, isLoading: hubLoading, isError: hubError, error: hubErrorValue } = useHubSite();
  const hasAccess = session?.role === "factory_manager" || session?.role === "admin";
  const validItemId = Boolean(itemId && itemId !== "undefined" && itemId !== "null");
  const accessReady = Boolean(session?.token && hasAccess && validItemId && hubSiteId);

  const itemQuery = useQuery({
    queryKey: ["inventory-item", itemId],
    queryFn: () => apiGet<InventoryItem>(`/inventory-items/${encodeURIComponent(itemId)}`, session!.token),
    enabled: Boolean(session?.token && hasAccess && validItemId),
    retry: false,
  });

  const stockQuery = useQuery({
    queryKey: ["factory-stock-detail", hubSiteId, itemId],
    queryFn: () => apiGet<SiteStock>(`/inventory/stock/site/${hubSiteId}/item/${encodeURIComponent(itemId)}`, session!.token),
    enabled: accessReady,
    retry: false,
  });

  const historyQuery = useQuery({
    queryKey: ["factory-stock-history", hubSiteId, itemId],
    queryFn: async () => normalizeLedger(await apiGet<unknown>(`/inventory/stock/site/${hubSiteId}/item/${encodeURIComponent(itemId)}/history`, session!.token)),
    enabled: accessReady,
    retry: false,
  });

  const itemName = itemQuery.data?.Name ?? itemQuery.data?.name ?? "Stock item details";
  const itemUnit = itemQuery.data?.Unit ?? itemQuery.data?.unit ?? "";
  const isLoading = hubLoading || itemQuery.isLoading || stockQuery.isLoading || historyQuery.isLoading;
  const threshold = itemQuery.data?.ReorderThreshold;
  const currentBalance = stockQuery.data?.balance;
  const isLowStock = typeof threshold === "number" && typeof currentBalance === "number" && currentBalance < threshold;

  if (!hasAccess) return <div className="stock-detail-page"><Alert variant="destructive">Factory Manager or administrator access is required to view hub stock.</Alert></div>;
  if (!validItemId) return <div className="stock-detail-page"><Alert variant="destructive" className="factory-stock-alert">This stock item has no valid item ID. Return to the stock list and choose another item.</Alert><Link className="factory-stock-back-link" href="/factory/stock">Back to factory stock</Link></div>;

  return (
    <div className="stock-detail-page">
      <div className="stock-detail-breadcrumb"><Link href="/factory/stock">Factory stock</Link><span>/</span><span>{itemName}</span></div>

      {(hubError || itemQuery.isError || stockQuery.isError) && <Alert variant="destructive" className="factory-stock-alert">{hubError ? `Could not load hub site: ${hubErrorValue instanceof Error ? hubErrorValue.message : "Please try again."}` : itemQuery.isError ? itemQuery.error.message : stockQuery.error?.message || "Could not load this item’s stock balance."}</Alert>}
      {!hubLoading && !hubError && !hubSite && <Alert variant="destructive" className="factory-stock-alert">No hub site is configured.</Alert>}

      <header className="stock-detail-header">
        <div className="stock-detail-title">
          <div className="dashboard-page-heading__eyebrow">ITEM INVENTORY / {itemQuery.data?.Code || "STOCK DETAIL"}</div>
          {isLoading ? <Skeleton className="stock-detail-name-skeleton" /> : <h1>{itemName}<span>{itemUnit}</span></h1>}
          <p>{hubSite?.name || "Hub site"} inventory ledger</p>
        </div>
        <Card className="stock-balance-card">
          <CardContent className="stock-balance-card__content">
            <span>Current balance</span>
            {isLoading ? <Skeleton className="stock-balance-skeleton" /> : <strong>{currentBalance ?? "—"}<small>{itemUnit}</small></strong>}
            {!isLoading && <span className={`stock-status${isLowStock ? " stock-status--low" : " stock-status--ok"}`}><i />{isLowStock ? "Low Stock" : "In Stock"}</span>}
          </CardContent>
        </Card>
      </header>

      <Card className="factory-stock-card ledger-card">
        <CardContent className="factory-stock-card__content">
          <div className="factory-stock-toolbar ledger-toolbar"><div className="factory-stock-toolbar__copy"><h2>Stock movement history</h2><p>Latest transactions appear first<span>{!historyQuery.isLoading && historyQuery.data ? ` · ${historyQuery.data.length} entries` : ""}</span></p></div></div>
          {historyQuery.isError ? <Alert variant="destructive" className="ledger-error">History could not be loaded: {historyQuery.error.message}</Alert> : historyQuery.isLoading ? <div className="stock-table-skeleton"><div className="stock-table-skeleton__row"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>{Array.from({ length: 4 }, (_, index) => <div className="stock-table-skeleton__row" key={index}><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>)}</div> : <HistoryTable entries={historyQuery.data ?? []} />}
        </CardContent>
      </Card>

      <Link className="factory-stock-back-link" href="/factory/stock"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16 10H4m5-5-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> Back to factory stock</Link>
    </div>
  );
}
