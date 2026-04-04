import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// PUT /api/courses/[id]/modules/[moduleId] — Обновить модуль
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const { id, moduleId } = await params;
    const body = await request.json();
    const { title, type, durationHours, orderIndex, description } = body;

    // Проверяем, что модуль принадлежит курсу
    const existing = await prisma.courseModule.findFirst({
      where: { id: moduleId, courseId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Модуль не найден" }, { status: 404 });
    }

    const updated = await prisma.courseModule.update({
      where: { id: moduleId },
      data: {
        ...(title !== undefined && { title }),
        ...(type !== undefined && { type }),
        ...(durationHours !== undefined && { durationHours: Number(durationHours) }),
        ...(orderIndex !== undefined && { orderIndex: Number(orderIndex) }),
        ...(description !== undefined && { description }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Ошибка при обновлении модуля:", error);
    return NextResponse.json(
      { error: "Не удалось обновить модуль" },
      { status: 500 }
    );
  }
}

// DELETE /api/courses/[id]/modules/[moduleId] — Удалить модуль
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const { id, moduleId } = await params;

    // Проверяем, что модуль принадлежит курсу
    const existing = await prisma.courseModule.findFirst({
      where: { id: moduleId, courseId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Модуль не найден" }, { status: 404 });
    }

    await prisma.courseModule.delete({ where: { id: moduleId } });

    return NextResponse.json({ message: "Модуль удалён" });
  } catch (error) {
    console.error("Ошибка при удалении модуля:", error);
    return NextResponse.json(
      { error: "Не удалось удалить модуль" },
      { status: 500 }
    );
  }
}
