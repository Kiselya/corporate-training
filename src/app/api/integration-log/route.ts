import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// GET /api/integration-log — Последние 100 записей лога с полной информацией о пользователе
export async function GET() {
  try {
    await requireAdmin();

    const logs = await prisma.integrationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Подтягиваем данные пользователей: имя, роль, компания
    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            company: { select: { name: true } },
          },
        })
      : [];

    const ROLE_LABELS: Record<string, string> = {
      SUPER_ADMIN: "Суперадмин",
      ADMIN: "Администратор",
      USER: "Пользователь",
    };

    const userMap = new Map(users.map((u) => [u.id, {
      name: u.name || u.email,
      role: ROLE_LABELS[u.role] || u.role,
      company: u.company?.name || null,
    }]));

    const enrichedLogs = logs.map((log) => {
      const userData = log.userId ? userMap.get(log.userId) : null;
      return {
        ...log,
        userName: userData
          ? `${userData.name} (${userData.role}${userData.company ? ", " + userData.company : ""})`
          : "—",
      };
    });

    return NextResponse.json({ logs: enrichedLogs });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Ошибка при получении лога интеграции:", error);
    return NextResponse.json({ error: "Не удалось получить лог интеграции" }, { status: 500 });
  }
}
