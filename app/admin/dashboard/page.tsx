"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useSites } from "@/hooks/use-sites";
import { apiGet } from "@/lib/api";
import { formatDate, normalizeRequisition, records, value, type RequisitionRecord } from "@/lib/factory-data";

type UserRecord = Record<string, unknown>;
type PettyCashRecord = { id: string; siteId: string; amount: number; category: string; description: string; submittedBy: string; createdAt: string; status: string };
type Selection = { kind: "requisition" | "petty_cash"; id: string };
const EMPTY_REQUISITIONS: RequisitionRecord[] = [];
const EMPTY_PETTY_CASH: PettyCashRecord[] = [];
const EMPTY_SITES: { id: string; name: string; is_active?: boolean }[] = [];

function normalizePettyCash(record: Record<string, unknown>): PettyCashRecord {
  const submittedByValue = value(record, "SubmittedByName", "SubmittedBy", "submitted_by");
  const submittedBy = submittedByValue && typeof submittedByValue === "object"
    ? String(value(submittedByValue as Record<string, unknown>, "Name", "name", "Email", "email", "ID", "id") ?? "—")
    : String(submittedByValue ?? "—");
  return {
    id: String(value(record, "ID", "id") ?? ""),
    siteId: String(value(record, "SiteID", "site_id") ?? ""),
    amount: Number(value(record, "Amount", "amount") ?? 0),
    category: String(value(record, "Category", "category") ?? "—"),
    description: String(value(record, "Description", "description") ?? "—"),
    submittedBy,
    createdAt: String(value(record, "CreatedAt", "created_at") ?? ""),
    status: String(value(record, "Status", "status") ?? "pending"),
  };
}

