import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { saveToTrash } from "@/lib/trash";

// GET /api/courses/[id] — Получить курс по ID с историей цен и группами
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Поддержка поиска по id, code или erpId для коротких URL
    let course = await prisma.course.findUnique({
      where: { id },
      include: {
        priceHistory: {
          orderBy: { validFrom: "desc" },
        },
        modules: {
          orderBy: { orderIndex: "asc" },
        },
        trainingGroups: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
    });

    // Fallback: поиск по code или erpId
    if (!course) {
      course = await prisma.course.findFirst({
        where: { OR: [{ code: id }, { erpId: isNaN(Number(id)) ? undefined : Number(id) }] },
        include: {
          priceHistory: { orderBy: { validFrom: "desc" } },
          modules: { orderBy: { orderIndex: "asc" } },
          trainingGroups: { include: { _count: { select: { members: true } } } },
        },
      });
    }

    if (!course) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json(course);
  } catch (error) {
    console.error("Ошибка при получении курса:", error);
    return NextResponse.json(
      { error: "Не удалось получить курс" },
      { status: 500 }
    );
  }
}

// PUT /api/courses/[id] — Обновить курс (ADMIN и SUPER_ADMIN)
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
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { erpId, code, name, description, durationDays, pricePerPerson } = body;

    // Если цена изменилась — закрываем старую запись в истории и создаём новую
    if (pricePerPerson !== undefined) {
      const currentCourse = await prisma.course.findUnique({ where: { id } });
      if (currentCourse && currentCourse.pricePerPerson !== Number(pricePerPerson)) {
        // Закрываем текущую действующую цену (устанавливаем validTo)
        await prisma.priceHistory.updateMany({
          where: { courseId: id, validTo: null },
          data: { validTo: new Date() },
        });

        // Создаём новую запись в истории цен
        await prisma.priceHistory.create({
          data: {
            courseId: id,
            pricePerPerson: Number(pricePerPerson),
          },
        });
      }
    }

    const course = await prisma.course.update({
      where: { id },
      data: {
        ...(erpId !== undefined && { erpId: erpId ? Number(erpId) : null }),
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(durationDays !== undefined && { durationDays: Number(durationDays) }),
        ...(pricePerPerson !== undefined && { pricePerPerson: Number(pricePerPerson) }),
      },
      include: {
        priceHistory: {
          orderBy: { validFrom: "desc" },
        },
      },
    });

    return NextResponse.json(course);
  } catch (error) {
    console.error("Ошибка при обновлении курса:", error);
    return NextResponse.json(
      { error: "Не удалось обновить курс" },
      { status: 500 }
    );
  }
}

// DELETE /api/courses/[id] — Удалить курс (только SUPER_ADMIN)
// Перед удалением сохраняется снимок в корзину
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    // Удаление курсов — привилегия только SUPER_ADMIN
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Удаление курсов доступно только суперадминистратору" }, { status: 403 });
    }

    const { id } = await params;

    // Загружаем полные данные курса для снимка
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        priceHistory: true,
        trainingGroups: {
          include: {
            members: {
              include: { employee: true },
            },
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Курс не найден" }, { status: 404 });
    }

    // Сохраняем снимок в корзину перед удалением
    await saveToTrash("Course", id, course, session.id);

    await prisma.course.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Курс удалён. Данные сохранены в корзине и могут быть восстановлены суперадмином." });
  } catch (error) {
    console.error("Ошибка при удалении курса:", error);
    return NextResponse.json(
      { error: "Не удалось удалить курс" },
      { status: 500 }
    );
  }
}
