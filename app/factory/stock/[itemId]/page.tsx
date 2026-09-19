import type { Metadata } from "next";
import StockItemDetail from "./stock-item-detail";

export const metadata: Metadata = {
  title: "Stock Item Details | VK Enterprise",
};

export default async function StockItemPage({ params }: PageProps<"/factory/stock/[itemId]">) {
  const { itemId } = await params;
  return <StockItemDetail itemId={itemId} />;
}
