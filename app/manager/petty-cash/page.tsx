"use client";

import { createSortedRowModel, rowSortingFeature, sortFns, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSites } from "@/hooks/use-sites";
import { apiGet, apiPut } from "@/lib/api";
import { formatDate, records, value } from "@/lib/factory-data";
import { ReceiptImage } from "@/components/receipt-image";

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns });
const STATUSES = ["pending", "approved", "rejected"];
type CashRecord = { id: string; siteId: string; amount: number; category: string; status: string; description: string; screenshotUrl: string; submittedBy: string; approvedBy: string; createdAt: string; approvedAt: string; rejectionReason: string };
function normalizeCash(record: Record<string, unknown>): CashRecord {
  const submitter = value(record, "SubmittedByName", "SubmittedBy", "submitted_by");
  const approver = value(record, "ApprovedByName", "ApprovedBy", "approved_by");
  const displayName = (input: unknown) => input && typeof input === "object" ? String(value(input as Record<string, unknown>, "Name", "name", "Email", "email") ?? "—") : String(input ?? "—");
  return { id: String(value(record, "ID", "id") ?? ""), siteId: String(value(record, "SiteID", "site_id") ?? ""), amount: Number(value(record, "Amount", "amount") ?? 0), category: String(value(record, "Category", "category") ?? "—"), status: String(value(record, "Status", "status") ?? "pending").toLowerCase(), description: String(value(record, "Description", "description") ?? "—"), screenshotUrl: String(value(record, "ScreenshotURL", "screenshot_url") ?? ""), submittedBy: displayName(submitter), approvedBy: displayName(approver), createdAt: String(value(record, "CreatedAt", "created_at") ?? ""), approvedAt: String(value(record, "ApprovedAt", "approved_at") ?? ""), rejectionReason: String(value(record, "RejectionReason", "rejection_reason") ?? "") };
}

