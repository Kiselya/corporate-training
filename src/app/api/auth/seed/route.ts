import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/seed
 * Создание администратора по умолчанию, если ни одного админа не существует.
 * Используется для первоначальной настройки системы.
 */
export async function GET() {
  try {
    const adminEmail = "admin@training.local";

    // Проверка — существует ли уже администратор
    const existingAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (existingAdmin) {
      return NextResponse.json({
        created: false,
        email: existingAdmin.email,
        message: "Администратор уже существует",
      });
    }

    // Создание администратора по умолчанию
    const passwordHash = await bcrypt.hash("admin123", 10);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: "Администратор",
        role: "ADMIN",
        mustChangePassword: false,
      },
    });

    return NextResponse.json({
      created: true,
      email: admin.email,
      message: "Администратор создан",
    });
  } catch (error) {
    console.error("Ошибка создания администратора:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
