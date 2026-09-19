"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHubSite } from "@/hooks/use-hub-site";
import { useSites } from "@/hooks/use-sites";
import { apiGet, apiPost } from "@/lib/api";
import { formatDate, normalizeItem, normalizeRequisition, records, type FactoryItem, type RequisitionLine } from "@/lib/factory-data";

type LineProgress = { status: "idle" | "pending" | "success" | "error"; message?: string };
type BalancePayload = { balance?: number; Balance?: number };

function DispatchLine({
  line,
  item,
  quantity,
  onQuantityChange,
  progress,
  onClearError,
  hubSiteId,
}: {
  line: RequisitionLine;
  item?: FactoryItem;
  quantity: string;
  onQuantityChange: (value: string) => void;
  progress?: LineProgress;
  onClearError: () => void;
  hubSiteId: string | null;
}) {
  const session = useDashboardSession();
  const balanceQuery = useQuery({
    queryKey: ["factory-stock-detail", hubSiteId, line.itemId],
    queryFn: () => apiGet<BalancePayload>(`/inventory/stock/site/${hubSiteId}/item/${encodeURIComponent(line.itemId)}`, session!.token),
    enabled: Boolean(session?.token && hubSiteId && line.itemId),
    staleTime: 30_000,
    retry: false,
  });
  const balance = balanceQuery.data?.balance ?? balanceQuery.data?.Balance;
  const quantityNumber = Number(quantity);
  const overBalance = typeof balance === "number" && Number.isFinite(quantityNumber) && quantityNumber > balance;

  return (
    <div className="dispatch-line">
      <div className="dispatch-line__item"><strong>{item?.name ?? "Unknown item"}</strong>{item?.unit && <small>{item.unit}</small>}</div>
      <div className="dispatch-line__requested"><span className="dispatch-mobile-label">Requested</span>{line.quantity.toLocaleString()}</div>
      <div className="dispatch-line__qty"><label className="dispatch-mobile-label" htmlFor={`dispatch-${line.id}`}>Dispatch quantity</label><input id={`dispatch-${line.id}`} type="number" min="0" step="any" inputMode="decimal" value={quantity} disabled={progress?.status === "success"} onChange={(event) => { onQuantityChange(event.target.value); onClearError(); }} aria-invalid={progress?.status === "error"} /></div>
      <div className="dispatch-line__balance"><span className="dispatch-mobile-label">Factory balance</span>{balanceQuery.isLoading ? "Loading…" : balanceQuery.isError ? "Unavailable" : typeof balance === "number" ? `${balance.toLocaleString()} ${item?.unit ?? ""}` : "—"}</div>
      <div className={`dispatch-progress dispatch-progress--${progress?.status ?? "idle"}`} aria-live="polite">{progress?.status === "pending" ? <><i className="dispatch-spinner" /> Sending</> : progress?.status === "success" ? <>✓ Dispatched</> : progress?.status === "error" ? <>! Failed</> : <>Ready</>}</div>
      {overBalance && <p className="dispatch-balance-warning">Dispatch quantity is above the current factory balance ({balance?.toLocaleString()}). Confirm stock availability before continuing.</p>}
      {progress?.message && <p className="dispatch-line-error">{progress.message}</p>}
    </div>
  );
}

