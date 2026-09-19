import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export function RoleDashboard({ role }: { role: "manager" | "site_engineer" }) {
  const manager = role === "manager";
  return (
    <div className="role-dashboard">
      <div className="dashboard-page-heading"><div><div className="dashboard-page-heading__eyebrow">{manager ? "OPERATIONS / MANAGER" : "SITE OPERATIONS"}</div><h1>{manager ? "Manager dashboard" : "Site dashboard"}</h1><p>{manager ? "Review operations and keep requisitions moving." : "Your site workspace is ready."}</p></div></div>
      {manager ? <div className="role-dashboard-links"><Link href="/factory/requisitions"><Card><CardContent><span className="role-dashboard-icon">R</span><h2>Requisitions</h2><p>Review approved requests and prepare dispatches.</p><b>Open requisitions <span aria-hidden="true">→</span></b></CardContent></Card></Link><Link href="/factory/tickets"><Card><CardContent><span className="role-dashboard-icon">T</span><h2>Dispatch tickets</h2><p>Track dispatches and site receipt progress.</p><b>View tickets <span aria-hidden="true">→</span></b></CardContent></Card></Link></div> : <Card className="role-dashboard-note"><CardContent><h2>Welcome to your site workspace</h2><p>Site activity and attendance screens will be available here as they are added.</p></CardContent></Card>}
    </div>
  );
}
