import { DashboardShell } from "@/components/dashboard-shell";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Manager Workspace | VK Enterprise" };
export default function ManagerLayout({ children }: LayoutProps<"/manager">) {
  return <DashboardShell>{children}</DashboardShell>;
}
