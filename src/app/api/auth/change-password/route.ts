import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession, setSessionCookie, type SessionUser } from "@/lib/auth";

/**
 * POST /api/auth/change-password
 * Смена пароля авторизованного пользователя.
 * После успешной смены сбрасывает флаг mustChangePassword.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Необходима авторизация" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Текущий и новый пароли обязательны" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Новый пароль должен содержать минимум 6 символов" },
        { status: 400 }
      );
    }

    // Получение текущего хэша пароля из БД
    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    // Проверка текущего пароля
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Неверный текущий пароль" },
        { status: 401 }
      );
    }

    // Хэширование нового пароля и обновление в БД
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: session.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });

    // Обновление сессии — сброс флага mustChangePassword
    const updatedSession: SessionUser = {
      ...session,
      mustChangePassword: false,
    };
    await setSessionCookie(updatedSession);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ошибка смены пароля:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
