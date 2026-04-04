import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * POST /api/promo-codes/validate
 * Валидация промокода. Доступно любому авторизованному пользователю.
 * Проверяет: существование, активность, срок действия, лимит использований.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Код промокода обязателен" },
        { status: 400 }
      );
    }

    // Поиск промокода (регистронезависимо)
    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!promoCode) {
      return NextResponse.json(
        { valid: false, error: "Промокод не найден" },
        { status: 404 }
      );
    }

    // Проверка активности
    if (!promoCode.isActive) {
      return NextResponse.json(
        { valid: false, error: "Промокод деактивирован" }
      );
    }

    // Проверка даты начала действия
    if (new Date() < promoCode.validFrom) {
      return NextResponse.json(
        { valid: false, error: "Промокод ещё не активен" }
      );
    }

    // Проверка даты окончания действия
    if (promoCode.validTo && new Date() > promoCode.validTo) {
      return NextResponse.json(
        { valid: false, error: "Срок действия промокода истёк" }
      );
    }

    // Проверка лимита использований
    if (promoCode.maxUses !== null && promoCode.usedCount >= promoCode.maxUses) {
      return NextResponse.json(
        { valid: false, error: "Лимит использований промокода исчерпан" }
      );
    }

    return NextResponse.json({
      valid: true,
      discountPercent: promoCode.discountPercent,
      description: promoCode.description,
    });
  } catch (error) {
    console.error("Ошибка валидации промокода:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
