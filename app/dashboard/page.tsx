"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSession } from "@/components/dashboard-session";
import { useHubSite } from "@/hooks/use-hub-site";
import { apiGet } from "@/lib/api";

type StockBalance = { item_id: string; item_name: string; unit: string; balance: number };
type InventoryItem = { ID: string; Name: string; ReorderThreshold: number | null };
type DispatchTicket = { Status?: string; DispatchedAt?: string | null };

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && "items" in value && Array.isArray(value.items)) {
    return value.items as T[];
  }
  return [];
}

function StatIcon({ name }: { name: "boxes" | "warning" | "truck" }) {
  if (name === "boxes") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.8 7.5 4.4 7.5-4.4M12 12.5V21" /></svg>;
  if (name === "warning") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10.3 4.3-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-2.7l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h11v12H3zM14 9h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" /></svg>;
}

function NavigationIcon({ name }: { name: string }) {
  const icons: Record<string, ReactNode> = {
    stock: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.8 7.5 4.4 7.5-4.4M12 12.5V21" /></>,
    inflow: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
    requisition: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" /></>,
    dispatch: <><path d="M3 5h11v12H3zM14 9h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function StatCard({
  title,
  icon,
  value,
  detail,
  loading,
  error,
}: {
  title: string;
  icon: "boxes" | "warning" | "truck";
  value?: number;
  detail: string;
  loading: boolean;
  error?: string;
}) {
  return (
    <Card className="stat-card">
      <CardContent className="stat-card__body">
        <div className={`stat-card__icon stat-card__icon--${icon}`}><StatIcon name={icon} /></div>
        <div className="stat-card__label">{title}</div>
        {loading ? <><Skeleton className="stat-skeleton__value" /><Skeleton className="stat-skeleton__detail" /></> : error ? <Alert variant="destructive" className="stat-card__error">{error}</Alert> : <><div className="stat-card__value">{value ?? 0}</div><div className="stat-card__detail">{detail}</div></>}
      </CardContent>
    </Card>
  );
}

const destinations = [
  { title: "Factory Stock", description: "Review hub inventory levels and item availability.", href: "/factory/stock", icon: "stock", label: "INVENTORY" },
  { title: "Log Incoming Stock", description: "Record new stock received from production or external sources.", href: "/factory/stock/log", icon: "inflow", label: "STOCK INTAKE" },
  { title: "Requisitions Awaiting Dispatch", description: "Review approved site requests ready to be fulfilled.", href: "/factory/requisitions", icon: "requisition", label: "REQUESTS" },
  { title: "Dispatch Tickets", description: "Track dispatches and keep materials moving to site.", href: "/factory/tickets", icon: "dispatch", label: "DELIVERY" },
];

