import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bot, LayoutDashboard, LogOut, Users } from "lucide-react";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { clearToken } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "관리자 목록", icon: Users, exact: false },
] as const;

export function AdminShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  function logout() {
    clearToken();
    void navigate({ to: "/admin/login" });
  }

  return (
    <div className="flex min-h-screen bg-muted/30 text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <Bot className="size-5 text-primary" />
          <span className="font-semibold tracking-tight">Labi Admin</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="m-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="size-4" />
          로그아웃
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            <LogOut className="size-4" />
            로그아웃
          </button>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      <Toaster />
    </div>
  );
}
