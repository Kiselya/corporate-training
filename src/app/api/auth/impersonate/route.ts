import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, setSessionCookie, type SessionUser } from "@/lib/auth";

/**
 * POST /api/auth/impersonate
 * Allows SUPER_ADMIN to impersonate another user.
 * Creates a session for the target user with impersonatedBy field.
 */
export async function POST(request: Request) {
  try {
    const superAdmin = await requireSuperAdmin();

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId обязателен" },
        { status: 400 }
      );
    }

    if (userId === superAdmin.id) {
      return NextResponse.json(
        { error: "Нельзя войти от своего имени" },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    // Create session for the target user with impersonatedBy
    const sessionUser: SessionUser = {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role as SessionUser["role"],
      mustChangePassword: false, // Don't force password change when impersonating
      ...(targetUser.companyId ? { companyId: targetUser.companyId } : {}),
      impersonatedBy: superAdmin.id,
    };

    await setSessionCookie(sessionUser);

    return NextResponse.json({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Ошибка имперсонации:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
