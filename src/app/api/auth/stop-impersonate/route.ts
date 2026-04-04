import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, setSessionCookie, type SessionUser } from "@/lib/auth";

/**
 * POST /api/auth/stop-impersonate
 * Stops impersonation and restores the original SUPER_ADMIN session.
 */
export async function POST() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Необходима авторизация" },
        { status: 401 }
      );
    }

    if (!session.impersonatedBy) {
      return NextResponse.json(
        { error: "Вы не находитесь в режиме имперсонации" },
        { status: 400 }
      );
    }

    // Load the original super admin from DB
    const superAdmin = await prisma.user.findUnique({
      where: { id: session.impersonatedBy },
    });

    if (!superAdmin) {
      return NextResponse.json(
        { error: "Оригинальный пользователь не найден" },
        { status: 404 }
      );
    }

    // Restore the super admin session (without impersonatedBy)
    const superAdminSession: SessionUser = {
      id: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
      role: superAdmin.role as SessionUser["role"],
      mustChangePassword: superAdmin.mustChangePassword,
    };

    await setSessionCookie(superAdminSession);

    return NextResponse.json({
      user: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: superAdmin.role,
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Ошибка остановки имперсонации:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
