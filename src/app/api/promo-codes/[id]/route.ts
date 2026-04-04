import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * PUT /api/promo-codes/[id]
 * Обновление промокода (только для администратора).
 */
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
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { code, discountPercent, description, maxUses, validFrom, validTo, isActive } = body;

    // Проверка существования промокода
    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Промокод не найден" },
        { status: 404 }
      );
    }

    // Валидация процента скидки при его обновлении
    if (discountPercent !== undefined && (discountPercent <= 0 || discountPercent > 100)) {
      return NextResponse.json(
        { error: "Процент скидки должен быть от 0 до 100" },
        { status: 400 }
      );
    }

    // Если меняется код — проверяем уникальность
    if (code && code.toUpperCase().trim() !== existing.code) {
      const duplicate = await prisma.promoCode.findUnique({
        where: { code: code.toUpperCase().trim() },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Промокод с таким кодом уже существует" },
          { status: 409 }
        );
      }
    }

    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(code !== undefined && { code: code.toUpperCase().trim() }),
        ...(discountPercent !== undefined && { discountPercent: Number(discountPercent) }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(maxUses !== undefined && { maxUses: maxUses ? Number(maxUses) : null }),
        ...(validFrom !== undefined && { validFrom: new Date(validFrom) }),
        ...(validTo !== undefined && { validTo: validTo ? new Date(validTo) : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    return NextResponse.json({ promoCode });
  } catch (error) {
    console.error("Ошибка обновления промокода:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/promo-codes/[id]
 * Деактивация промокода (только для администратора).
 * Не удаляет запись — помечает isActive = false.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;

    // Проверка существования
    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Промокод не найден" },
        { status: 404 }
      );
    }

    // Деактивация (мягкое удаление)
    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ promoCode });
  } catch (error) {
    console.error("Ошибка деактивации промокода:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
