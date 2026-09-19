export type FactoryItem = { id: string; name: string; unit: string; code?: string };
export type RequisitionLine = { id: string; itemId: string; quantity: number };
export type RequisitionRecord = {
  id: string;
  siteId: string;
  taskDescription: string;
  requestedBy: string;
  approvedAt: string;
  createdAt: string;
  status: string;
  lines: RequisitionLine[];
};
export type DispatchTicket = {
  id: string;
  requisitionId: string;
  siteId: string;
  itemId: string;
  dispatchedQuantity: number;
  status: string;
  dispatchedAt: string;
  receivedAt: string;
  closedAt: string;
  receivedQuantity?: number;
};

export function records(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object"));
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["items", "data", "requisitions", "tickets", "users", "entries", "petty_cash", "attendance", "sites", "results", "rows"]) {
      if (Array.isArray(record[key])) return records(record[key]);
    }
  }
  return [];
}

export function value(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (record[key] !== undefined && record[key] !== null) return record[key];
  return undefined;
}

export function normalizeItem(item: Record<string, unknown>): FactoryItem {
  return {
    id: String(value(item, "ID", "id", "ItemID", "item_id") ?? ""),
    name: String(value(item, "Name", "name", "ItemName", "item_name") ?? "Unknown item"),
    unit: String(value(item, "Unit", "unit") ?? ""),
    code: String(value(item, "Code", "code") ?? ""),
  };
}

export function normalizeRequisition(payload: unknown): RequisitionRecord {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const req = (value(root, "requisition", "Requisition") ?? root) as Record<string, unknown>;
  const linePayload = value(root, "lines", "Lines") ?? value(req, "Lines", "lines");
  const lines = Array.isArray(linePayload) ? linePayload.filter((line): line is Record<string, unknown> => Boolean(line && typeof line === "object")).map((line, index) => ({
    id: String(value(line, "ID", "id") ?? index),
    itemId: String(value(line, "ItemID", "item_id", "itemId") ?? ""),
    quantity: Number(value(line, "RequestedQuantity", "requested_quantity", "Quantity", "quantity") ?? 0),
  })) : [];
  const requestedByValue = value(req, "RequestedByName", "RequestedBy", "requested_by");
  const requestedBy = requestedByValue && typeof requestedByValue === "object"
    ? String(value(requestedByValue as Record<string, unknown>, "Name", "name", "Email", "email", "ID", "id") ?? "—")
    : String(requestedByValue ?? "—");
  return {
    id: String(value(req, "ID", "id") ?? ""),
    siteId: String(value(req, "SiteID", "site_id", "siteId") ?? ""),
    taskDescription: String(value(req, "TaskDescription", "task_description", "description") ?? "—"),
    requestedBy,
    approvedAt: String(value(req, "ApprovedAt", "approved_at") ?? ""),
    createdAt: String(value(req, "CreatedAt", "created_at") ?? ""),
    status: String(value(req, "Status", "status") ?? ""),
    lines,
  };
}

export function normalizeTicket(ticket: Record<string, unknown>): DispatchTicket {
  return {
    id: String(value(ticket, "ID", "id") ?? ""),
    requisitionId: String(value(ticket, "RequisitionID", "requisition_id") ?? ""),
    siteId: String(value(ticket, "SiteID", "site_id") ?? ""),
    itemId: String(value(ticket, "ItemID", "item_id") ?? ""),
    dispatchedQuantity: Number(value(ticket, "DispatchedQuantity", "dispatched_quantity", "Quantity", "quantity") ?? 0),
    status: String(value(ticket, "Status", "status") ?? "dispatched").toLowerCase(),
    dispatchedAt: String(value(ticket, "DispatchedAt", "dispatched_at") ?? ""),
    receivedAt: String(value(ticket, "ReceivedAt", "received_at") ?? ""),
    closedAt: String(value(ticket, "ClosedAt", "closed_at") ?? ""),
    receivedQuantity: Number(value(ticket, "ReceivedQuantity", "received_quantity") ?? 0),
  };
}

export function formatDate(value: string) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "—";
}
