import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * GET /api/auth/me
 * Возвращает информацию о текущем аутентифицированном пользователе.
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Необходима авторизация" },
        { status: 401 }
      );
    }

    const userData: Record<string, unknown> = {
      id: session.id,
      email: session.email,
      name: session.name,
      role: session.role,
      mustChangePassword: session.mustChangePassword,
    };
    // companyId — привязка ADMIN к конкретной компании
    if (session.companyId) {
      userData.companyId = session.companyId;
    }
    if (session.impersonatedBy) {
      userData.impersonatedBy = session.impersonatedBy;
    }

    return NextResponse.json({ user: userData });
  } catch (error) {
    console.error("Ошибка получения сессии:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
