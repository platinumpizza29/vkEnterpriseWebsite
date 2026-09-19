import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";

export const metadata: Metadata = {
  title: "Factory Operations | VK Enterprise",
  description: "Manage factory stock and material movements.",
};

export default function FactoryLayout({ children }: LayoutProps<"/factory">) {
  return <DashboardShell>{children}</DashboardShell>;
}
