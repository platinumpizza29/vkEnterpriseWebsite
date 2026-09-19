import { DashboardShell } from "@/components/dashboard-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Factory Dashboard | VK Enterprise",
  description: "Factory stock and dispatch overview for VK Enterprise.",
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <DashboardShell>{children}</DashboardShell>;
}
