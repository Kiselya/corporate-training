import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/employees — Получить список сотрудников с данными компании
// SUPER_ADMIN — все, ADMIN — только сотрудники его компании, USER — только сотрудники из его компании
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    let whereClause = {};

    if (session.role === "ADMIN") {
      // ADMIN видит только сотрудников своей компании
      let adminCompanyId = session.companyId;
      if (!adminCompanyId) {
        // Fallback: берём companyId из БД если его нет в JWT
        const adminUser = await prisma.user.findUnique({ where: { id: session.id }, select: { companyId: true } });
        adminCompanyId = adminUser?.companyId ?? null;
      }
      if (!adminCompanyId) return NextResponse.json([]);
      whereClause = { companyId: adminCompanyId };
    } else if (session.role === "USER") {
      // Находим компанию пользователя через привязанного сотрудника
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { employeeId: true, email: true },
      });

      let companyId: string | null = null;

      if (user?.employeeId) {
        const employee = await prisma.employee.findUnique({
          where: { id: user.employeeId },
          select: { companyId: true },
        });
        companyId = employee?.companyId ?? null;
      } else if (user?.email) {
        const employee = await prisma.employee.findFirst({
          where: { email: user.email },
          select: { companyId: true },
        });
        companyId = employee?.companyId ?? null;
      }

      if (!companyId) {
        return NextResponse.json([]);
      }

      whereClause = { companyId };
    }
    // SUPER_ADMIN — без фильтрации, видит всех сотрудников

    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        company: true,
        _count: { select: { groupMembers: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Ошибка при получении списка сотрудников:", error);
    return NextResponse.json(
      { error: "Не удалось получить список сотрудников" },
      { status: 500 }
    );
  }
}

// POST /api/employees — Создать нового сотрудника
// Только для ADMIN и SUPER_ADMIN
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = await request.json();
    const { erpId, code, lastName, firstName, middleName, fullName, email, phone, note, companyId, force } = body;

    if (!lastName || !firstName) {
      return NextResponse.json(
        { error: "Поля 'lastName' и 'firstName' обязательны" },
        { status: 400 }
      );
    }

    // Если ФИО не передано, формируем из составных частей
    const computedFullName =
      fullName || [lastName, firstName, middleName].filter(Boolean).join(" ");

    // ADMIN может создавать сотрудников только в своей компании
    const resolvedCompanyId = session.role === "ADMIN" && session.companyId
      ? session.companyId
      : companyId || undefined;

    // Проверка уникальности: ФИО + компания (бонусный функционал по ТЗ 3.1)
    // При force=true пропускаем — пользователь подтвердил создание дубликата
    if (!force) {
      const duplicates = await prisma.employee.findMany({
        where: {
          fullName: computedFullName,
          ...(resolvedCompanyId ? { companyId: resolvedCompanyId } : {}),
        },
        include: { company: true },
      });

      if (duplicates.length > 0) {
        const dup = duplicates[0];
        return NextResponse.json({
          warning: `Сотрудник "${computedFullName}" уже существует${dup.company ? ` в компании "${dup.company.name}"` : ""}`,
          existingId: dup.id,
          duplicateFound: true,
        }, { status: 409 });
      }
    }

    const employee = await prisma.employee.create({
      data: {
        erpId: erpId ? Number(erpId) : undefined,
        code: code || undefined,
        lastName,
        firstName,
        middleName: middleName || undefined,
        fullName: computedFullName,
        email: email || undefined,
        phone: phone || undefined,
        note: note || undefined,
        companyId: resolvedCompanyId,
      },
      include: {
        company: true,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("Ошибка при создании сотрудника:", error);
    return NextResponse.json(
      { error: "Не удалось создать сотрудника" },
      { status: 500 }
    );
  }
}
