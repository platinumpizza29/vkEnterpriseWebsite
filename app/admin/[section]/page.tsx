import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

const sections: Record<string, { title: string; description: string }> = {
  sites: { title: "Sites", description: "Manage active locations and hub configuration." },
  users: { title: "Users", description: "Manage organization accounts and role assignments." },
  inventory: { title: "Inventory Catalog", description: "Manage shared inventory items and reorder thresholds." },
  "petty-cash": { title: "Petty Cash", description: "Review and manage petty cash submissions." },
  attendance: { title: "Attendance", description: "Review attendance activity across sites." },
  reports: { title: "Reports", description: "View organization-wide operational reports." },
  stock: { title: "Stock Overview", description: "Review stock balances across active sites." },
};

export default async function AdminSectionPage({ params }: PageProps<"/admin/[section]">) {
  const { section } = await params;
  const content = sections[section];
  if (!content) notFound();
  return <div className="admin-dashboard"><div className="dashboard-page-heading"><div><div className="dashboard-page-heading__eyebrow">ADMIN / MANAGEMENT</div><h1>{content.title}</h1><p>{content.description}</p></div></div><Card><CardContent><Alert>This management screen is not part of the current dashboard build.</Alert><Link className="factory-stock-back-link" href="/admin/dashboard">Back to admin dashboard</Link></CardContent></Card></div>;
}