export default function ManagerPettyCashPage() {
  const session = useDashboardSession();
  const queryClient = useQueryClient();
  const sitesQuery = useSites();
  const [status, setStatus] = useState("pending");
  const [selectedId, setSelectedId] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | "">("");
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [enlargedImage, setEnlargedImage] = useState("");
  const siteNames = useMemo(() => new Map((sitesQuery.data ?? []).map((site) => [site.id, site.name])), [sitesQuery.data]);
  const listQuery = useQuery({ queryKey: ["manager-petty-cash", status], queryFn: async () => records(await apiGet<unknown>(`/petty-cash?status=${encodeURIComponent(status)}`, session!.token)).map(normalizeCash), enabled: Boolean(session?.token && session.role === "manager"), staleTime: 60_000, retry: false });
  const detailQuery = useQuery({ queryKey: ["manager-petty-cash-detail", selectedId], queryFn: async () => {
    const payload = await apiGet<unknown>(`/petty-cash/${encodeURIComponent(selectedId)}`, session!.token);
    const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    return normalizeCash((value(root, "entry", "PettyCash", "petty_cash") ?? root) as Record<string, unknown>);
  }, enabled: Boolean(session?.token && session.role === "manager" && selectedId), staleTime: 60_000, retry: false });
  const mutation = useMutation({ mutationFn: async () => {
    if (!decision || !selectedId) return;
    return apiPut(`/petty-cash/${encodeURIComponent(selectedId)}/${decision}`, session!.token, decision === "reject" ? { rejection_reason: rejectReason.trim() } : {});
  }, onSuccess: async () => {
    setDecision(""); setRejectReason(""); setActionError("");
    setSelectedId("");
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["manager-petty-cash"] }), queryClient.invalidateQueries({ queryKey: ["manager-petty-cash-detail", selectedId] }), queryClient.invalidateQueries({ queryKey: ["manager-dashboard"] })]);
    toast.success(`Petty cash ${decision === "approve" ? "approved" : "rejected"} successfully`);
  }, onError: (error: Error) => setActionError(error.message) });
  const rows = listQuery.data ?? [];
  const columns: Array<ColumnDef<typeof features, CashRecord>> = useMemo(() => [
    { id: "site", accessorFn: (entry) => siteNames.get(entry.siteId) ?? "Unknown site", header: "Site", cell: (info) => <span className="admin-table-primary">{siteNames.get(info.row.original.siteId) ?? "Unknown site"}</span> },
    { id: "amount", accessorFn: (entry) => entry.amount, header: "Amount", cell: (info) => <span className="stock-balance-value">{info.row.original.amount.toLocaleString(undefined, { style: "currency", currency: "INR" })}</span> },
    { id: "category", accessorFn: (entry) => entry.category, header: "Category", cell: (info) => info.row.original.category },
    { id: "status", accessorFn: (entry) => entry.status, header: "Status", cell: (info) => <span className={`admin-status-pill admin-cash-status is-${info.row.original.status}`}>{info.row.original.status[0]?.toUpperCase()}{info.row.original.status.slice(1)}</span> },
    { id: "submitter", accessorFn: (entry) => entry.submittedBy, header: "Submitted By", cell: (info) => info.row.original.submittedBy || "—" },
    { id: "date", accessorFn: (entry) => entry.createdAt, header: "Submitted Date", cell: (info) => formatDate(info.row.original.createdAt) },
  ], [siteNames]);
  const table = useTable({ features, columns, data: rows });
  const detail = detailQuery.data;
  if (session?.role !== "manager") return <div className="admin-management-page"><Alert variant="destructive">Manager access is required to view petty cash.</Alert></div>;
  return <div className="admin-management-page">
    <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">MANAGER / FINANCE</div><h1>Petty Cash</h1><p>Review cross-site expenses and verify receipts before approval.</p></div></div>
    {listQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Petty cash could not be loaded: {listQuery.error.message}<button type="button" onClick={() => void listQuery.refetch()}>Retry</button></Alert>}
    {sitesQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Site names could not be loaded: {sitesQuery.error.message}</Alert>}
    <Card className="factory-stock-card"><CardContent className="factory-stock-card__content"><div className="factory-stock-toolbar"><div className="factory-stock-toolbar__copy"><h2>Petty cash requests</h2><p>{rows.length} {rows.length === 1 ? "request" : "requests"}</p></div><label className="ticket-filter"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter petty cash by status">{STATUSES.map((itemStatus) => <option key={itemStatus} value={itemStatus}>{itemStatus[0].toUpperCase() + itemStatus.slice(1)}</option>)}</select></label></div>
      {listQuery.isLoading ? <div className="admin-table-skeleton">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} />)}</div> : <div className="stock-table-scroll"><Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.original.id} className="stock-clickable-row" tabIndex={0} onClick={() => { setSelectedId(row.original.id); setActionError(""); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(row.original.id); setActionError(""); } }}>{row.getAllCells().map((cell) => <TableCell key={cell.id}><table.FlexRender cell={cell} /></TableCell>)}</TableRow>)}{!rows.length && <TableRow><TableCell colSpan={6} className="stock-empty-cell">No requests match this status.</TableCell></TableRow>}</TableBody></Table></div>}
    </CardContent></Card>
    <Sheet open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) { setSelectedId(""); setActionError(""); } }} title="Petty cash request" description={detail ? `Request ${detail.id}` : "Review expense details and receipt."}>
      {detailQuery.isLoading ? <div className="admin-table-skeleton">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} />)}</div> : detailQuery.isError ? <Alert variant="destructive">Request details could not be loaded: {detailQuery.error.message}</Alert> : detail && <>
        <dl className="admin-record-details"><div><dt>Site</dt><dd>{siteNames.get(detail.siteId) ?? "Unknown site"}</dd></div><div><dt>Amount</dt><dd>{detail.amount.toLocaleString(undefined, { style: "currency", currency: "INR" })}</dd></div><div><dt>Category</dt><dd>{detail.category}</dd></div><div><dt>Status</dt><dd><span className={`admin-status-pill admin-cash-status is-${detail.status}`}>{detail.status}</span></dd></div><div><dt>Description</dt><dd>{detail.description}</dd></div><div><dt>Submitted by</dt><dd>{detail.submittedBy}</dd></div><div><dt>Submitted</dt><dd>{formatDate(detail.createdAt)}</dd></div><div><dt>Approved by</dt><dd>{detail.approvedBy}</dd></div><div><dt>Approved</dt><dd>{formatDate(detail.approvedAt)}</dd></div>{detail.rejectionReason && <div><dt>Rejection reason</dt><dd>{detail.rejectionReason}</dd></div>}</dl>
        <section className="admin-receipt-section"><h3>Receipt</h3>{detail.screenshotUrl ? <ReceiptImage url={detail.screenshotUrl} token={session.token} onEnlarge={setEnlargedImage} /> : <p className="admin-inline-muted">No receipt was attached.</p>}</section>
        {actionError && <Alert variant="destructive" className="admin-form-error">Action failed: {actionError}</Alert>}
        {detail.status === "pending" && <div className="admin-requisition-actions"><button className="factory-primary-button" type="button" disabled={mutation.isPending} onClick={() => setDecision("approve")}>Approve</button><button className="destructive-button" type="button" disabled={mutation.isPending} onClick={() => { setRejectReason(""); setDecision("reject"); }}>Reject</button></div>}
      </>}
    </Sheet>
    <Dialog open={Boolean(decision)} onOpenChange={(open) => { if (!open && !mutation.isPending) setDecision(""); }} title={decision === "approve" ? "Approve petty cash?" : "Reject petty cash?"} description="Confirm this expense review decision."><div className="dialog-form-stack">{decision === "reject" && <label className="admin-form-field"><span>Rejection reason</span><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} required placeholder="Explain why this request is rejected" /></label>}{mutation.error && <Alert variant="destructive">{mutation.error.message}</Alert>}<div className="alert-dialog-actions"><button className="factory-secondary-button" type="button" disabled={mutation.isPending} onClick={() => setDecision("")}>Cancel</button><button className={decision === "reject" ? "destructive-button" : "factory-primary-button"} type="button" disabled={mutation.isPending || (decision === "reject" && !rejectReason.trim())} onClick={() => mutation.mutate()}>{mutation.isPending ? "Working…" : decision === "approve" ? "Approve" : "Reject"}</button></div></div></Dialog>
    <Dialog open={Boolean(enlargedImage)} onOpenChange={(open) => { if (!open) setEnlargedImage(""); }} title="Receipt image" className="receipt-enlarge-dialog">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="receipt-enlarged-image" src={enlargedImage} alt="Full size petty cash receipt" />
    </Dialog>
  </div>;
}