export default function DispatchRequisitionPage({ requisitionId }: { requisitionId: string }) {
  const session = useDashboardSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hubSiteId } = useHubSite();
  const sitesQuery = useSites();
  const hasAccess = session?.role === "factory_manager" || session?.role === "manager" || session?.role === "admin";
  const requisitionQuery = useQuery({
    queryKey: ["factory-requisition", requisitionId],
    queryFn: async () => normalizeRequisition(await apiGet<unknown>(`/requisitions/${encodeURIComponent(requisitionId)}`, session!.token)),
    enabled: Boolean(session?.token && hasAccess && requisitionId),
    staleTime: 60_000,
    retry: false,
  });
  const itemsQuery = useQuery({
    queryKey: ["inventory-items", "catalog"],
    queryFn: async () => records(await apiGet<unknown>("/inventory-items", session!.token)).map(normalizeItem).filter((item) => item.id),
    enabled: Boolean(session?.token && hasAccess),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Record<string, LineProgress>>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});
  const itemMap = useMemo(() => new Map((itemsQuery.data ?? []).map((item) => [item.id, item])), [itemsQuery.data]);
  const requisition = requisitionQuery.data;
  const lines = requisition?.lines ?? [];

  useEffect(() => {
    if (!requisition) return;
    setQuantities((current) => {
      const next = { ...current };
      requisition.lines.forEach((line) => { if (next[line.id] === undefined) next[line.id] = String(line.quantity); });
      return next;
    });
    setProgress((current) => {
      const next = { ...current };
      requisition.lines.forEach((line) => { if (!next[line.id]) next[line.id] = { status: "idle" }; });
      return next;
    });
  }, [requisition]);

  const dispatchMutation = useMutation({
    mutationFn: async (lineIds: string[]) => {
      const selectedLines = lines.filter((line) => lineIds.includes(line.id));
      const errors: Record<string, string> = {};
      for (const line of selectedLines) {
        const quantity = Number(quantities[line.id]);
        if (!Number.isFinite(quantity) || quantity <= 0) errors[line.id] = "Dispatch quantity must be greater than 0.";
      }
      if (Object.keys(errors).length) {
        setQuantityErrors((previous) => ({ ...previous, ...errors }));
        return { failed: selectedLines.length, validationFailed: true };
      }
      setQuantityErrors((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => !lineIds.includes(id))));
      let failed = 0;
      for (const line of selectedLines) {
        setProgress((previous) => ({ ...previous, [line.id]: { status: "pending" } }));
        try {
          await apiPost("/dispatch-tickets/dispatch", session!.token, {
            requisition_id: requisition!.id,
            site_id: requisition!.siteId,
            item_id: line.itemId,
            quantity: Number(quantities[line.id]),
          });
          setProgress((previous) => ({ ...previous, [line.id]: { status: "success" } }));
        } catch (error) {
          failed += 1;
          setProgress((previous) => ({ ...previous, [line.id]: { status: "error", message: error instanceof Error ? error.message : "Dispatch failed." } }));
        }
      }
      return { failed, validationFailed: false };
    },
    onSuccess: async ({ failed, validationFailed }) => {
      if (validationFailed) return;
      if (failed) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["factory-requisitions", "approved"] }),
        queryClient.invalidateQueries({ queryKey: ["factory-requisition", requisitionId] }),
        queryClient.invalidateQueries({ queryKey: ["dispatch-tickets"] }),
      ]);
      toast.success("Dispatch tickets created", { description: "All requisition lines were dispatched successfully." });
      router.push("/factory/requisitions");
    },
  });

  const failedIds = lines.filter((line) => progress[line.id]?.status === "error").map((line) => line.id);
  const completedCount = lines.filter((line) => progress[line.id]?.status === "success").length;

  if (!hasAccess) return <div className="factory-data-page"><Alert variant="destructive">Factory Manager or administrator access is required to dispatch a requisition.</Alert></div>;

  return (
    <div className="factory-data-page">
      <div className="stock-detail-breadcrumb"><Link href="/factory/requisitions">Requisitions</Link><span>/</span><span>Create dispatch</span></div>
      <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">DISPATCH / NEW TICKETS</div><h1>Create dispatch tickets</h1><p>Set dispatch quantities for each approved requisition line.</p></div></div>
      {requisitionQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Requisition could not be loaded: {requisitionQuery.error.message}<button type="button" onClick={() => void requisitionQuery.refetch()}>Retry</button></Alert>}
      {itemsQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Inventory items could not be loaded: {itemsQuery.error.message}</Alert>}
      {dispatchMutation.isError && <Alert variant="destructive" className="factory-stock-alert">Dispatch failed: {dispatchMutation.error.message}</Alert>}

      {requisitionQuery.isLoading ? <Card><CardContent><div className="factory-data-skeleton"><Skeleton /><Skeleton /><Skeleton /></div></CardContent></Card> : requisition ? <>
        <Card className="dispatch-context-card"><CardContent className="dispatch-context"><div><span>Destination</span><strong>{sitesQuery.data?.find((site) => site.id === requisition.siteId)?.name ?? "Loading site…"}</strong></div><div><span>Approved</span><strong>{formatDate(requisition.approvedAt)}</strong></div><div><span>Task</span><strong>{requisition.taskDescription}</strong></div></CardContent></Card>
        {requisition.status.toLowerCase() !== "approved" && <Alert variant="destructive" className="factory-stock-alert">This requisition is currently {requisition.status || "not approved"}; only approved requisitions can be dispatched.</Alert>}
        {!hubSiteId && <Alert variant="destructive" className="factory-stock-alert">Hub site is unavailable. Factory balances cannot be checked until a hub is configured.</Alert>}
        <Card className="factory-stock-card"><CardContent className="factory-stock-card__content">
          <div className="factory-stock-toolbar"><div className="factory-stock-toolbar__copy"><h2>Dispatch lines</h2><p>{completedCount} of {lines.length} lines dispatched</p></div></div>
          <div className="dispatch-lines-header"><span>Item</span><span>Requested</span><span>Dispatch quantity</span><span>Factory balance</span><span>Progress</span></div>
          <div className="dispatch-lines">{lines.map((line) => <DispatchLine key={line.id} line={line} item={itemMap.get(line.itemId)} quantity={quantities[line.id] ?? String(line.quantity)} onQuantityChange={(value) => setQuantities((previous) => ({ ...previous, [line.id]: value }))} progress={progress[line.id]} onClearError={() => setQuantityErrors((previous) => ({ ...previous, [line.id]: "" }))} hubSiteId={hubSiteId} />)}{!lines.length && <div className="stock-table-unavailable">This requisition has no line items.</div>}</div>
          {Object.values(quantityErrors).some(Boolean) && <Alert variant="destructive" className="dispatch-form-error">Correct the highlighted dispatch quantity before submitting.</Alert>}
          {failedIds.length > 0 && <Alert variant="destructive" className="dispatch-form-error">{failedIds.length} line{failedIds.length === 1 ? "" : "s"} failed. Review each error, adjust quantities if needed, and retry only the failed lines.</Alert>}
          <div className="dispatch-footer"><Link className="factory-secondary-button" href="/factory/requisitions">Cancel</Link><button className="factory-primary-button" type="button" disabled={!lines.length || dispatchMutation.isPending || requisition.status.toLowerCase() !== "approved"} onClick={() => dispatchMutation.mutate(failedIds.length ? failedIds : lines.filter((line) => progress[line.id]?.status !== "success").map((line) => line.id))}>{dispatchMutation.isPending ? "Submitting lines…" : failedIds.length ? `Retry ${failedIds.length} failed line${failedIds.length === 1 ? "" : "s"}` : "Create dispatch tickets"}</button></div>
        </CardContent></Card>
      </> : null}
      {sitesQuery.isError && <Alert variant="destructive" className="factory-stock-alert">Sites could not be loaded: {sitesQuery.error.message}</Alert>}
    </div>
  );
}
