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
      // Автосоздание Employee при регистрации
      const trimmedName = name?.trim() || "";
      const nameParts = trimmedName.split(/\s+/);
      const lastName = nameParts[0] || "";
      const firstName = nameParts[1] || "";
      const middleName = nameParts.slice(2).join(" ") || null;

      // Пробуем найти существующего Employee по email
      let employee = await tx.employee.findFirst({
        where: { email: email.toLowerCase().trim() },
      });

      // Если не нашли — создаём нового
      if (!employee && lastName) {
        employee = await tx.employee.create({
          data: {
            lastName,
            firstName,
            middleName,
            fullName: trimmedName || email.toLowerCase().trim(),
            email: email.toLowerCase().trim(),
            companyId: invite.companyId || null,
          },
        });
      }

      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          name: trimmedName || null,
          role: invite.role,
          mustChangePassword: false,
          companyId: invite.companyId || null,
          inviteLinkId: invite.id,
          employeeId: employee?.id || null,
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
