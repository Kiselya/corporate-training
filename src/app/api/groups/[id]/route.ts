import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { saveToTrash } from "@/lib/trash";

// GET /api/groups/[id] — Получить полную информацию о группе с участниками и данными сотрудников
// ADMIN видит только группы, где есть сотрудники его компании
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const { id } = await params;

    const group = await prisma.trainingGroup.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            priceHistory: {
              orderBy: { validFrom: "desc" },
            },
          },
        },
        specification: true,
        members: {
          include: {
            employee: {
              include: {
                company: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Группа не найдена" },
        { status: 404 }
      );
    }

    // ADMIN может видеть только группы с сотрудниками своей компании
    const isAdmin = session.role === "ADMIN" && session.companyId;
    if (isAdmin) {
      const hasCompanyMembers = group.members.some(
        (m) => m.employee?.companyId === session.companyId
      );
      if (!hasCompanyMembers) {
        return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
      }
    }

    // Вычисляемые поля — по ВСЕМ участникам (бизнес-данные группы)
    const memberCount = group.members.length;
    const discount = group.discountPercent ?? 0;
    const totalCost = group.pricePerPerson * memberCount * (1 - discount / 100);
    const avgProgress =
      memberCount > 0
        ? Math.round(
            group.members.reduce((sum, m) => sum + m.progressPercent, 0) /
              memberCount
          )
        : 0;

    // ADMIN видит только сотрудников своей компании
    const visibleMembers = isAdmin
      ? group.members.filter((m) => m.employee?.companyId === session.companyId)
      : group.members;

    return NextResponse.json({
      ...group,
      members: visibleMembers,
      memberCount,
      totalCost,
      avgProgress,
    });
  } catch (error) {
    console.error("Ошибка при получении группы:", error);
    return NextResponse.json(
      { error: "Не удалось получить группу" },
      { status: 500 }
    );
  }
}

// PUT /api/groups/[id] — Обновить группу (данные, статус, состав участников)
// ADMIN может редактировать только группы с сотрудниками своей компании
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

    // Проверка доступа ADMIN к группе по компании
    if (session.role === "ADMIN" && session.companyId) {
      const existingGroup = await prisma.trainingGroup.findUnique({
        where: { id },
        include: { members: { include: { employee: true } } },
      });
      if (!existingGroup) {
        return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
      }
      const hasCompanyMembers = existingGroup.members.some(
        (m) => m.employee?.companyId === session.companyId
      );
      if (!hasCompanyMembers) {
        return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
      }
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
      memberIds, // если передан — полностью заменяем состав группы
    } = body;

    // Обновляем основные данные группы
    const group = await prisma.trainingGroup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(courseId !== undefined && { courseId }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(pricePerPerson !== undefined && {
          pricePerPerson: Number(pricePerPerson),
        }),
        ...(status !== undefined && { status }),
        ...(specificationId !== undefined && {
          specificationId: specificationId || null,
        }),
      },
    });

    // Если передан массив memberIds — пересоздаём состав группы
    // Удаляем всех текущих участников и добавляем новых
    if (memberIds && Array.isArray(memberIds)) {
      await prisma.groupMember.deleteMany({
        where: { groupId: id },
      });

      if (memberIds.length > 0) {
        await prisma.groupMember.createMany({
          data: memberIds.map((employeeId: string) => ({
            groupId: id,
            employeeId,
          })),
        });
      }
    }

    // Возвращаем обновлённую группу с полными данными
    const updatedGroup = await prisma.trainingGroup.findUnique({
      where: { id },
      include: {
        course: true,
        members: {
          include: {
            employee: true,
          },
        },
        specification: true,
      },
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error("Ошибка при обновлении группы:", error);
    return NextResponse.json(
      { error: "Не удалось обновить группу" },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id] — Удалить группу (каскадно удаляет участников)
// ADMIN может удалять только группы своей компании; перед удалением сохраняется снимок в корзину
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
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const { id } = await params;

    // Загружаем полные данные группы для снимка перед удалением
    const group = await prisma.trainingGroup.findUnique({
      where: { id },
      include: {
        course: true,
        specification: true,
        members: {
          include: {
            employee: { include: { company: true } },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    // ADMIN может удалять только группы с сотрудниками своей компании
    if (session.role === "ADMIN" && session.companyId) {
      const hasCompanyMembers = group.members.some(
        (m) => m.employee?.companyId === session.companyId
      );
      if (!hasCompanyMembers) {
        return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
      }
    }

    // Сохраняем снимок в корзину перед удалением
    await saveToTrash("TrainingGroup", id, group, session.id);

    await prisma.trainingGroup.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Группа удалена. Данные сохранены в корзине и могут быть восстановлены суперадмином." });
  } catch (error) {
    console.error("Ошибка при удалении группы:", error);
    return NextResponse.json(
      { error: "Не удалось удалить группу" },
      { status: 500 }
    );
  }
}
