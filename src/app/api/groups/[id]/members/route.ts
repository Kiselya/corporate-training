import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/groups/[id]/members — Получить список участников группы с прогрессом обучения
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Проверяем существование группы
    const group = await prisma.trainingGroup.findUnique({
      where: { id },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Группа не найдена" },
        { status: 404 }
      );
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId: id },
      include: {
        employee: {
          include: {
            company: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Ошибка при получении участников группы:", error);
    return NextResponse.json(
      { error: "Не удалось получить участников группы" },
      { status: 500 }
    );
  }
}

// POST /api/groups/[id]/members — Добавить участника в группу
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { employeeId } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: "Поле 'employeeId' обязательно" },
        { status: 400 }
      );
    }

    // Проверяем существование группы
    const group = await prisma.trainingGroup.findUnique({
      where: { id },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Группа не найдена" },
        { status: 404 }
      );
    }

    // Проверяем существование сотрудника
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Сотрудник не найден" },
        { status: 404 }
      );
    }

    // Создаём связь участника с группой (уникальность groupId+employeeId обеспечена на уровне БД)
    const member = await prisma.groupMember.create({
      data: {
        groupId: id,
        employeeId,
      },
      include: {
        employee: {
          include: {
            company: true,
          },
        },
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Ошибка при добавлении участника в группу:", error);
    return NextResponse.json(
      { error: "Не удалось добавить участника. Возможно, он уже в группе." },
      { status: 500 }
    );
  }
}
