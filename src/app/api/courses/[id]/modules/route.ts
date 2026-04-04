import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/courses/[id]/modules — Список модулей курса
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const modules = await prisma.courseModule.findMany({
      where: { courseId: id },
      orderBy: { orderIndex: "asc" },
    });

    return NextResponse.json(modules);
  } catch (error) {
    console.error("Ошибка при получении модулей курса:", error);
    return NextResponse.json(
      { error: "Не удалось получить модули курса" },
      { status: 500 }
    );
  }
}

// POST /api/courses/[id]/modules — Создать модуль курса
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, type, durationHours, orderIndex, description } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Поле 'title' обязательно" },
        { status: 400 }
      );
    }

    // Проверяем, что курс существует
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return NextResponse.json({ error: "Курс не найден" }, { status: 404 });
    }

    const moduleData = await prisma.courseModule.create({
      data: {
        courseId: id,
        title,
        type: type || "LECTURE",
        durationHours: durationHours !== undefined ? Number(durationHours) : 1,
        orderIndex: orderIndex !== undefined ? Number(orderIndex) : 0,
        description: description || undefined,
      },
    });

    return NextResponse.json(moduleData, { status: 201 });
  } catch (error) {
    console.error("Ошибка при создании модуля:", error);
    return NextResponse.json(
      { error: "Не удалось создать модуль" },
      { status: 500 }
    );
  }
}
