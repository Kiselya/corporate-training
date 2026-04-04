import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/groups — Получить список учебных групп с курсом, участниками и вычисляемыми полями
// SUPER_ADMIN — все группы, ADMIN — только группы с сотрудниками его компании, USER — только свои группы
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    // Фильтрация по роли
    let whereClause = {};
    if (session.role === "USER") {
      // Для USER — фильтрация по привязанному сотруднику
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { employeeId: true, email: true },
      });

      let employeeId = user?.employeeId;

      // Если не привязан — пробуем найти по email
      if (!employeeId && user?.email) {
        const employee = await prisma.employee.findFirst({
          where: { email: user.email },
        });
        employeeId = employee?.id ?? null;
      }

      if (!employeeId) {
        return NextResponse.json([]);
      }

      whereClause = {
        members: {
          some: { employeeId },
        },
      };
    } else if (session.role === "ADMIN" && session.companyId) {
      // ADMIN видит только группы, где есть сотрудники его компании
      whereClause = {
        members: {
          some: {
            employee: {
              companyId: session.companyId,
            },
          },
        },
      };
    }
    // SUPER_ADMIN — без фильтрации, видит все группы

    const groups = await prisma.trainingGroup.findMany({
      where: whereClause,
      include: {
        course: true,
        members: {
          include: {
            employee: true,
          },
        },
        specification: true,
      },
      orderBy: { createdAt: "desc" },
    });

    /**
     * Автоматическое обновление статусов групп:
     * - Если дата начала <= сегодня и статус PLANNED → IN_PROGRESS
     * - Если дата окончания < сегодня и статус IN_PROGRESS → COMPLETED
     * Выполняется при каждом запросе списка (lazy update)
     */
    const now = new Date();
    const statusUpdates: Promise<unknown>[] = [];
    for (const group of groups) {
      if (group.status === "PLANNED" && new Date(group.startDate) <= now) {
        statusUpdates.push(
          prisma.trainingGroup.update({
            where: { id: group.id },
            data: { status: "IN_PROGRESS" },
          })
        );
        group.status = "IN_PROGRESS";
      } else if (group.status === "IN_PROGRESS" && new Date(group.endDate) < now) {
        statusUpdates.push(
          prisma.trainingGroup.update({
            where: { id: group.id },
            data: { status: "COMPLETED" },
          })
        );
        group.status = "COMPLETED";
      }
    }
    if (statusUpdates.length > 0) {
      await Promise.all(statusUpdates);
    }

    // Вычисляемые поля для каждой группы
    const groupsWithComputed = groups.map((group) => {
      const memberCount = group.members.length;

      // Расчёт общей стоимости: зафиксированная цена на момент создания группы * кол-во участников
      const totalCost = group.pricePerPerson * memberCount;

      // Расчёт среднего прогресса: сумма progressPercent всех участников / их количество
      const avgProgress =
        memberCount > 0
          ? Math.round(
              group.members.reduce((sum, m) => sum + m.progressPercent, 0) /
                memberCount
            )
          : 0;

      return {
        ...group,
        memberCount,
        totalCost,
        avgProgress,
      };
    });

    return NextResponse.json(groupsWithComputed);
  } catch (error) {
    console.error("Ошибка при получении списка групп:", error);
    return NextResponse.json(
      { error: "Не удалось получить список групп" },
      { status: 500 }
    );
  }
}

// POST /api/groups — Создать новую учебную группу (опционально с участниками)
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
    const {
      name,
      courseId,
      startDate,
      endDate,
      pricePerPerson,
      status,
      specificationId,
      memberIds, // массив ID сотрудников для добавления в группу
    } = body;

    if (!courseId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Поля 'courseId', 'startDate' и 'endDate' обязательны" },
        { status: 400 }
      );
    }

    // ADMIN может добавлять только сотрудников своей компании
    if (session.role === "ADMIN" && session.companyId && memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
      const employees = await prisma.employee.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, companyId: true },
      });
      const foreignEmployees = employees.filter((e) => e.companyId !== session.companyId);
      if (foreignEmployees.length > 0) {
        return NextResponse.json(
          { error: "Нельзя добавить сотрудников из другой компании" },
          { status: 403 }
        );
      }
    }

    // Если цена не указана явно — берём текущую цену из курса
    let resolvedPrice = pricePerPerson;
    if (resolvedPrice === undefined) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
      });
      if (!course) {
        return NextResponse.json(
          { error: "Курс не найден" },
          { status: 404 }
        );
      }
      resolvedPrice = course.pricePerPerson;
    }

    const group = await prisma.trainingGroup.create({
      data: {
        name: name || undefined,
        courseId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        pricePerPerson: Number(resolvedPrice),
        status: status || "PLANNED",
        specificationId: specificationId || undefined,
        // Если переданы ID сотрудников — создаём связи GroupMember
        ...(memberIds &&
          Array.isArray(memberIds) &&
          memberIds.length > 0 && {
            members: {
              create: memberIds.map((employeeId: string) => ({
                employeeId,
              })),
            },
          }),
      },
      include: {
        course: true,
        members: {
          include: {
            employee: true,
          },
        },
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error("Ошибка при создании группы:", error);
    return NextResponse.json(
      { error: "Не удалось создать группу" },
      { status: 500 }
    );
  }
}
