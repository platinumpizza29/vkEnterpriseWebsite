"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useSites } from "@/hooks/use-sites";
import { apiGet, apiPut } from "@/lib/api";
import { formatDate, normalizeRequisition, records, value } from "@/lib/factory-data";

type Cash = { id: string; description: string; amount: number; createdAt: string; siteId: string; submittedBy: string; category: string };
function cashRecord(row: Record<string, unknown>): Cash {
  const submitter = value(row, "SubmittedByName", "SubmittedBy", "submitted_by");
  return { id: String(value(row, "ID", "id") ?? ""), description: String(value(row, "Description", "description") ?? "Petty cash request"), amount: Number(value(row, "Amount", "amount") ?? 0), createdAt: String(value(row, "CreatedAt", "created_at") ?? ""), siteId: String(value(row, "SiteID", "site_id") ?? ""), submittedBy: typeof submitter === "object" && submitter ? String(value(submitter as Record<string, unknown>, "Name", "name") ?? "—") : String(submitter ?? "—"), category: String(value(row, "Category", "category") ?? "—") };
}

export default function ManagerDashboardPage() {
  const session = useDashboardSession();
  const sitesQuery = useSites();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<{ kind: "requisition" | "cash"; id: string } | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | "">("");
  const [rejectReason, setRejectReason] = useState("");
  const [oldestFirst, setOldestFirst] = useState(true);
  const enabled = Boolean(session?.token && session.role === "manager");
  const requisitions = useQuery({ queryKey: ["manager-dashboard", "requisitions", "submitted"], queryFn: async () => records(await apiGet<unknown>("/requisitions?status=submitted", session!.token)).map(normalizeRequisition), enabled, retry: false });
  const approved = useQuery({ queryKey: ["manager-dashboard", "requisitions", "approved"], queryFn: async () => records(await apiGet<unknown>("/requisitions?status=approved", session!.token)).map(normalizeRequisition), enabled, retry: false });
  const pettyCash = useQuery({ queryKey: ["manager-dashboard", "petty-cash", "pending"], queryFn: async () => records(await apiGet<unknown>("/petty-cash?status=pending", session!.token)).map(cashRecord), enabled, retry: false });
  const tickets = useQuery({ queryKey: ["manager-dashboard", "tickets", "dispatched", sitesQuery.data?.map((site) => site.id)], queryFn: async () => {
    const siteIds = sitesQuery.data?.map((site) => site.id) ?? [];
    const payloads = await Promise.all(siteIds.map((id) => apiGet<unknown>(`/tickets/site/${encodeURIComponent(id)}?status=dispatched`, session!.token)));
    const unique = new Map<string, Record<string, unknown>>();
    payloads.flatMap(records).forEach((ticket, index) => unique.set(String(value(ticket, "ID", "id") ?? `${index}-${unique.size}`), ticket));
    return unique.size;
  }, enabled: Boolean(enabled && sitesQuery.data), retry: false });
  const detail = useQuery({ queryKey: ["manager-dashboard-detail", selected?.kind, selected?.id], queryFn: async () => apiGet<unknown>(`${selected!.kind === "requisition" ? "/requisitions/" : "/petty-cash/"}${encodeURIComponent(selected!.id)}`, session!.token), enabled: Boolean(enabled && selected), retry: false });
  const decisionMutation = useMutation({ mutationFn: async () => {
    if (!selected || !decision) return;
    const path = selected.kind === "requisition" ? `/requisitions/${encodeURIComponent(selected.id)}/${decision}` : `/petty-cash/${encodeURIComponent(selected.id)}/${decision}`;
    return apiPut(path, session!.token, selected.kind === "cash" && decision === "reject" ? { rejection_reason: rejectReason.trim() } : {});
  }, onSuccess: async () => {
    const label = selected?.kind === "cash" ? "Petty cash" : "Requisition";
    setDecision(""); setRejectReason(""); setSelected(null);
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["manager-dashboard"] }), queryClient.invalidateQueries({ queryKey: ["manager-dashboard-detail"] }), queryClient.invalidateQueries({ queryKey: ["manager-requisitions"] }), queryClient.invalidateQueries({ queryKey: ["manager-petty-cash"] })]);
    toast.success(`${label} ${decision === "approve" ? "approved" : "rejected"} successfully`);
  }});
  const siteNames = useMemo(() => new Map((sitesQuery.data ?? []).map((site) => [site.id, site.name])), [sitesQuery.data]);
  const approvals = useMemo(() => [
    ...(requisitions.data ?? []).map((entry) => ({ kind: "requisition" as const, id: entry.id, title: entry.taskDescription, by: entry.requestedBy, siteId: entry.siteId, date: entry.createdAt, subtitle: "Requisition" })),
    ...(pettyCash.data ?? []).map((entry) => ({ kind: "cash" as const, id: entry.id, title: entry.description, by: entry.submittedBy, siteId: entry.siteId, date: entry.createdAt, subtitle: `Petty cash · ${entry.amount.toLocaleString(undefined, { style: "currency", currency: "INR" })}` })),
  ].sort((a, b) => (new Date(a.date).getTime() - new Date(b.date).getTime()) * (oldestFirst ? 1 : -1)), [requisitions.data, pettyCash.data, oldestFirst]);
  const errors = [requisitions, approved, pettyCash, tickets, sitesQuery].filter((query) => query.isError);
  if (session?.role !== "manager") return <div className="manager-dashboard"><Alert variant="destructive">Manager access is required to view this dashboard.</Alert></div>;
  return <div className="manager-dashboard">
    <div className="dashboard-page-heading"><div><div className="dashboard-page-heading__eyebrow">OPERATIONS / MANAGER</div><h1>Manager dashboard</h1><p>Review requests that need your attention and track operations across sites.</p></div></div>
    {errors.map((query, index) => <Alert key={index} variant="destructive" className="factory-stock-alert">Dashboard data could not be loaded: {query.error?.message}<button type="button" onClick={() => void query.refetch()}>Retry</button></Alert>)}
    <Card className="manager-approval-panel"><CardContent><div className="manager-approval-heading"><div><span className="dashboard-page-heading__eyebrow">ACTION REQUIRED</span><h2>Needs Your Approval</h2><p>{oldestFirst ? "Oldest requests are shown first." : "Newest requests are shown first."}</p></div><div className="manager-approval-heading__actions"><button type="button" className="factory-secondary-button" onClick={() => setOldestFirst((value) => !value)}>Sort: {oldestFirst ? "Oldest first" : "Newest first"}</button><span className="manager-approval-count">{approvals.length} pending</span></div></div>
      {(requisitions.isLoading || pettyCash.isLoading) ? <div className="factory-data-skeleton">{[1,2,3].map((n) => <Skeleton key={n} />)}</div> : <div className="manager-approval-list">{approvals.map((row) => <button type="button" className="manager-approval-item" key={`${row.kind}-${row.id}`} onClick={() => setSelected({ kind: row.kind, id: row.id })}><span className={`manager-approval-kind is-${row.kind}`}>{row.kind === "cash" ? "₹" : "R"}</span><span className="manager-approval-main"><strong>{row.title}</strong><small>{row.subtitle} · {siteNames.get(row.siteId) ?? "Site"} · Requested by {row.by}</small></span><time>{formatDate(row.date)}</time><span className="manager-approval-arrow">→</span></button>)}{!approvals.length && <p className="manager-approval-empty">You’re all caught up. No requests are waiting for approval.</p>}</div>}
    </CardContent></Card>
    <section className="manager-stat-grid" aria-label="Operations summary">
      {[{ label: "Pending Requisitions", value: requisitions.data?.length, query: requisitions, href: "/manager/requisitions?status=submitted", icon: "R" }, { label: "Approved · Awaiting Dispatch", value: approved.data?.length, query: approved, href: "/manager/requisitions?status=approved", icon: "D" }, { label: "Pending Petty Cash", value: pettyCash.data?.length, query: pettyCash, href: "/manager/petty-cash", icon: "₹" }, { label: "In-Transit Tickets", value: tickets.data, query: tickets, href: "/manager/tickets", icon: "T" }].map((stat) => <Link href={stat.href} key={stat.label} className="manager-stat-link"><Card className="manager-stat-card"><CardContent><span className="manager-stat-icon">{stat.icon}</span><span className="manager-stat-label">{stat.label}</span>{stat.query.isLoading ? <Skeleton /> : <strong>{stat.value ?? "—"}</strong>}<small>View details →</small></CardContent></Card></Link>)}
    </section>
    <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected?.kind === "cash" ? "Petty cash request" : "Requisition details"} description={selected ? `Request ${selected.id}` : undefined}>
      {detail.isLoading ? <div className="factory-data-skeleton"><Skeleton /><Skeleton /><Skeleton /></div> : detail.isError ? <Alert variant="destructive">Request details could not be loaded: {detail.error.message}</Alert> : detail.data ? <div className="manager-approval-detail"><dl className="requisition-detail-list">{Object.entries((detail.data && typeof detail.data === "object" ? ((detail.data as Record<string, unknown>).requisition ?? (detail.data as Record<string, unknown>).Requisition ?? (detail.data as Record<string, unknown>).entry ?? (detail.data as Record<string, unknown>).petty_cash ?? (detail.data as Record<string, unknown>).PettyCash ?? detail.data) : {}) as Record<string, unknown>).filter(([key, value]) => !Array.isArray(value) && (typeof value !== "object" || value === null)).slice(0, 10).map(([key, value]) => <div key={key}><dt>{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}</dt><dd>{String(value ?? "—")}</dd></div>)}</dl><div className="manager-approval-detail-actions"><button type="button" className="factory-primary-button" disabled={decisionMutation.isPending} onClick={() => { setRejectReason(""); setDecision("approve"); }}>Approve</button><button type="button" className="destructive-button" disabled={decisionMutation.isPending} onClick={() => { setRejectReason(""); setDecision("reject"); }}>Reject</button><Link className="factory-secondary-button" href={selected?.kind === "requisition" ? "/manager/requisitions" : "/manager/petty-cash"}>Open full queue →</Link></div></div> : null}
    </Sheet>
    <Dialog open={Boolean(decision)} onOpenChange={(open) => { if (!open && !decisionMutation.isPending) setDecision(""); }} title={`${decision === "approve" ? "Approve" : "Reject"} ${selected?.kind === "cash" ? "petty cash request" : "requisition"}?`} description="Confirm your decision for this request."><div className="dialog-form-stack">{selected?.kind === "cash" && decision === "reject" && <label className="admin-form-field"><span>Rejection reason</span><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Explain why this request is rejected" required /></label>}{decisionMutation.error && <Alert variant="destructive">{decisionMutation.error.message}</Alert>}<div className="alert-dialog-actions"><button className="factory-secondary-button" type="button" disabled={decisionMutation.isPending} onClick={() => setDecision("")}>Cancel</button><button className={decision === "reject" ? "destructive-button" : "factory-primary-button"} type="button" disabled={decisionMutation.isPending || (selected?.kind === "cash" && decision === "reject" && !rejectReason.trim())} onClick={() => decisionMutation.mutate()}>{decisionMutation.isPending ? "Working…" : decision === "approve" ? "Approve request" : "Reject request"}</button></div></div></Dialog>
  </div>;
}
