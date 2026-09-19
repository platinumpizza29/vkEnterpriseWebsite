"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardSessionProvider, useDashboardSession, useDashboardSessionReady } from "@/components/dashboard-session";
import { clearStoredSession } from "@/lib/session";

const factoryNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  { label: "Factory stock", href: "/factory/stock", icon: "box" },
  { label: "Log incoming stock", href: "/factory/stock/log", icon: "plus" },
  { label: "Requisitions", href: "/factory/requisitions", icon: "clipboard" },
  { label: "Dispatch tickets", href: "/factory/tickets", icon: "truck" },
];
const adminNavItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "grid" },
  { label: "Sites", href: "/admin/sites", icon: "site" },
  { label: "Users", href: "/admin/users", icon: "users" },
  { label: "Inventory Catalog", href: "/admin/inventory", icon: "box" },
  { label: "Requisitions", href: "/admin/requisitions", icon: "clipboard" },
  { label: "Tickets", href: "/admin/tickets", icon: "truck" },
  { label: "Petty Cash", href: "/admin/petty-cash", icon: "cash" },
  { label: "Attendance", href: "/admin/attendance", icon: "attendance" },
  { label: "Reports", href: "/admin/reports", icon: "reports" },
];
const managerNavItems = [
  { label: "Dashboard", href: "/manager/dashboard", icon: "grid" },
  { label: "Requisitions", href: "/factory/requisitions", icon: "clipboard" },
  { label: "Tickets", href: "/factory/tickets", icon: "truck" },
];
const siteNavItems = [{ label: "Dashboard", href: "/site/dashboard", icon: "grid" }];

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.8 7.5 4.4 7.5-4.4M12 12.5V21M8 5.3l8 4.6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /><circle cx="12" cy="12" r="9" /></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" /></>,
    truck: <><path d="M3 5h11v12H3zM14 9h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" /></>,
    site: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" /><path d="M8 9h.01M12 9h.01M16 9h.01" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8" /></>,
    cash: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18m-14 6h3m6-1v3" /><circle cx="15" cy="14" r="2" /></>,
    attendance: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4m8-4v4M3 9h18m-13 5 2 2 4-4" /></>,
    reports: <><path d="M4 20V10m5 10V4m5 16v-7m5 7V7" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useDashboardSession();
  const ready = useDashboardSessionReady();
  const role = session?.role ?? "factory_manager";
  const roleName = role === "admin" ? "Administrator" : role === "manager" ? "Manager" : role === "site_engineer" ? "Site Engineer" : "Factory Manager";
  const dashboardHref = role === "admin" ? "/admin/dashboard" : role === "manager" ? "/manager/dashboard" : role === "site_engineer" ? "/site/dashboard" : "/dashboard";
  const navItems = role === "admin" ? adminNavItems : role === "manager" ? managerNavItems : role === "site_engineer" ? siteNavItems : factoryNavItems;
  const currentPage = navItems.find((item) => item.href === pathname || (item.href !== dashboardHref && pathname.startsWith(item.href)))?.label
      ?? (pathname.startsWith("/factory/stock/log") ? "Log incoming stock"
        : pathname.startsWith("/factory/stock/") ? "Stock item details"
        : pathname.startsWith("/factory/stock") ? "Factory stock"
          : pathname.startsWith("/factory/requisitions/") ? "Create dispatch"
            : pathname.startsWith("/factory/requisitions") ? "Requisitions"
              : pathname.startsWith("/factory/tickets") ? "Tickets"
                : pathname.startsWith("/admin/") ? pathname.split("/").at(-1)?.replaceAll("-", " ") ?? "Dashboard" : "Dashboard");

  function signOut() {
    clearStoredSession();
    router.replace("/");
  }

  if (ready && !session) {
    return <div className="dashboard-auth-message"><strong>Sign in to continue</strong><p>Your VK Enterprise session is missing or has expired.</p><Link href="/">Return to sign in</Link></div>;
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link href={dashboardHref} className="dashboard-brand">
          <span className="dashboard-brand__mark"><span /><span /><span /></span>
          <span className="dashboard-brand__word">VK<span>ENTERPRISE</span></span>
        </Link>
          <div className="dashboard-workspace-label">{roleName.toUpperCase()} WORKSPACE</div>
        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          {navItems.map((item) => {
            const active = item.href === dashboardHref ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <Link aria-label={item.label} className={`dashboard-nav__link${active ? " is-active" : ""}`} href={item.href} key={item.href}><NavIcon name={item.icon} /><span>{item.label}</span>{active && <i />}</Link>;
          })}
        </nav>
        <div className="dashboard-sidebar__bottom">
          <div className="dashboard-sidebar__note"><span className="dashboard-live-dot" /><span>All systems operational</span></div>
          <button className="dashboard-signout" onClick={signOut} type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M21 3v18" /></svg> Sign out</button>
        </div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar__crumb"><span>VK Enterprise</span><span>/</span><strong>{currentPage}</strong></div>
          <div className="dashboard-topbar__user"><span className="dashboard-topbar__avatar">{(session?.Name || session?.email || roleName).slice(0, 1).toUpperCase()}</span><span><strong>{session?.Name || roleName}</strong><small>{roleName}</small></span><span className="dashboard-topbar__chevron">⌄</span></div>
        </header>
        <main className="dashboard-content">{!ready ? <div className="dashboard-loading-shell" /> : children}</main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return <DashboardSessionProvider><ShellFrame>{children}</ShellFrame></DashboardSessionProvider>;
}
