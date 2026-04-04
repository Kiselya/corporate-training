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
    const { role, isActive, companyId, email } = body;

    // Себе можно менять только email
    if (id === session.id && (role || isActive !== undefined || companyId !== undefined)) {
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
    if (email !== undefined) updateData.email = email;

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

// DELETE /api/auth/users/[id] — Удалить пользователя
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    if (id === session.id) {
      return NextResponse.json({ error: "Нельзя удалить себя" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    // ADMIN может удалять только пользователей своей компании
    if (session.role === "ADMIN" && session.companyId) {
      if (target.companyId !== session.companyId) {
        return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
      }
      // ADMIN не может удалить другого ADMIN или SUPER_ADMIN
      if (target.role !== "USER") {
        return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
      }
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: "Пользователь удалён" });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
