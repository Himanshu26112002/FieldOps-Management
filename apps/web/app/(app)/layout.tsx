"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { getFirebase } from "@/lib/firebase/client";
import { SessionProvider, useSession } from "@/lib/session";
import { fetchUnreadNotificationCount, NOTIFICATIONS_CHANGED_EVENT } from "@/lib/data";
import { initials } from "@/lib/format";
import { Alert, Button } from "@/components/ui";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, admin: true },
  { href: "/clients", label: "Clients", icon: Building2, admin: true },
  { href: "/salespeople", label: "Salespeople", icon: Users, admin: true },
  { href: "/visits", label: "Visits", icon: FileText, admin: true },
  { href: "/followups", label: "Follow-ups", icon: CheckSquare, admin: true },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, admin: true },
  { href: "/notifications", label: "Notifications", icon: Bell, admin: true },
  { href: "/reports", label: "Reports", icon: BarChart3, admin: true },
  { href: "/audit", label: "Audit log", icon: ShieldCheck, admin: true },
  { href: "/settings", label: "Settings", icon: Settings, admin: true },
];

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading, error, refresh } = useSession();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [navPath, setNavPath] = useState(pathname);

  useEffect(() => {
    if (!session) return;
    // A server-side count costs one read instead of one per notification.
    const update = () => {
      fetchUnreadNotificationCount()
        .then(setUnread)
        .catch(() => {});
    };
    update();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, update);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, update);
  }, [session]);

  // Close the mobile menu on navigation (adjusting state during render instead of in an effect).
  if (navPath !== pathname) {
    setNavPath(pathname);
    setOpen(false);
  }

  const filteredNav = useMemo(() => {
    if (!session) return [];
    if (session.role === "USER") {
      return nav.filter((item) =>
        ["/dashboard", "/clients", "/visits", "/followups", "/calendar", "/notifications"].includes(item.href),
      );
    }
    return nav;
  }, [session]);

  async function logout() {
    const { auth } = getFirebase();
    await signOut(auth);
    router.replace("/login");
  }

  if (!loading && !session && error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-md space-y-3">
          <Alert>{error}</Alert>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={logout}>
              Sign out
            </Button>
            <Button onClick={() => void refresh()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
          Loading workspace…
        </div>
      </div>
    );
  }

  const sections = [
    { title: "Operations", items: filteredNav.filter((item) => ["/dashboard", "/clients", "/salespeople", "/visits", "/followups", "/calendar"].includes(item.href)) },
    { title: "Insights", items: filteredNav.filter((item) => ["/reports", "/audit"].includes(item.href)) },
    { title: "Workspace", items: filteredNav.filter((item) => ["/notifications", "/settings"].includes(item.href)) },
  ].filter((section) => section.items.length > 0);
  const current = nav.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  // Salespeople only reach the pages in their reduced navigation; admin pages are blocked even by direct URL.
  const allowed = pathname === "/" || filteredNav.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background text-foreground lg:pl-64">
      {open ? <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden /> : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-nav text-nav-foreground transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-nav-border px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#2b4fb3] to-[#16295f] text-sm font-bold tracking-wide text-white ring-1 ring-white/15">
            FO
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold leading-tight text-white">FieldOps</span>
            <span className="block truncate text-xs text-nav-muted">{session.organization.name}</span>
          </span>
          <button onClick={() => setOpen(false)} className="ml-auto rounded-md p-1 text-nav-muted hover:text-white lg:hidden" aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-nav-muted">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                        active ? "bg-white/[0.08] font-medium text-nav-active" : "text-nav-foreground hover:bg-nav-hover hover:text-white"
                      }`}
                    >
                      {active ? <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-accent" aria-hidden /> : null}
                      <Icon size={17} className={active ? "text-white" : "text-nav-muted group-hover:text-white"} />
                      <span className="flex-1">{item.label}</span>
                      {item.href === "/notifications" && unread > 0 ? (
                        <span className="tabular rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-[#1a1406]">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        {session.role === "ADMIN" ? (
          <div className="mx-3 mb-3 rounded-lg border border-nav-border bg-white/[0.03] p-3 text-[11.5px] leading-relaxed text-nav-muted">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-nav-foreground">
              <ClipboardList size={13} /> Spark plan
            </p>
            Photos are stored in Firestore. Keep the library small and archive old visits.
          </div>
        ) : null}
        <div className="flex items-center gap-3 border-t border-nav-border px-4 py-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {initials(session.profile.fullName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{session.profile.fullName}</span>
            <span className="block text-xs text-nav-muted">{session.role === "ADMIN" ? "Administrator" : "Salesperson"}</span>
          </span>
          <button onClick={logout} className="rounded-md p-1.5 text-nav-muted transition hover:bg-nav-hover hover:text-white" aria-label="Sign out" title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setOpen((value) => !value)}
              className="rounded-lg border border-border p-2 text-muted hover:text-foreground lg:hidden"
              aria-label="Toggle navigation"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{current?.label ?? "FieldOps"}</p>
              <p className="hidden truncate text-xs text-muted sm:block">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/notifications"
              className="relative rounded-lg border border-border bg-card p-2 text-muted shadow-card transition hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unread > 0 ? (
                <span className="tabular absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-card">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <span className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card pl-1 pr-3 shadow-card sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
                {initials(session.profile.fullName)}
              </span>
              <span className="text-sm font-medium">{session.profile.fullName.split(" ")[0]}</span>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl min-w-0 space-y-6 px-4 py-8 sm:px-8">
        {error ? <Alert tone="warning">{error}</Alert> : null}
        {allowed ? children : <Alert tone="warning">This page is only available to administrators.</Alert>}
      </main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
