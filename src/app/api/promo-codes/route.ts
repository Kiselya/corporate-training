import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/promo-codes
 * Получение списка всех промокодов (только для администратора).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const promoCodes = await prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        appliedToGroups: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ promoCodes });
  } catch (error) {
    console.error("Ошибка получения промокодов:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/promo-codes
 * Создание нового промокода (только для администратора).
 * Принимает: { code, discountPercent, description, maxUses, validFrom, validTo }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { code, discountPercent, description, maxUses, validFrom, validTo } = body;

    // Валидация обязательных полей
    if (!code || discountPercent === undefined || discountPercent === null) {
      return NextResponse.json(
        { error: "Код и процент скидки обязательны" },
        { status: 400 }
      );
    }

    // Валидация процента скидки
    if (discountPercent <= 0 || discountPercent > 100) {
      return NextResponse.json(
        { error: "Процент скидки должен быть от 0 до 100" },
        { status: 400 }
      );
    }

    // Проверка уникальности кода
    const existing = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Промокод с таким кодом уже существует" },
        { status: 409 }
      );
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase().trim(),
        discountPercent: Number(discountPercent),
        description: description?.trim() || null,
        maxUses: maxUses ? Number(maxUses) : null,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validTo: validTo ? new Date(validTo) : null,
      },
    });

    return NextResponse.json({ promoCode }, { status: 201 });
  } catch (error) {
    console.error("Ошибка создания промокода:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
