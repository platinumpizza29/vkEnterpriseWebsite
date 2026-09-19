"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

type Tab = "stock" | "petty-cash" | "turnaround" | "attendance";
type ReportStockRow = { site_name: string; item_name: string; unit: string; balance: number };
type PettyCashBreakdown = { label: string; total_amount: number };
type TurnaroundRow = { site_name: string; avg_turnaround_seconds: number; requisition_count: number };
type AttendanceSummary = { user_name: string; site_name: string; check_in_count: number; check_out_count: number; out_of_geofence_count: number };

// Pending backend: future GET /reports/stock response shape is modeled here for the UI.
const mockStock: ReportStockRow[] = [{ site_name: "Factory Hub", item_name: "Cement", unit: "bags", balance: 420 }, { site_name: "Factory Hub", item_name: "Steel Rod", unit: "pcs", balance: 180 }, { site_name: "North Site", item_name: "Cement", unit: "bags", balance: 86 }, { site_name: "North Site", item_name: "Steel Rod", unit: "pcs", balance: 62 }, { site_name: "South Site", item_name: "Cement", unit: "bags", balance: 124 }, { site_name: "South Site", item_name: "Steel Rod", unit: "pcs", balance: 93 }];
// Pending backend: future GET /reports/petty-cash response is modeled here for every group_by selection.
const mockCash: Record<string, PettyCashBreakdown[]> = { site: [{ label: "North Site", total_amount: 18400 }, { label: "South Site", total_amount: 12650 }, { label: "Factory Hub", total_amount: 8200 }], month: [{ label: "Jun 2026", total_amount: 14500 }, { label: "Jul 2026", total_amount: 19100 }, { label: "Aug 2026", total_amount: 15650 }], category: [{ label: "Transport", total_amount: 12100 }, { label: "Supplies", total_amount: 18400 }, { label: "Meals", total_amount: 8750 }] };
// Pending backend: future GET /reports/requisitions/turnaround response shape is modeled here for the UI.
const mockTurnaround: TurnaroundRow[] = [{ site_name: "North Site", avg_turnaround_seconds: 86400, requisition_count: 18 }, { site_name: "South Site", avg_turnaround_seconds: 129600, requisition_count: 14 }, { site_name: "Factory Hub", avg_turnaround_seconds: 57600, requisition_count: 21 }];
// Pending backend: future GET /reports/attendance response shape is modeled here for the UI.
const mockAttendance: AttendanceSummary[] = [{ user_name: "Aarav Shah", site_name: "North Site", check_in_count: 19, check_out_count: 18, out_of_geofence_count: 1 }, { user_name: "Meera Patel", site_name: "South Site", check_in_count: 17, check_out_count: 17, out_of_geofence_count: 0 }, { user_name: "Rohan Desai", site_name: "Factory Hub", check_in_count: 22, check_out_count: 21, out_of_geofence_count: 2 }];

