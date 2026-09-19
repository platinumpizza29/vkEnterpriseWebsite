import AdminTicketsClient from "./tickets-client";

export default async function AdminTicketsPage({ searchParams }: PageProps<"/admin/tickets">) {
  const params = await searchParams;
  const requisitionId = typeof params.requisition_id === "string" ? params.requisition_id : "";
  return <AdminTicketsClient requisitionId={requisitionId} />;
}
