import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, type SessionUser } from "@/lib/auth";

/**
 * POST /api/auth/login
 * Авторизация пользователя по email и паролю.
 * Устанавливает JWT в httpOnly cookie.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email и пароль обязательны" },
        { status: 400 }
      );
    }

    // Поиск пользователя по email (включая companyId для ограничения доступа ADMIN)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        mustChangePassword: true,
        isActive: true,
        companyId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    // Проверка активности аккаунта
    if (!user.isActive) {
      return NextResponse.json(
        { error: "Аккаунт деактивирован" },
        { status: 403 }
      );
    }

    // Проверка пароля
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    // Формирование данных сессии (companyId для ADMIN — ограничение по компании)
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      ...(user.companyId ? { companyId: user.companyId } : {}),
    };

    // Установка cookie с JWT
    await setSessionCookie(sessionUser);

    return NextResponse.json({
      user: sessionUser,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    console.error("Ошибка авторизации:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
