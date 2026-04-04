import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// GET /api/specifications — Получить список спецификаций с группами и вычисленными итогами
export async function GET() {
  try {
    const specifications = await prisma.specification.findMany({
      include: {
        company: true,
        trainingGroups: {
          include: {
            course: true,
            members: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // Вычисляемые итоги для каждой спецификации:
    // - subtotal: сумма стоимостей всех групп (цена за человека * кол-во участников)
    // - vat: НДС 22% от subtotal (согласно ТЗ хакатона)
    // - total: итоговая сумма с НДС (subtotal + vat)
    const specificationsWithTotals = specifications.map((spec) => {
      // Расчёт стоимости каждой группы: pricePerPerson * memberCount * (1 - discount/100)
      const groupCosts = spec.trainingGroups.map((group) => {
        const discount = group.discountPercent ?? 0;
        return {
          ...group,
          memberCount: group.members.length,
          totalCost: group.pricePerPerson * group.members.length * (1 - discount / 100),
        };
      });

      // Подытог: сумма стоимостей всех групп в спецификации
      const subtotal = groupCosts.reduce((sum, g) => sum + g.totalCost, 0);

      // НДС 22% — ставка налога для образовательных услуг
      const vat = Math.round(subtotal * 0.22 * 100) / 100;

      // Итого с НДС
      const total = Math.round((subtotal + vat) * 100) / 100;

      return {
        ...spec,
        trainingGroups: groupCosts,
        subtotal,
        vat,
        total,
      };
    });

    return NextResponse.json(specificationsWithTotals);
  } catch (error) {
    console.error("Ошибка при получении списка спецификаций:", error);
    return NextResponse.json(
      { error: "Не удалось получить список спецификаций" },
      { status: 500 }
    );
  }
}

// POST /api/specifications — Создать новую спецификацию
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { number, date, companyId, groupIds, status } = body;

    if (!number || !date || !companyId) {
      return NextResponse.json(
        { error: "Поля 'number', 'date' и 'companyId' обязательны" },
        { status: 400 }
      );
    }

    const specification = await prisma.specification.create({
      data: {
        number,
        date: new Date(date),
        companyId,
        status: status || "FORMED",
      },
      include: {
        company: true,
      },
    });

    // Если переданы ID групп — привязываем их к спецификации
    if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
      await prisma.trainingGroup.updateMany({
        where: { id: { in: groupIds } },
        data: { specificationId: specification.id },
      });
    }

    // Возвращаем спецификацию с привязанными группами
    const result = await prisma.specification.findUnique({
      where: { id: specification.id },
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

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Ошибка при создании спецификации:", error);
    return NextResponse.json(
      { error: "Не удалось создать спецификацию" },
      { status: 500 }
    );
  }
}
