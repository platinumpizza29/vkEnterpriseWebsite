import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";

export const metadata: Metadata = {
  title: "Admin Workspace | VK Enterprise",
  description: "Organization-wide operations and approvals.",
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <DashboardShell>{children}</DashboardShell>;
}
