"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { records, value } from "@/lib/factory-data";

type Tab = "stock" | "petty-cash" | "turnaround" | "attendance";
type ReportStockRow = { site_name: string; item_name: string; unit: string; balance: number };
type PettyCashBreakdown = { label: string; total_amount: number };
type TurnaroundRow = { site_name: string; avg_turnaround_seconds: number; requisition_count: number };
type AttendanceSummary = { user_name: string; site_name: string; check_in_count: number; check_out_count: number; out_of_geofence_count: number };

function toRfc3339(date: string, nextDay = false) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (nextDay) parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString();
}

function MockBarChart({ rows, label, valueKey }: { rows: Array<{ label: string; value: number; valueKey?: string }>; label: string; valueKey: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <div className="reports-chart" role="img" aria-label={`${label} bar chart`}><div className="reports-chart__bars">{rows.map((row) => <div className="reports-chart__item" key={row.label}><div className="reports-chart__track"><span style={{ height: `${Math.max(4, row.value / max * 100)}%` }} title={`${row.label}: ${row.value}`} /></div><strong>{row.valueKey ?? row.value}</strong><small>{row.label}</small></div>)}</div><div className="reports-chart__axis"><span>{label}</span><span>{valueKey}</span></div></div>;
}

function DataTable<T extends Record<string, string | number>>({ rows, columns }: { rows: T[]; columns: Array<{ key: keyof T; label: string; render?: (value: T[keyof T]) => string }> }) {
  return <div className="stock-table-scroll reports-data-table"><table className="ui-table"><thead className="ui-table__header"><tr>{columns.map((column) => <th className="ui-table__head" key={String(column.key)}>{column.label}</th>)}</tr></thead><tbody className="ui-table__body">{rows.map((row, index) => <tr className="ui-table__row" key={index}>{columns.map((column) => <td className="ui-table__cell" key={String(column.key)}>{column.render ? column.render(row[column.key]) : row[column.key]}</td>)}</tr>)}{!rows.length && <tr><td className="stock-empty-cell" colSpan={columns.length}>No report rows are available.</td></tr>}</tbody></table></div>;
}

export default function AdminReportsPage({ role = "admin" }: { role?: "admin" | "manager" }) {
  const session = useDashboardSession();
  const [tab, setTab] = useState<Tab>("stock");
  const [fromDate, setFromDate] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 29); return date.toISOString().slice(0, 10); });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [groupBy, setGroupBy] = useState("site");
  const tabs: Array<{ id: Tab; label: string }> = [{ id: "stock", label: "Stock" }, { id: "petty-cash", label: "Petty Cash" }, { id: "turnaround", label: "Requisition Turnaround" }, { id: "attendance", label: "Attendance" }];
  const from = toRfc3339(fromDate);
  const to = toRfc3339(toDate, true);
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate);
  const reportQuery = useQuery({ queryKey: ["admin-report", role, tab, from, to, groupBy], queryFn: async () => {
    const query = tab === "stock" ? "" : tab === "petty-cash" ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&group_by=${encodeURIComponent(groupBy)}` : tab === "turnaround" ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const path = tab === "stock" ? "/reports/stock" : tab === "petty-cash" ? `/reports/petty-cash${query}` : tab === "turnaround" ? `/reports/requisitions/turnaround${query}` : `/reports/attendance${query}`;
    return records(await apiGet<unknown>(path, session!.token));
  }, enabled: Boolean(session?.token && (session.role === "admin" || session.role === "manager" || session.role === "factory_manager") && !invalidRange), staleTime: 60_000, retry: false });
  const reportRows = useMemo(() => reportQuery.data ?? [], [reportQuery.data]);
  const stockRows = useMemo<ReportStockRow[]>(() => reportRows.map((row) => ({ site_name: String(value(row, "site_name") ?? "—"), item_name: String(value(row, "item_name") ?? "—"), unit: String(value(row, "unit") ?? "—"), balance: Number(value(row, "balance") ?? 0) })), [reportRows]);
  const pettyRows = useMemo<PettyCashBreakdown[]>(() => reportRows.map((row) => ({ label: String(value(row, groupBy) ?? "—"), total_amount: Number(value(row, "total_amount") ?? 0) })), [groupBy, reportRows]);
  const turnaroundRows = useMemo<TurnaroundRow[]>(() => reportRows.map((row) => ({ site_name: String(value(row, "site_name") ?? "—"), avg_turnaround_seconds: Number(value(row, "avg_turnaround_seconds") ?? 0), requisition_count: Number(value(row, "requisition_count") ?? 0) })), [reportRows]);
  const attendanceRows = useMemo<AttendanceSummary[]>(() => reportRows.map((row) => ({ user_name: String(value(row, "user_name") ?? "—"), site_name: String(value(row, "site_name") ?? "—"), check_in_count: Number(value(row, "check_in_count") ?? 0), check_out_count: Number(value(row, "check_out_count") ?? 0), out_of_geofence_count: Number(value(row, "out_of_geofence_count") ?? 0) })), [reportRows]);
  const stockChart = [...new Set(stockRows.map((row) => row.site_name))].map((site) => ({ label: site, value: stockRows.filter((row) => row.site_name === site).reduce((sum, row) => sum + row.balance, 0) }));
  const turnaroundChart = turnaroundRows.map((row) => ({ label: row.site_name, value: Math.round(row.avg_turnaround_seconds / 3600) }));
  return <div className="admin-management-page admin-reports-page">
    <div className="reports-heading"><div><div className="dashboard-page-heading__eyebrow">{role === "manager" ? "MANAGER / ANALYTICS" : "ADMIN / ANALYTICS"}</div><h1>Reports</h1><p>Explore organization activity for a selected date range.</p></div><span className="attendance-heading__range">Analytics workspace</span></div>
    <Alert className="reports-pending-banner"><span className="reports-pending-banner__icon" aria-hidden="true">i</span><span>Reports are live and use the selected date range. Stock balances are current system totals.</span></Alert>
    <div className="reports-controls"><div className="reports-controls__copy"><strong>Report period</strong><span>Choose the period used for the selected report.</span></div><div className="reports-controls__fields"><label className="attendance-date-field"><span>From</span><input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></label><label className="attendance-date-field"><span>To</span><input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></label></div></div>
    <div className="reports-tabs" role="tablist" aria-label="Report categories">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
    {invalidRange ? <Alert variant="destructive">The start date must be on or before the end date.</Alert> : reportQuery.isError ? <Alert variant="destructive" className="factory-stock-alert">Report data could not be loaded: {reportQuery.error.message}<button type="button" onClick={() => void reportQuery.refetch()}>Retry</button></Alert> : reportQuery.isLoading ? <Card className="reports-panel"><CardContent className="reports-loading"><Skeleton /><Skeleton /><Skeleton /></CardContent></Card> : tab === "stock" ? <Card className="factory-stock-card reports-panel"><CardContent className="factory-stock-card__content"><div className="reports-panel-heading"><div><h2>Stock by site</h2><p>Current combined balances for active sites and items.</p></div></div><MockBarChart label="Total balance" valueKey="units" rows={stockChart.map((row) => ({ ...row, valueKey: `${row.value.toLocaleString()} units` }))} /><DataTable rows={stockRows} columns={[{ key: "site_name", label: "Site" }, { key: "item_name", label: "Item" }, { key: "unit", label: "Unit" }, { key: "balance", label: "Balance" }]} /></CardContent></Card> : tab === "petty-cash" ? <Card className="factory-stock-card reports-panel"><CardContent className="factory-stock-card__content"><div className="reports-panel-heading"><div><h2>Petty cash breakdown</h2><p>Approved amounts grouped by the selected dimension.</p></div></div><label className="ticket-filter reports-group-filter"><span>Group by</span><select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}><option value="site">Site</option><option value="month">Month</option><option value="category">Category</option></select></label><MockBarChart label="Amount" valueKey="INR" rows={pettyRows.map((row) => ({ label: row.label, value: row.total_amount, valueKey: `₹${row.total_amount.toLocaleString()}` }))} /><DataTable rows={pettyRows} columns={[{ key: "label", label: groupBy[0].toUpperCase() + groupBy.slice(1) }, { key: "total_amount", label: "Total Amount", render: (amount) => Number(amount).toLocaleString(undefined, { style: "currency", currency: "INR" }) }]} /></CardContent></Card> : tab === "turnaround" ? <Card className="factory-stock-card reports-panel"><CardContent className="factory-stock-card__content"><div className="reports-panel-heading"><div><h2>Average requisition turnaround</h2><p>Average submitted-to-closed time by site.</p></div></div><MockBarChart label="Average turnaround" valueKey="hours" rows={turnaroundChart.map((row) => ({ ...row, valueKey: `${row.value}h` }))} /><DataTable rows={turnaroundRows} columns={[{ key: "site_name", label: "Site" }, { key: "avg_turnaround_seconds", label: "Average Hours", render: (seconds) => `${(Number(seconds) / 3600).toFixed(1)} hrs` }, { key: "requisition_count", label: "Requisitions" }]} /></CardContent></Card> : <Card className="factory-stock-card reports-panel"><CardContent className="factory-stock-card__content"><div className="reports-panel-heading"><div><h2>Attendance summary</h2><p>Check-ins, check-outs, and geofence exceptions.</p></div></div><DataTable rows={attendanceRows} columns={[{ key: "user_name", label: "User" }, { key: "site_name", label: "Site" }, { key: "check_in_count", label: "Check-ins" }, { key: "check_out_count", label: "Check-outs" }, { key: "out_of_geofence_count", label: "Outside geofence" }]} /></CardContent></Card>}
    <div className="reports-note"><strong>Selected range</strong><span>{fromDate} to {toDate}. Reports are loaded from the server.</span></div>
  </div>;
}
