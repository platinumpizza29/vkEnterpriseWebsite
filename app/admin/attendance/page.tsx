"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { createSortedRowModel, rowSortingFeature, sortFns, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSites } from "@/hooks/use-sites";
import { apiGet } from "@/lib/api";
import { formatDate, records, value } from "@/lib/factory-data";

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns });
const EMPTY_SITES: { id: string; name: string }[] = [];
type AttendanceRow = { key: string; userId: string; userName: string; siteId: string; siteName: string; checkType: "In" | "Out"; timestamp: string; withinGeofence: boolean };
function normalizeAttendance(payload: unknown, siteId: string, siteName: string, userNames: Map<string, string>): AttendanceRow[] {
  return records(payload).flatMap((record, index) => {
    const userId = String(value(record, "user_id", "UserID", "userId") ?? "");
    const userName = String(value(record, "user_name", "UserName", "name") ?? userNames.get(userId) ?? "Unknown user");
    const actualSite = String(value(record, "site_id", "SiteID", "siteId") ?? siteId);
    const actualSiteName = String(value(record, "site_name", "SiteName") ?? siteName);
    const rows: AttendanceRow[] = [];
    const checkIn = String(value(record, "check_in_at", "CheckInAt") ?? "");
    const checkOut = String(value(record, "check_out_at", "CheckOutAt") ?? "");
    const inOut = value(record, "check_in_out_of_geofence", "CheckInOutOfGeofence");
    const outOut = value(record, "check_out_out_of_geofence", "CheckOutOutOfGeofence");
    const inWithin = value(record, "check_in_within_geofence", "within_geofence", "WithinGeofence");
    const outWithin = value(record, "check_out_within_geofence");
    if (checkIn) rows.push({ key: `${value(record, "id", "ID") ?? index}-in`, userId, userName, siteId: actualSite, siteName: actualSiteName, checkType: "In", timestamp: checkIn, withinGeofence: typeof inWithin === "boolean" ? inWithin : !(inOut === true || inOut === 1 || inOut === "true") });
    if (checkOut) rows.push({ key: `${value(record, "id", "ID") ?? index}-out`, userId, userName, siteId: actualSite, siteName: actualSiteName, checkType: "Out", timestamp: checkOut, withinGeofence: typeof outWithin === "boolean" ? outWithin : !(outOut === true || outOut === 1 || outOut === "true") });
    return rows;
  });
}
function toRfc3339(date: string, nextDay = false) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (nextDay) parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString();
}

export default function AdminAttendancePage() {
  const session = useDashboardSession();
  const sitesQuery = useSites();
  const [siteFilter, setSiteFilter] = useState("all");
  const [fromDate, setFromDate] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 29); return date.toISOString().slice(0, 10); });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const sites = sitesQuery.data ?? EMPTY_SITES;
  const usersQuery = useQuery({ queryKey: ["admin-attendance-users"], queryFn: async () => records(await apiGet<unknown>("/users", session!.token)), enabled: Boolean(session?.token && session.role === "admin"), staleTime: 5 * 60_000, retry: false });
  const userNames = useMemo(() => new Map((usersQuery.data ?? []).map((user) => [String(value(user, "id", "ID") ?? ""), String(value(user, "name", "Name") ?? "Unknown user")])), [usersQuery.data]);
  const from = toRfc3339(fromDate);
  const to = toRfc3339(toDate, true);
  const attendanceQueries = useQueries({ queries: sites.filter((site) => siteFilter === "all" || site.id === siteFilter).map((site) => ({ queryKey: ["admin-attendance", site.id, from, to], queryFn: async () => ({ siteId: site.id, siteName: site.name, payload: await apiGet<unknown>(`/attendance/site/${encodeURIComponent(site.id)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, session!.token) }), enabled: Boolean(session?.token && session.role === "admin" && fromDate && toDate && fromDate <= toDate), staleTime: 60_000, retry: false })) });
  const rows = useMemo(() => attendanceQueries.flatMap((query) => query.data ? normalizeAttendance(query.data.payload, query.data.siteId, query.data.siteName, userNames) : []), [attendanceQueries, userNames]);
  const columns: Array<ColumnDef<typeof features, AttendanceRow>> = useMemo(() => [
    { id: "user", accessorFn: (row) => row.userName, header: "User Name", cell: (info) => <span className="admin-table-primary">{info.row.original.userName}</span> },
    { id: "site", accessorFn: (row) => row.siteName, header: "Site", cell: (info) => info.row.original.siteName },
    { id: "type", accessorFn: (row) => row.checkType, header: "Check Type", cell: (info) => <span className={`attendance-check-type is-${info.row.original.checkType.toLowerCase()}`}>{info.row.original.checkType}</span> },
    { id: "time", accessorFn: (row) => row.timestamp, header: "Date / Time", cell: (info) => formatDate(info.row.original.timestamp) },
    { id: "geofence", accessorFn: (row) => row.withinGeofence, header: "Geofence Status", cell: (info) => info.row.original.withinGeofence ? <span className="attendance-geofence is-within"><b aria-hidden="true">✓</b> Within geofence</span> : <span className="attendance-geofence is-outside"><b aria-hidden="true">!</b> Outside geofence</span> },
  ], []);
  const table = useTable({ features, columns, data: rows });
  const erroredQuery = attendanceQueries.find((query) => query.isError);
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate);
  if (session?.role !== "admin") return <div className="admin-management-page"><Alert variant="destructive">Administrator access is required to view attendance.</Alert></div>;
  return <div className="admin-management-page">
    <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">ADMIN / PEOPLE</div><h1>Attendance</h1><p>Review check-in activity and geofence exceptions across sites.</p></div></div>
    {sitesQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Sites could not be loaded: {sitesQuery.error.message}</Alert>}
    {usersQuery.isError && <Alert variant="destructive" className="factory-stock-alert">User names could not be loaded: {usersQuery.error.message}</Alert>}
    {erroredQuery?.isError && <Alert variant="destructive" className="factory-stock-alert">Attendance could not be loaded: {erroredQuery.error?.message}<button type="button" onClick={() => void erroredQuery.refetch()}>Retry</button></Alert>}
    <Card className="factory-stock-card"><CardContent className="factory-stock-card__content"><div className="attendance-toolbar"><label className="ticket-filter"><span>Site</span><select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)} aria-label="Filter attendance by site"><option value="all">All sites</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label><label className="attendance-date-field"><span>From</span><input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></label><label className="attendance-date-field"><span>To</span><input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></label></div>
      {invalidRange ? <Alert variant="destructive">The start date must be on or before the end date.</Alert> : sitesQuery.isLoading || attendanceQueries.some((query) => query.isLoading) ? <div className="admin-table-skeleton">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} />)}</div> : <div className="stock-table-scroll"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.original.key}>{row.getAllCells().map((cell) => <TableCell key={cell.id}><table.FlexRender cell={cell} /></TableCell>)}</TableRow>)}{!rows.length && <TableRow><TableCell colSpan={5} className="stock-empty-cell">No attendance records were found for this range.</TableCell></TableRow>}</TableBody></Table></div>}
      <div className="admin-stock-note">Attendance is read-only. Check-in and check-out rows are shown separately; the API&apos;s out-of-geofence flags are displayed as warnings.</div>
    </CardContent></Card>
  </div>;
}
