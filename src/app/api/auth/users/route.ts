import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/auth/users — Список всех пользователей системы
 * Доступ: ADMIN, SUPER_ADMIN
 */
export async function GET() {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        companyId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Ошибка загрузки пользователей" }, { status: 500 });
  }
}