export default function FactoryManagerDashboard() {
  const session = useDashboardSession();
  const { hubSite, hubSiteId, isLoading: hubLoading, isError: hubError, error: hubQueryError } = useHubSite();
  const token = session?.token;
  const hasAccess = session?.role === "factory_manager" || session?.role === "admin";

  const stockQuery = useQuery({
    queryKey: ["factory-dashboard", "hub-stock", hubSiteId],
    queryFn: async () => asArray<StockBalance>(await apiGet<unknown>(`/inventory/stock/site/${hubSiteId}`, token!)),
    enabled: Boolean(token && hubSiteId && hasAccess),
    retry: false,
  });

  const itemsQuery = useQuery({
    queryKey: ["factory-dashboard", "inventory-items"],
    queryFn: async () => asArray<InventoryItem>(await apiGet<unknown>("/inventory-items", token!)),
    enabled: Boolean(token && hasAccess),
    retry: false,
  });

  const ticketsQuery = useQuery({
    queryKey: ["factory-dashboard", "dispatched-today"],
    queryFn: async () => asArray<DispatchTicket>(await apiGet<unknown>("/dispatch-tickets?status=dispatched", token!)),
    enabled: Boolean(token && hasAccess),
    retry: false,
  });

  const hubMissing = !hubLoading && !hubError && !hubSite;
  const stockError = hubError
    ? hubQueryError instanceof Error ? hubQueryError.message : "Could not load hub site."
    : hubMissing
      ? "No hub site is configured."
      : stockQuery.isError
        ? stockQuery.error instanceof Error ? stockQuery.error.message : "Could not load stock."
        : undefined;
  const itemStockCount = stockQuery.data
    ? new Set(stockQuery.data.filter((row) => row.balance > 0).map((row) => row.item_id)).size
    : 0;

  const itemsById = new Map((itemsQuery.data ?? []).map((item) => [item.ID, item]));
  const lowStockCount = stockQuery.data
    ? new Set(stockQuery.data.filter((row) => {
        const threshold = itemsById.get(row.item_id)?.ReorderThreshold;
        return typeof threshold === "number" && row.balance < threshold;
      }).map((row) => row.item_id)).size
    : 0;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const dispatchedToday = (ticketsQuery.data ?? []).filter((ticket) => {
    const timestamp = ticket.DispatchedAt ? new Date(ticket.DispatchedAt).getTime() : NaN;
    return ticket.Status?.toLowerCase() === "dispatched" && timestamp >= startOfToday && timestamp < startOfTomorrow;
  }).length;

  if (!hasAccess) {
    return <div className="factory-dashboard"><div className="dashboard-page-heading"><div><div className="dashboard-page-heading__eyebrow">FACTORY OPERATIONS</div><h1>Factory overview</h1><p>Your hub stock and dispatch activity, all in one place.</p></div></div><Alert variant="destructive" className="dashboard-full-alert">This dashboard is available to Factory Managers and administrators.</Alert></div>;
  }

  return (
    <div className="factory-dashboard">
      <div className="dashboard-page-heading">
        <div>
          <div className="dashboard-page-heading__eyebrow">FACTORY OPERATIONS</div>
          <h1>Factory overview</h1>
          <p>Your hub stock and dispatch activity, all in one place.</p>
        </div>
      <div className="dashboard-date"><span className="dashboard-date__dot" /> LIVE OVERVIEW <span className="dashboard-date__separator">·</span> TODAY</div>
      </div>

      {hubError && <Alert variant="destructive" className="dashboard-full-alert">Hub site could not be loaded: {hubQueryError instanceof Error ? hubQueryError.message : "Please try again."}</Alert>}
      {hubMissing && <Alert variant="destructive" className="dashboard-full-alert">No site is marked as the hub. Mark a site with <code>is_hub: true</code> to load factory stock.</Alert>}

      <section className="dashboard-stats" aria-label="Factory key metrics">
        <StatCard title="Distinct Items in Stock" icon="boxes" value={itemStockCount} detail={hubSite ? `${hubSite.name} · positive balance` : "Items with a positive balance"} loading={hubLoading || stockQuery.isLoading} error={stockError} />
        <StatCard title="Low Stock Items" icon="warning" value={lowStockCount} detail="Below their reorder threshold" loading={hubLoading || stockQuery.isLoading || itemsQuery.isLoading} error={stockError || (itemsQuery.isError ? itemsQuery.error.message : undefined)} />
        <StatCard title="Tickets Dispatched Today" icon="truck" value={dispatchedToday} detail="Based on local dispatch date" loading={ticketsQuery.isLoading} error={ticketsQuery.isError ? ticketsQuery.error.message : undefined} />
      </section>

      <div className="dashboard-section-heading"><div><span className="dashboard-page-heading__eyebrow">QUICK ACCESS</span><h2>Factory workspace</h2></div><span className="dashboard-section-heading__hint">Choose a workspace to get started</span></div>

      <section className="dashboard-shortcuts" aria-label="Factory workspace links">
        {destinations.map((destination, index) => (
          <Link href={destination.href} className="dashboard-shortcut-link" key={destination.href}>
            <Card className="dashboard-shortcut">
              <CardContent className="dashboard-shortcut__body">
                <div className="dashboard-shortcut__top"><span className="dashboard-shortcut__icon"><NavigationIcon name={destination.icon} /></span><span className="dashboard-shortcut__index">0{index + 1}</span></div>
                <div className="dashboard-shortcut__label">{destination.label}</div>
                <h3>{destination.title}</h3>
                <p>{destination.description}</p>
                <span className="dashboard-shortcut__action">Open workspace <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {ticketsQuery.isSuccess && <p className="dashboard-data-caption">Dispatch activity uses the dispatched timestamp and your local timezone.</p>}
    </div>
  );
}
