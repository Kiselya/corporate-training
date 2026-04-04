import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * PUT /api/auth/invites/[id]
 * Обновление приглашения (активация/деактивация).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const invite = await prisma.inviteLink.findUnique({ where: { id } });
    if (!invite) {
      return NextResponse.json(
        { error: "Приглашение не найдено" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    const updated = await prisma.inviteLink.update({
      where: { id },
      data,
    });

    return NextResponse.json({ invite: updated });
  } catch (error) {
    console.error("Ошибка обновления приглашения:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/invites/[id]
 * Деактивация приглашения (только для администратора).
 * Не удаляет запись — помечает isActive = false.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;

    // Check for permanent deletion via query param or body
    const url = new URL(request.url);
    const permanentParam = url.searchParams.get("permanent") === "true";
    let permanentBody = false;
    try {
      const body = await request.clone().json();
      permanentBody = body?.permanent === true;
    } catch {
      // No body or invalid JSON — that's fine
    }
    const permanent = permanentParam || permanentBody;

    // Проверка существования приглашения
    const invite = await prisma.inviteLink.findUnique({ where: { id } });
    if (!invite) {
      return NextResponse.json(
        { error: "Приглашение не найдено" },
        { status: 404 }
      );
    }

    if (permanent) {
      // Permanently delete the invite
      await prisma.inviteLink.delete({ where: { id } });
      return NextResponse.json({ success: true, deleted: true });
    }

    // Деактивация приглашения
    const updated = await prisma.inviteLink.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ invite: updated });
  } catch (error) {
    console.error("Ошибка деактивации/удаления приглашения:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
