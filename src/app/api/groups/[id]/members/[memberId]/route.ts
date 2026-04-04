import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/groups/[id]/members/[memberId] — Обновить прогресс участника группы
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const body = await request.json();
    const { progressPercent } = body;

    if (progressPercent === undefined) {
      return NextResponse.json(
        { error: "Поле 'progressPercent' обязательно" },
        { status: 400 }
      );
    }

    // Валидация: прогресс должен быть в диапазоне 0–100
    const progress = Number(progressPercent);
    if (progress < 0 || progress > 100) {
      return NextResponse.json(
        { error: "Прогресс должен быть от 0 до 100" },
        { status: 400 }
      );
    }

    // Проверяем, что участник принадлежит указанной группе
    const existingMember = await prisma.groupMember.findFirst({
      where: { id: memberId, groupId: id },
    });

    if (!existingMember) {
      return NextResponse.json(
        { error: "Участник не найден в данной группе" },
        { status: 404 }
      );
    }

    const member = await prisma.groupMember.update({
      where: { id: memberId },
      data: { progressPercent: progress },
      include: {
        employee: true,
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error("Ошибка при обновлении прогресса участника:", error);
    return NextResponse.json(
      { error: "Не удалось обновить прогресс участника" },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id]/members/[memberId] — Удалить участника из группы
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;

    // Проверяем, что участник принадлежит указанной группе
    const existingMember = await prisma.groupMember.findFirst({
      where: { id: memberId, groupId: id },
    });

    if (!existingMember) {
      return NextResponse.json(
        { error: "Участник не найден в данной группе" },
        { status: 404 }
      );
    }

    await prisma.groupMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ message: "Участник удалён из группы" });
  } catch (error) {
    console.error("Ошибка при удалении участника из группы:", error);
    return NextResponse.json(
      { error: "Не удалось удалить участника из группы" },
      { status: 500 }
    );
  }
}
