import FactoryTicketsPage from "@/app/factory/tickets/page";

export default async function ManagerTicketsPage({ searchParams }: PageProps<"/manager/tickets">) {
  const { requisition_id: requisitionId } = await searchParams;
  return <FactoryTicketsPage requisitionId={requisitionId} />;
}
