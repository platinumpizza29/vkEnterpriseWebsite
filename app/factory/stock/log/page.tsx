"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useDashboardSession } from "@/components/dashboard-session";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHubSite } from "@/hooks/use-hub-site";
import { apiGet, apiPost } from "@/lib/api";

type InventoryItem = { ID?: string; id?: string; Name?: string; name?: string; Code?: string; Unit?: string; IsActive?: boolean; is_active?: boolean };
const inflowSchema = z.object({
  itemId: z.string().min(1, "Choose an inventory item."),
  quantity: z.number({ error: "Enter a quantity." }).positive("Quantity must be greater than 0."),
  source: z.enum(["production", "external"], { error: "Choose a source." }),
});
type InflowForm = z.infer<typeof inflowSchema>;

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["items", "data", "inventory_items"]) if (Array.isArray(record[key])) return record[key] as T[];
  }
  return [];
}

function itemId(item: InventoryItem) { return item.ID ?? item.id ?? ""; }
function itemName(item: InventoryItem) { return item.Name ?? item.name ?? "Unnamed item"; }

export default function LogFactoryStockPage() {
  const session = useDashboardSession();
  const { hubSite } = useHubSite();
  const queryClient = useQueryClient();
  const router = useRouter();
  const hasAccess = session?.role === "factory_manager" || session?.role === "admin";
  const [itemSearch, setItemSearch] = useState("");
  const form = useForm<InflowForm>({
    resolver: zodResolver(inflowSchema),
    defaultValues: { itemId: "", quantity: undefined, source: "production" },
  });
  const selectedSource = useWatch({ control: form.control, name: "source" });

  const itemsQuery = useQuery({
    queryKey: ["factory-stock", "items"],
    queryFn: async () => asArray<InventoryItem>(await apiGet<unknown>("/inventory-items", session!.token)).filter((item) => (item.IsActive ?? item.is_active) !== false && Boolean(itemId(item))),
    enabled: Boolean(session?.token && hasAccess),
    retry: false,
  });
  const filteredItems = useMemo(() => {
    const search = itemSearch.trim().toLocaleLowerCase();
    return (itemsQuery.data ?? []).filter((item) => !search || `${itemName(item)} ${item.Code ?? ""}`.toLocaleLowerCase().includes(search));
  }, [itemsQuery.data, itemSearch]);

  const mutation = useMutation({
    mutationFn: (values: InflowForm) => apiPost("/inventory/factory-inflow", session!.token, {
      item_id: values.itemId,
      quantity: values.quantity,
      source: values.source,
    }),
    onSuccess: async (_result, values) => {
      const label = itemsQuery.data?.find((item) => itemId(item) === values.itemId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["factory-stock"] }),
        queryClient.invalidateQueries({ queryKey: ["factory-stock-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["factory-stock-history"] }),
        queryClient.invalidateQueries({ queryKey: ["factory-dashboard", "hub-stock"] }),
      ]);
      toast.success("Incoming stock logged", { description: `${values.quantity} ${label?.Unit ?? "units"} of ${label ? itemName(label) : "stock"} added.` });
      router.push("/factory/stock");
    },
  });

  if (!hasAccess) return <div className="log-stock-page"><div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">INVENTORY / STOCK INTAKE</div><h1>Log incoming stock</h1><p>Record stock received from production or an external source.</p></div></div><Alert variant="destructive">Factory Manager or administrator access is required to log factory stock.</Alert></div>;

  const quantityError = form.formState.errors.quantity?.message;
  const itemError = form.formState.errors.itemId?.message;
  const sourceError = form.formState.errors.source?.message;

  return (
    <div className="log-stock-page">
      <div className="stock-detail-breadcrumb"><Link href="/factory/stock">Factory stock</Link><span>/</span><span>Log incoming stock</span></div>
      <div className="factory-stock-heading"><div><div className="dashboard-page-heading__eyebrow">INVENTORY / STOCK INTAKE</div><h1>Log incoming stock</h1><p>Record stock received from production or an external source.</p></div></div>

      {itemsQuery.isError && <Alert variant="destructive" className="factory-stock-alert"><span>Inventory items could not be loaded: {itemsQuery.error.message}</span><button type="button" onClick={() => void itemsQuery.refetch()}>Retry</button></Alert>}

      <Card className="log-stock-card">
        <CardContent className="log-stock-card__content">
          <div className="log-stock-card__intro"><span className="log-stock-icon" aria-hidden="true">⇧</span><div><h2>Stock entry</h2><p>{hubSite ? `Destination hub: ${hubSite.name}` : "Incoming material will be added to the factory inventory."}</p></div></div>

          {itemsQuery.isLoading ? <div className="log-stock-loading"><Skeleton /><Skeleton /><Skeleton /></div> : (
            <form className="log-stock-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
              <label className="log-stock-label" htmlFor="stock-item-search">Inventory item <span aria-hidden="true">*</span></label>
              <input id="stock-item-search" className="log-stock-input" type="search" autoComplete="off" placeholder="Search by item name or code" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} aria-describedby={itemError ? "stock-item-error" : undefined} />
              <select id="stock-item" className="log-stock-input" {...form.register("itemId")} aria-label="Select inventory item" aria-invalid={Boolean(itemError)} disabled={itemsQuery.isError || itemsQuery.data?.length === 0}>
                <option value="">Select an item</option>
                {filteredItems.map((item) => <option key={itemId(item)} value={itemId(item)}>{itemName(item)}{item.Code ? ` · ${item.Code}` : ""}</option>)}
              </select>
              {itemError && <p className="log-stock-field-error" id="stock-item-error">{itemError}</p>}
              {!itemError && itemSearch && filteredItems.length === 0 && <p className="log-stock-help">No inventory items match “{itemSearch}”.</p>}

              <label className="log-stock-label" htmlFor="stock-quantity">Quantity received <span aria-hidden="true">*</span></label>
              <input id="stock-quantity" className="log-stock-input" type="number" min="0" step="any" inputMode="decimal" placeholder="Enter quantity" aria-invalid={Boolean(quantityError)} aria-describedby={quantityError ? "stock-quantity-error" : undefined} {...form.register("quantity", { valueAsNumber: true })} />
              {quantityError && <p className="log-stock-field-error" id="stock-quantity-error">{quantityError}</p>}

              <span className="log-stock-label" id="stock-source-label">Source <span aria-hidden="true">*</span></span>
              <div className="log-stock-source-options" role="radiogroup" aria-labelledby="stock-source-label" aria-describedby={sourceError ? "stock-source-error" : undefined}>
                <label className={`log-stock-source-option${selectedSource === "production" ? " is-selected" : ""}`}><input type="radio" value="production" {...form.register("source")} /><span><strong>Production</strong><small>Made at the factory</small></span></label>
                <label className={`log-stock-source-option${selectedSource === "external" ? " is-selected" : ""}`}><input type="radio" value="external" {...form.register("source")} /><span><strong>External</strong><small>Received from outside</small></span></label>
              </div>
              {sourceError && <p className="log-stock-field-error" id="stock-source-error">{sourceError}</p>}

              {itemsQuery.data?.length === 0 && <p className="log-stock-empty">There are no active inventory items to receive stock for.</p>}
              {mutation.isError && <Alert variant="destructive" className="log-stock-submit-error" role="alert">Stock could not be logged: {mutation.error.message}</Alert>}
              <div className="log-stock-actions"><Link className="factory-secondary-button" href="/factory/stock">Cancel</Link><button className="factory-primary-button" type="submit" disabled={mutation.isPending || !itemsQuery.data?.length || itemsQuery.isError}><span>{mutation.isPending ? "Saving entry…" : "Save stock entry"}</span>{!mutation.isPending && <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}</button></div>
            </form>
          )}
        </CardContent>
      </Card>
      <Link className="factory-stock-back-link" href="/factory/stock"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16 10H4m5-5-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> Back to factory stock</Link>
    </div>
  );
}
