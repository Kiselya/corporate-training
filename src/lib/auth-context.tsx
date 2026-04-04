"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "USER";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId?: string | null;
  impersonatedBy?: string;
}

// Утилиты проверки ролей
export function isAdminOrAbove(role?: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdmin(role?: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Суперадмин",
  ADMIN: "Администратор",
  USER: "Пользователь",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700",
  ADMIN: "bg-amber-100 text-amber-700",
  USER: "bg-blue-100 text-blue-700",
};

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  impersonating: boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  stopImpersonating: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        // API возвращает { user: {...} } — извлекаем вложенный объект
        setUser(data.user ?? data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Рефетч сессии при каждой смене pathname
  useEffect(() => {
    fetchUser();
  }, [fetchUser, pathname]);

  // Принудительная перезагрузка при восстановлении из bfcache (кнопка "Назад" браузера)
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  const stopImpersonating = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/stop-impersonate", { method: "POST" });
      if (res.ok) {
        await fetchUser();
        router.push("/");
      }
    } catch (e) {
      console.error("Failed to stop impersonating:", e);
    }
  }, [fetchUser, router]);

  const impersonating = Boolean(user?.impersonatedBy);

  return (
    <AuthContext.Provider value={{ user, loading, impersonating, logout, refetch: fetchUser, stopImpersonating }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
