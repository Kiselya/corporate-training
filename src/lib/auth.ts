import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const SECRET = process.env.NEXTAUTH_SECRET || "hackathon-secret-2026";
const COOKIE_NAME = "session";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  mustChangePassword: boolean;
  companyId?: string | null;
  impersonatedBy?: string;
}

/**
 * Создание JWT-токена для пользователя
 */
export function createSessionToken(user: SessionUser): string {
  return jwt.sign(user, SECRET, { expiresIn: "7d" });
}

/**
 * Чтение сессии из cookie — возвращает пользователя или null
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = jwt.verify(token, SECRET) as SessionUser;
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      mustChangePassword: payload.mustChangePassword,
      ...(payload.companyId ? { companyId: payload.companyId } : {}),
      ...(payload.impersonatedBy ? { impersonatedBy: payload.impersonatedBy } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Установка session cookie с JWT-токеном
 */
export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 дней
  });
}

/**
 * Удаление session cookie (выход из системы)
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Требование аутентификации — возвращает пользователя или бросает ошибку
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "Необходима авторизация" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

/**
 * Требование роли администратора — бросает 403 если не админ
 */
/**
 * Требование роли администратора (ADMIN или SUPER_ADMIN)
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    throw new Response(JSON.stringify({ error: "Доступ запрещён: требуется роль администратора" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

/**
 * Требование роли суперадмина (только SUPER_ADMIN)
 */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== "SUPER_ADMIN") {
    throw new Response(JSON.stringify({ error: "Доступ запрещён: требуется роль суперадминистратора" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}
