import { DashboardShell } from "@/components/dashboard-shell";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Site Workspace | VK Enterprise" };
export default function SiteLayout({ children }: LayoutProps<"/site">) {
  return <DashboardShell>{children}</DashboardShell>;
}
