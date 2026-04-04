import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/email";

/**
 * GET /api/auth/invites
 * SUPER_ADMIN — все инвайты
 * ADMIN — только инвайты своей компании
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

    // ADMIN видит только инвайты своей компании
    const where = session.role === "ADMIN" && session.companyId
      ? { companyId: session.companyId }
      : {};

    const invites = await prisma.inviteLink.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        usedByUsers: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Ошибка получения приглашений:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

/**
 * POST /api/auth/invites
 * Создание инвайта. ADMIN привязывает к своей компании автоматически.
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
    const { role, maxUses, expiresAt, email, companyId: bodyCompanyId } = body;

    // ADMIN может создавать только USER-инвайты
    const resolvedRole = session.role === "ADMIN" ? "USER" : (role || "USER");

    // Компания: ADMIN — автоматически своя, SUPER_ADMIN — из запроса или null
    const resolvedCompanyId = session.role === "ADMIN"
      ? session.companyId || null
      : bodyCompanyId || null;

    const invite = await prisma.inviteLink.create({
      data: {
        role: resolvedRole,
        maxUses: maxUses ? Number(maxUses) : 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: session.id,
        companyId: resolvedCompanyId,
      },
    });

    // Отправка email с инвайтом, если указан адрес
    let emailSent = false;
    if (email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const inviteUrl = `${appUrl}/register?token=${invite.token}`;
      const result = await sendInviteEmail(email, inviteUrl, resolvedRole);
      emailSent = result.success;
    }

    return NextResponse.json({ invite, emailSent }, { status: 201 });
  } catch (error) {
    console.error("Ошибка создания приглашения:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
