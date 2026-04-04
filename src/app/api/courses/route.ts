import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/courses — Получить список всех курсов (без ограничения по роли)
export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      include: {
        _count: {
          select: { trainingGroups: true },
        },
        modules: {
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(courses);
  } catch (error) {
    console.error("Ошибка при получении списка курсов:", error);
    return NextResponse.json(
      { error: "Не удалось получить список курсов" },
      { status: 500 }
    );
  }
}

// POST /api/courses — Создать новый курс
// Только для ADMIN и SUPER_ADMIN
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = await request.json();
    const { erpId, code, name, description, durationDays, pricePerPerson } = body;

    if (!name || durationDays === undefined || pricePerPerson === undefined) {
      return NextResponse.json(
        { error: "Поля 'name', 'durationDays' и 'pricePerPerson' обязательны" },
        { status: 400 }
      );
    }

    const course = await prisma.course.create({
      data: {
        erpId: erpId ? Number(erpId) : undefined,
        code: code || undefined,
        name,
        description: description || undefined,
        durationDays: Number(durationDays),
        pricePerPerson: Number(pricePerPerson),
      },
    });

    // Записываем начальную цену в историю цен
    await prisma.priceHistory.create({
      data: {
        courseId: course.id,
        pricePerPerson: Number(pricePerPerson),
      },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("Ошибка при создании курса:", error);
    return NextResponse.json(
      { error: "Не удалось создать курс" },
      { status: 500 }
    );
  }
}
