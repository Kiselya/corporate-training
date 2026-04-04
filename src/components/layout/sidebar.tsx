"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  UserCheck,
  Building2,
  BarChart3,
  FileText,
  FileInput,
  Shield,
  LogOut,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, isAdminOrAbove, isSuperAdmin, ROLE_LABELS, ROLE_COLORS } from "@/lib/auth-context";

// Навигация для SUPER_ADMIN — все разделы без ограничений
const superAdminNavigation = [
  { name: "Дашборд", href: "/", icon: LayoutDashboard },
  { name: "Учебные группы", href: "/groups", icon: Users },
  { name: "Курсы", href: "/courses", icon: BookOpen },
  { name: "Учащиеся", href: "/employees", icon: UserCheck },
  { name: "Компании", href: "/companies", icon: Building2 },
  { name: "Диаграмма Ганта", href: "/gantt", icon: BarChart3 },
  { name: "Спецификации", href: "/specifications", icon: FileText },
];

// Навигация для ADMIN — ограниченный набор (без Компаний и Спецификаций)
const adminNavigation = [
  { name: "Дашборд", href: "/", icon: LayoutDashboard },
  { name: "Учебные группы", href: "/groups", icon: Users },
  { name: "Курсы", href: "/courses", icon: BookOpen },
  { name: "Учащиеся", href: "/employees", icon: UserCheck },
  { name: "Диаграмма Ганта", href: "/gantt", icon: BarChart3 },
];

// Навигация для обычных пользователей (USER) — только личные разделы
const userNavigation = [
  { name: "Дашборд", href: "/", icon: LayoutDashboard },
  { name: "Мои курсы", href: "/my-courses", icon: BookOpen },
  { name: "Диаграмма Ганта", href: "/gantt", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, loading, logout, impersonating, stopImpersonating } = useAuth();

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-slate-700/50 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700/60">
          <GraduationCap className="h-5 w-5 text-slate-200" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight tracking-tight text-white">
            Corporate Training
          </span>
          <span className="text-[11px] leading-tight text-slate-400">
            Global ERP
          </span>
        </div>
      </div>

      {/* Impersonation Banner */}
      {impersonating && user && (
        <div className="mx-3 mt-3 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-300">
              Режим просмотра
            </span>
          </div>
          <p className="text-[11px] text-amber-200/80 mb-2 leading-relaxed">
            Вы просматриваете как {user.name || user.email}
          </p>
          <button
            onClick={stopImpersonating}
            className="w-full rounded-md bg-amber-500/30 px-2 py-1.5 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-500/40"
          >
            Вернуться в свой аккаунт
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {(isSuperAdmin(user?.role) ? superAdminNavigation : isAdminOrAbove(user?.role) ? adminNavigation : userNavigation).map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-700/70 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {item.name}
            </Link>
          );
        })}

        {/* Администрирование — для ADMIN и SUPER_ADMIN */}
        {isAdminOrAbove(user?.role) && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === "/admin"
                ? "bg-slate-700/70 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            <Shield className="h-[18px] w-[18px] shrink-0" />
            Администрирование
          </Link>
        )}
        {isSuperAdmin(user?.role) && (
          <Link
            href="/admin/integration-log"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith("/admin/integration-log")
                ? "bg-slate-700/70 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            <FileInput className="h-[18px] w-[18px] shrink-0" />
            Лог интеграции
          </Link>
        )}
      </nav>

      {/* Блок пользователя — всегда внизу */}
      <div className="border-t border-slate-700/50 px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-1">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ) : user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-medium uppercase text-slate-200">
                {(user.name || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight text-white">
                  {user.name || "Без имени"}
                </p>
                <p className="truncate text-[11px] leading-tight text-slate-400">
                  {user.email}
                </p>
              </div>
            </div>
            {/* Роль */}
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none",
                  user.role === "SUPER_ADMIN"
                    ? "bg-red-500/20 text-red-300"
                    : user.role === "ADMIN"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-blue-500/20 text-blue-300"
                )}
              >
                {ROLE_LABELS[user.role] || user.role}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="h-3 w-3" />
                Выйти
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">v1.0.0</p>
        )}
      </div>
    </aside>
  );
}
