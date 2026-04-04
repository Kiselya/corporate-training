import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin, getSession } from "@/lib/auth";

/**
 * PUT /api/auth/users/[id] — Изменить роль или деактивировать пользователя
 *
 * Правила:
 * - SUPER_ADMIN может менять роль любого пользователя (включая назначение ADMIN)
 * - ADMIN может только деактивировать USER-ов (не может назначать админов)
 * - Нельзя менять роль самому себе
 * - Нельзя деактивировать суперадмина
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { role, isActive, companyId } = body;

    // Нельзя менять себя
    if (id === session.id) {
      return NextResponse.json(
        { error: "Нельзя изменить собственную роль" },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    // Нельзя трогать суперадмина (если ты не суперадмин)
    if (targetUser.role === "SUPER_ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Недостаточно прав для изменения суперадмина" },
        { status: 403 }
      );
    }

    // Назначение ADMIN/SUPER_ADMIN — только суперадмин
    if (role && (role === "ADMIN" || role === "SUPER_ADMIN") && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Только суперадмин может назначать администраторов" },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (companyId !== undefined) updateData.companyId = companyId;

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Ошибка обновления пользователя" }, { status: 500 });
  }
}
