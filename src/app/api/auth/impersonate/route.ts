import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, setSessionCookie, type SessionUser } from "@/lib/auth";

/**
 * POST /api/auth/impersonate
 * SUPER_ADMIN может войти за любого пользователя.
 * ADMIN может войти только за USER своей компании.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId обязателен" },
        { status: 400 }
      );
    }

    if (userId === admin.id) {
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

    // ADMIN может входить только за USER своей компании
    if (admin.role === "ADMIN") {
      if (targetUser.role !== "USER") {
        return NextResponse.json(
          { error: "Можно войти только за пользователя с ролью Пользователь" },
          { status: 403 }
        );
      }
      if (admin.companyId && targetUser.companyId !== admin.companyId) {
        return NextResponse.json(
          { error: "Можно войти только за пользователя вашей компании" },
          { status: 403 }
        );
      }
    }

    const sessionUser: SessionUser = {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role as SessionUser["role"],
      mustChangePassword: false, // Don't force password change when impersonating
      ...(targetUser.companyId ? { companyId: targetUser.companyId } : {}),
      // Сохраняем оригинального инициатора (если уже в режиме имперсонации — берём его impersonatedBy)
      impersonatedBy: admin.impersonatedBy || admin.id,
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
