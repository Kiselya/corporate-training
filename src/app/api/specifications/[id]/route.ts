import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/specifications/[id] — Получить полную информацию о спецификации
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const specification = await prisma.specification.findUnique({
      where: { id },
      include: {
        company: true,
        trainingGroups: {
          include: {
            course: true,
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
        },
      },
    });

    if (!specification) {
      return NextResponse.json(
        { error: "Спецификация не найдена" },
        { status: 404 }
      );
    }

    // Расчёт вычисляемых полей спецификации (стоимость, НДС, итого)
    const groupCosts = specification.trainingGroups.map((group) => ({
      ...group,
      memberCount: group.members.length,
      totalCost: group.pricePerPerson * group.members.length,
    }));

    // Подытог: сумма стоимостей всех групп
    const subtotal = groupCosts.reduce((sum, g) => sum + g.totalCost, 0);

    // НДС 22%
    const vat = Math.round(subtotal * 0.22 * 100) / 100;

    // Итого с НДС
    const total = Math.round((subtotal + vat) * 100) / 100;

    return NextResponse.json({
      ...specification,
      trainingGroups: groupCosts,
      subtotal,
      vat,
      total,
    });
  } catch (error) {
    console.error("Ошибка при получении спецификации:", error);
    return NextResponse.json(
      { error: "Не удалось получить спецификацию" },
      { status: 500 }
    );
  }
}

// PUT /api/specifications/[id] — Обновить спецификацию
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { number, date, companyId, groupIds, status } = body;

    const specification = await prisma.specification.update({
      where: { id },
      data: {
        ...(number !== undefined && { number }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(companyId !== undefined && { companyId }),
        ...(status !== undefined && { status }),
      },
    });

    // Если переданы groupIds — обновляем привязку групп к спецификации
    if (groupIds && Array.isArray(groupIds)) {
      // Открепляем все текущие группы от этой спецификации
      await prisma.trainingGroup.updateMany({
        where: { specificationId: id },
        data: { specificationId: null },
      });

      // Привязываем новые группы
      if (groupIds.length > 0) {
        await prisma.trainingGroup.updateMany({
          where: { id: { in: groupIds } },
          data: { specificationId: id },
        });
      }
    }

    // Возвращаем обновлённую спецификацию
    const result = await prisma.specification.findUnique({
      where: { id },
      include: {
        company: true,
        trainingGroups: {
          include: {
            course: true,
            members: true,
          },
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Ошибка при обновлении спецификации:", error);
    return NextResponse.json(
      { error: "Не удалось обновить спецификацию" },
      { status: 500 }
    );
  }
}

// DELETE /api/specifications/[id] — Удалить спецификацию
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Открепляем группы перед удалением спецификации
    await prisma.trainingGroup.updateMany({
      where: { specificationId: id },
      data: { specificationId: null },
    });

    await prisma.specification.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Спецификация удалена" });
  } catch (error) {
    console.error("Ошибка при удалении спецификации:", error);
    return NextResponse.json(
      { error: "Не удалось удалить спецификацию" },
      { status: 500 }
    );
  }
}
