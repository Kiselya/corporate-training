import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/auth/register
 * Регистрация нового пользователя по инвайт-ссылке.
 * Проверяет валидность токена приглашения, создаёт пользователя.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, inviteToken } = body;

    // Валидация обязательных полей
    if (!email || !password || !inviteToken) {
      return NextResponse.json(
        { error: "Email, пароль и токен приглашения обязательны" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Пароль должен содержать минимум 6 символов" },
        { status: 400 }
      );
    }

    // Проверка инвайт-токена
    const invite = await prisma.inviteLink.findUnique({
      where: { token: inviteToken },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Недействительный токен приглашения" },
        { status: 400 }
      );
    }

    // Проверка активности инвайта
    if (!invite.isActive) {
      return NextResponse.json(
        { error: "Приглашение деактивировано" },
        { status: 400 }
      );
    }

    // Проверка срока действия
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: "Срок действия приглашения истёк" },
        { status: 400 }
      );
    }

    // Проверка лимита использований
    if (invite.usedCount >= invite.maxUses) {
      return NextResponse.json(
        { error: "Лимит использований приглашения исчерпан" },
        { status: 400 }
      );
    }

    // Проверка уникальности email
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }

    // Хэширование пароля (10 раундов соли)
    const passwordHash = await bcrypt.hash(password, 10);

    // Создание пользователя и обновление инвайта в транзакции
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          name: name?.trim() || null,
          role: invite.role,
          mustChangePassword: true,
          companyId: invite.companyId || null,
          inviteLinkId: invite.id,
        },
      });

      // Обновление счётчика использований
      await tx.inviteLink.update({
        where: { id: invite.id },
        data: {
          usedCount: { increment: 1 },
        },
      });

      return newUser;
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Ошибка регистрации:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