function MockBarChart({ rows, label, valueKey }: { rows: Array<{ label: string; value: number; valueKey?: string }>; label: string; valueKey: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <div className="reports-chart" role="img" aria-label={`${label} bar chart`}><div className="reports-chart__bars">{rows.map((row) => <div className="reports-chart__item" key={row.label}><div className="reports-chart__track"><span style={{ height: `${Math.max(4, row.value / max * 100)}%` }} title={`${row.label}: ${row.value}`} /></div><strong>{row.valueKey ?? row.value}</strong><small>{row.label}</small></div>)}</div><div className="reports-chart__axis"><span>{label}</span><span>{valueKey}</span></div></div>;
}

function DataTable<T extends Record<string, string | number>>({ rows, columns }: { rows: T[]; columns: Array<{ key: keyof T; label: string; render?: (value: T[keyof T]) => string }> }) {
  return <div className="stock-table-scroll"><table className="ui-table"><thead className="ui-table__header"><tr>{columns.map((column) => <th className="ui-table__head" key={String(column.key)}>{column.label}</th>)}</tr></thead><tbody className="ui-table__body">{rows.map((row, index) => <tr className="ui-table__row" key={index}>{columns.map((column) => <td className="ui-table__cell" key={String(column.key)}>{column.render ? column.render(row[column.key]) : row[column.key]}</td>)}</tr>)}{!rows.length && <tr><td className="stock-empty-cell" colSpan={columns.length}>No report rows are available.</td></tr>}</tbody></table></div>;
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState<Tab>("stock");
  const [fromDate, setFromDate] = useState("2026-06-01");
  const [toDate, setToDate] = useState("2026-08-31");
  const [groupBy, setGroupBy] = useState("site");
  const tabs: Array<{ id: Tab; label: string }> = [{ id: "stock", label: "Stock" }, { id: "petty-cash", label: "Petty Cash" }, { id: "turnaround", label: "Requisition Turnaround" }, { id: "attendance", label: "Attendance" }];
  const stockChart = [...new Set(mockStock.map((row) => row.site_name))].map((site) => ({ label: site, value: mockStock.filter((row) => row.site_name === site).reduce((sum, row) => sum + row.balance, 0) }));
  const pettyRows = mockCash[groupBy];
  const turnaroundChart = mockTurnaround.map((row) => ({ label: row.site_name, value: Math.round(row.avg_turnaround_seconds / 3600) }));
  return <div className="admin-management-page admin-reports-page">
    <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">ADMIN / ANALYTICS</div><h1>Reports</h1><p>Explore organization activity for a selected date range.</p></div></div>
    <Alert className="reports-pending-banner">Report data is using illustrative placeholder values until the report endpoints are available.</Alert>
    <div className="reports-controls"><label className="attendance-date-field"><span>From</span><input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></label><label className="attendance-date-field"><span>To</span><input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></label></div>
    <div className="reports-tabs" role="tablist" aria-label="Report categories">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
    {tab === "stock" && <Card className="factory-stock-card"><CardContent className="factory-stock-card__content"><div className="reports-panel-heading"><div><h2>Stock by site</h2><p>Illustrative combined balances for the selected period.</p></div><span className="reports-pending-tag">Pending backend</span></div><MockBarChart label="Total balance" valueKey="units" rows={stockChart.map((row) => ({ ...row, valueKey: `${row.value.toLocaleString()} units` }))} /><DataTable rows={mockStock} columns={[{ key: "site_name", label: "Site" }, { key: "item_name", label: "Item" }, { key: "unit", label: "Unit" }, { key: "balance", label: "Balance" }]} /></CardContent></Card>}
    {tab === "petty-cash" && <Card className="factory-stock-card"><CardContent className="factory-stock-card__content"><div className="reports-panel-heading"><div><h2>Petty cash breakdown</h2><p>Approved amounts grouped by the selected dimension.</p></div><span className="reports-pending-tag">Pending backend</span></div><label className="ticket-filter reports-group-filter"><span>Group by</span><select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}><option value="site">Site</option><option value="month">Month</option><option value="category">Category</option></select></label><MockBarChart label="Amount" valueKey="INR" rows={pettyRows.map((row) => ({ label: row.label, value: row.total_amount, valueKey: `₹${row.total_amount.toLocaleString()}` }))} /><DataTable rows={pettyRows} columns={[{ key: "label", label: groupBy[0].toUpperCase() + groupBy.slice(1) }, { key: "total_amount", label: "Total Amount", render: (amount) => Number(amount).toLocaleString(undefined, { style: "currency", currency: "INR" }) }]} /></CardContent></Card>}
    {tab === "turnaround" && <Card className="factory-stock-card"><CardContent className="factory-stock-card__content"><div className="reports-panel-heading"><div><h2>Average requisition turnaround</h2><p>Average submitted-to-closed time by site.</p></div><span className="reports-pending-tag">Pending backend</span></div><MockBarChart label="Average turnaround" valueKey="hours" rows={turnaroundChart.map((row) => ({ ...row, valueKey: `${row.value}h` }))} /><DataTable rows={mockTurnaround} columns={[{ key: "site_name", label: "Site" }, { key: "avg_turnaround_seconds", label: "Average Hours", render: (seconds) => `${(Number(seconds) / 3600).toFixed(1)} hrs` }, { key: "requisition_count", label: "Requisitions" }]} /></CardContent></Card>}
    {tab === "attendance" && <Card className="factory-stock-card"><CardContent className="factory-stock-card__content"><div className="reports-panel-heading"><div><h2>Attendance summary</h2><p>Check-ins, check-outs, and geofence exceptions.</p></div><span className="reports-pending-tag">Pending backend</span></div><DataTable rows={mockAttendance} columns={[{ key: "user_name", label: "User" }, { key: "site_name", label: "Site" }, { key: "check_in_count", label: "Check-ins" }, { key: "check_out_count", label: "Check-outs" }, { key: "out_of_geofence_count", label: "Outside geofence" }]} /></CardContent></Card>}
    <div className="admin-stock-note">Selected range: {fromDate} to {toDate}. Current mock values are structural examples and do not change with the range.</div>
  </div>;
}