function StatIcon({ icon }: { icon: "sites" | "users" | "requisitions" | "cash" }) {
  const content = {
    sites: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M8 9h.01M12 9h.01M16 9h.01" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8" /></>,
    requisitions: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" /></>,
    cash: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 15h3m7-3v4" /><circle cx="15" cy="14" r="2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{content[icon]}</svg>;
}

function KpiCard({ title, icon, value: count, loading, error }: { title: string; icon: "sites" | "users" | "requisitions" | "cash"; value?: number; loading: boolean; error?: string }) {
  return <Card className="stat-card admin-stat-card"><CardContent className="stat-card__body"><div className="stat-card__icon"><StatIcon icon={icon} /></div><div className="stat-card__label">{title}</div>{loading ? <><Skeleton className="stat-skeleton__value" /><Skeleton className="stat-skeleton__detail" /></> : error ? <Alert variant="destructive" className="stat-card__error">{error}</Alert> : <><div className="stat-card__value">{count ?? 0}</div><div className="stat-card__detail">Updated from your organization data</div></>}</CardContent></Card>;
}

export default function AdminDashboardPage() {
  const session = useDashboardSession();
  const [selection, setSelection] = useState<Selection | null>(null);
  const isAdmin = session?.role === "admin";
  const sitesQuery = useSites();
  const usersQuery = useQuery({ queryKey: ["admin-dashboard", "users"], queryFn: async () => records(await apiGet<unknown>("/users", session!.token)) as UserRecord[], enabled: Boolean(session?.token && isAdmin), staleTime: 60_000, retry: false });
  const pendingRequisitionsQuery = useQuery({ queryKey: ["admin-dashboard", "pending-requisitions"], queryFn: async () => records(await apiGet<unknown>("/requisitions?status=submitted", session!.token)).map(normalizeRequisition), enabled: Boolean(session?.token && isAdmin), staleTime: 60_000, retry: false });
  const pendingPettyCashQuery = useQuery({ queryKey: ["admin-dashboard", "pending-petty-cash"], queryFn: async () => records(await apiGet<unknown>("/petty-cash?status=pending", session!.token)).map(normalizePettyCash), enabled: Boolean(session?.token && isAdmin), staleTime: 60_000, retry: false });
  const recentRequisitionsQuery = useQuery({ queryKey: ["admin-dashboard", "recent-requisitions"], queryFn: async () => {
    const statuses = ["draft", "submitted", "approved", "rejected", "closed"];
    const responses = await Promise.all(statuses.map((status) => apiGet<unknown>(`/requisitions?status=${status}`, session!.token)));
    const unique = new Map<string, RequisitionRecord>();
    responses.flatMap((payload) => records(payload).map(normalizeRequisition)).forEach((request) => unique.set(request.id, request));
    return [...unique.values()].sort((a, b) => Date.parse(b.createdAt || b.approvedAt) - Date.parse(a.createdAt || a.approvedAt)).slice(0, 5);
  }, enabled: Boolean(session?.token && isAdmin), staleTime: 60_000, retry: false });
  const detailQuery = useQuery({
    queryKey: ["admin-dashboard", "approval-detail", selection?.kind, selection?.id],
    queryFn: async () => {
      if (!selection) return null;
      const path = selection.kind === "requisition" ? `/requisitions/${encodeURIComponent(selection.id)}` : `/petty-cash/${encodeURIComponent(selection.id)}`;
      return apiGet<unknown>(path, session!.token);
    },
    enabled: Boolean(session?.token && isAdmin && selection),
    staleTime: 60_000,
    retry: false,
  });

  const pendingRequisitions = pendingRequisitionsQuery.data ?? EMPTY_REQUISITIONS;
  const pendingPettyCash = pendingPettyCashQuery.data ?? EMPTY_PETTY_CASH;
  const pendingApprovals = useMemo(() => [
    ...pendingRequisitions.map((request) => ({ kind: "requisition" as const, id: request.id, title: request.taskDescription, siteId: request.siteId, submittedBy: request.requestedBy, createdAt: request.createdAt, subtitle: "Requisition" })),
    ...pendingPettyCash.map((request) => ({ kind: "petty_cash" as const, id: request.id, title: request.description, siteId: request.siteId, submittedBy: request.submittedBy, createdAt: request.createdAt, subtitle: `Petty cash · ${request.amount.toLocaleString()} · ${request.category}` })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [pendingRequisitions, pendingPettyCash]);
  const sites = sitesQuery.data ?? EMPTY_SITES;
  const siteMap = useMemo(() => new Map(sites.map((site) => [site.id, site.name])), [sites]);

  if (!isAdmin) return <div className="admin-dashboard"><div className="dashboard-page-heading"><div><div className="dashboard-page-heading__eyebrow">ORGANIZATION / ADMIN</div><h1>Admin dashboard</h1><p>Organization-wide activity and approvals.</p></div></div><Alert variant="destructive">Administrator access is required to view this dashboard.</Alert></div>;

  const selectedRequisition = selection?.kind === "requisition" && detailQuery.data ? normalizeRequisition(detailQuery.data) : null;
  const pettyRoot = detailQuery.data && typeof detailQuery.data === "object" ? (detailQuery.data as Record<string, unknown>) : null;
  const selectedPettyCash = selection?.kind === "petty_cash" && pettyRoot ? normalizePettyCash((pettyRoot.entry ?? pettyRoot.PettyCash ?? pettyRoot) as Record<string, unknown>) : null;

  return (
    <div className="admin-dashboard">
      <div className="dashboard-page-heading"><div><div className="dashboard-page-heading__eyebrow">ORGANIZATION / ADMIN</div><h1>Admin dashboard</h1><p>Organization-wide activity, people, and approvals at a glance.</p></div></div>

      <div className="admin-dashboard-stats">
        <KpiCard title="Total Active Sites" icon="sites" loading={sitesQuery.isLoading} error={sitesQuery.isError ? sitesQuery.error.message : undefined} value={sites.filter((site) => site.is_active).length} />
        <KpiCard title="Total Users" icon="users" loading={usersQuery.isLoading} error={usersQuery.isError ? usersQuery.error.message : undefined} value={usersQuery.data?.length} />
        <KpiCard title="Pending Requisitions" icon="requisitions" loading={pendingRequisitionsQuery.isLoading} error={pendingRequisitionsQuery.isError ? pendingRequisitionsQuery.error.message : undefined} value={pendingRequisitions.length} />
        <KpiCard title="Pending Petty Cash" icon="cash" loading={pendingPettyCashQuery.isLoading} error={pendingPettyCashQuery.isError ? pendingPettyCashQuery.error.message : undefined} value={pendingPettyCash.length} />
      </div>

      <div className="admin-dashboard-panels">
        <Card className="admin-panel"><CardContent className="admin-panel__content"><header className="admin-panel__header"><div><h2>Recent Activity</h2><p>Five most recently created requisitions</p></div><span className="admin-panel__count">{recentRequisitionsQuery.data?.length ?? 0}</span></header>
          {recentRequisitionsQuery.isError ? <Alert variant="destructive">Recent requisitions could not be loaded: {recentRequisitionsQuery.error.message}<button type="button" onClick={() => void recentRequisitionsQuery.refetch()}>Retry</button></Alert> : recentRequisitionsQuery.isLoading ? <div className="admin-list-skeleton">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} />)}</div> : <div className="admin-activity-list">{recentRequisitionsQuery.data?.map((request) => <button className="admin-activity-row" key={request.id} type="button" onClick={() => setSelection({ kind: "requisition", id: request.id })}><span className="admin-activity-icon admin-activity-icon--blue">R</span><span className="admin-activity-copy"><strong>{request.taskDescription}</strong><small>{siteMap.get(request.siteId) ?? "Unknown site"} · {request.requestedBy}</small></span><span className="admin-activity-meta"><b className={`admin-status admin-status--${request.status.toLowerCase()}`}>{request.status}</b><time>{formatDate(request.createdAt)}</time></span></button>)}{!recentRequisitionsQuery.data?.length && <p className="admin-empty-state">No requisitions have been created yet.</p>}</div>}
          <p className="admin-placeholder-note">Placeholder activity feed — a dedicated activity endpoint can replace this view later.</p>
        </CardContent></Card>

        <Card className="admin-panel"><CardContent className="admin-panel__content"><header className="admin-panel__header"><div><h2>Needs Your Approval</h2><p>Pending requisitions and petty cash requests</p></div><span className="admin-panel__count">{pendingApprovals.length}</span></header>
          {(pendingRequisitionsQuery.isError || pendingPettyCashQuery.isError) ? <Alert variant="destructive">Approvals could not be loaded: {pendingRequisitionsQuery.error?.message ?? pendingPettyCashQuery.error?.message}<button type="button" onClick={() => { void pendingRequisitionsQuery.refetch(); void pendingPettyCashQuery.refetch(); }}>Retry</button></Alert> : pendingRequisitionsQuery.isLoading || pendingPettyCashQuery.isLoading ? <div className="admin-list-skeleton">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} />)}</div> : <div className="admin-approval-list">{pendingApprovals.map((approval) => <button className="admin-approval-row" key={`${approval.kind}-${approval.id}`} type="button" onClick={() => setSelection({ kind: approval.kind, id: approval.id })}><span className={`admin-approval-icon admin-approval-icon--${approval.kind}`}>{approval.kind === "requisition" ? "R" : "$"}</span><span className="admin-approval-copy"><strong>{approval.title}</strong><small>{approval.subtitle} · {siteMap.get(approval.siteId) ?? "Unknown site"}</small><small>Submitted by {approval.submittedBy}</small></span><span className="admin-approval-arrow" aria-hidden="true">→</span></button>)}{!pendingApprovals.length && <p className="admin-empty-state">You’re all caught up. No approvals are waiting.</p>}</div>}
        </CardContent></Card>
      </div>

      <Sheet open={Boolean(selection)} onOpenChange={(open) => { if (!open) setSelection(null); }} title={selection?.kind === "petty_cash" ? "Petty cash request" : "Requisition details"} description={selection?.id ? `Request ${selection.id}` : undefined}>
        {detailQuery.isLoading ? <div className="factory-data-skeleton"><Skeleton /><Skeleton /><Skeleton /></div> : detailQuery.isError ? <Alert variant="destructive">Request details could not be loaded: {detailQuery.error.message}</Alert> : selectedRequisition ? <div className="admin-drawer-details"><dl className="requisition-detail-list"><div><dt>Task description</dt><dd>{selectedRequisition.taskDescription}</dd></div><div><dt>Requested by</dt><dd>{selectedRequisition.requestedBy}</dd></div><div><dt>Site</dt><dd>{siteMap.get(selectedRequisition.siteId) ?? "Unknown site"}</dd></div><div><dt>Created</dt><dd>{formatDate(selectedRequisition.createdAt)}</dd></div><div><dt>Status</dt><dd>{selectedRequisition.status}</dd></div></dl><p className="sheet-readonly-note">Review the requisition in the approval workflow to take action.</p></div> : selectedPettyCash ? <div className="admin-drawer-details"><dl className="requisition-detail-list"><div><dt>Description</dt><dd>{selectedPettyCash.description}</dd></div><div><dt>Category</dt><dd>{selectedPettyCash.category}</dd></div><div><dt>Amount</dt><dd>{selectedPettyCash.amount.toLocaleString()}</dd></div><div><dt>Submitted by</dt><dd>{selectedPettyCash.submittedBy}</dd></div><div><dt>Site</dt><dd>{siteMap.get(selectedPettyCash.siteId) ?? "Unknown site"}</dd></div><div><dt>Submitted</dt><dd>{formatDate(selectedPettyCash.createdAt)}</dd></div><div><dt>Status</dt><dd>{selectedPettyCash.status}</dd></div></dl><p className="sheet-readonly-note">Review the petty cash request in the approval workflow to take action.</p></div> : selection ? <p className="sheet-muted">Request details are unavailable.</p> : null}
      </Sheet>
    </div>
  );
}
