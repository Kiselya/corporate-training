import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";

/**
 * GET /api/auth/users — Список всех пользователей системы
 * Доступ: ADMIN, SUPER_ADMIN
 */
export async function GET() {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        companyId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Ошибка загрузки пользователей" }, { status: 500 });
  }
}

/**
 * POST /api/auth/users — Создать пользователя напрямую (из сотрудника)
 * Доступ: ADMIN, SUPER_ADMIN
 * Позволяет назначить сотруднику аккаунт с ролью без инвайт-ссылки
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const { email, password, name, role, employeeId, companyId } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email и пароль обязательны" }, { status: 400 });
    }

    // Проверка уникальности email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: `Пользователь с email "${email}" уже существует` }, { status: 409 });
    }

    // Проверка что employeeId не привязан к другому User
    if (employeeId) {
      const linkedUser = await prisma.user.findUnique({ where: { employeeId } });
      if (linkedUser) {
        return NextResponse.json({ error: "Этот сотрудник уже имеет аккаунт в системе" }, { status: 409 });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || email.split("@")[0],
        role: role || "USER",
        employeeId: employeeId || undefined,
        companyId: companyId || undefined,
        mustChangePassword: false,
      },
    });

    return NextResponse.json({ id: user.id, email: user.email, role: user.role }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Ошибка создания пользователя:", error);
    return NextResponse.json({ error: "Не удалось создать пользователя" }, { status: 500 });
  }
}
