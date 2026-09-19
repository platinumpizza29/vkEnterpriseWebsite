import type { Metadata } from "next";
import DispatchRequisitionPage from "./dispatch-requisition-page";

export const metadata: Metadata = { title: "Create Dispatch Ticket | VK Enterprise" };

export default async function DispatchPage({ params }: PageProps<"/factory/requisitions/[id]/dispatch">) {
  const { id } = await params;
  return <DispatchRequisitionPage requisitionId={id} />;
}
