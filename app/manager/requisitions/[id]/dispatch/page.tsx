import type { Metadata } from "next";
import DispatchRequisitionPage from "@/app/factory/requisitions/[id]/dispatch/dispatch-requisition-page";

export const metadata: Metadata = { title: "Create Dispatch Ticket | VK Enterprise" };

export default async function DispatchPage({ params }: PageProps<"/manager/requisitions/[id]/dispatch">) {
  const { id } = await params;
  return <DispatchRequisitionPage requisitionId={id} basePath="/manager" ticketEndpoint="/tickets" />;
}
