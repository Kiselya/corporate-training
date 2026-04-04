import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/email";

/**
 * POST /api/auth/send-invite-email
 * Отправка (или повторная отправка) email с инвайт-ссылкой.
 * Только для админов.
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
    const { inviteId, email } = body;

    if (!inviteId || !email) {
      return NextResponse.json(
        { error: "Необходимо указать inviteId и email" },
        { status: 400 }
      );
    }

    // Получаем инвайт
    const invite = await prisma.inviteLink.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      return NextResponse.json({ error: "Приглашение не найдено" }, { status: 404 });
    }

    if (!invite.isActive) {
      return NextResponse.json({ error: "Приглашение деактивировано" }, { status: 400 });
    }

    // ADMIN может отправлять только инвайты своей компании
    if (session.role === "ADMIN" && session.companyId && invite.companyId !== session.companyId) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/register?token=${invite.token}`;

    const result = await sendInviteEmail(email, inviteUrl, invite.role);

    if (result.success) {
      return NextResponse.json({ success: true, emailId: result.id });
    } else {
      return NextResponse.json(
        { error: result.error || "Не удалось отправить email" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Ошибка отправки email:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
