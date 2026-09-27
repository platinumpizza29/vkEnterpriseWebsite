import FactoryTicketsPage from "@/app/factory/tickets/page";

export default async function ManagerTicketsPage({ searchParams }: PageProps<"/manager/tickets">) {
  const params = await searchParams;
  const requisitionId = typeof params.requisition_id === "string" ? params.requisition_id : undefined;
  return <FactoryTicketsPage requisitionId={requisitionId} />;
}
