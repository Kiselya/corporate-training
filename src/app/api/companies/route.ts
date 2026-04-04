import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * Транслитерация кириллицы → латиница для генерации кода компании
 * Используется для автоматического формирования префикса кода
 */
const TRANSLIT: Record<string, string> = {
  а: "A", б: "B", в: "V", г: "G", д: "D", е: "E", ё: "E", ж: "ZH", з: "Z",
  и: "I", й: "Y", к: "K", л: "L", м: "M", н: "N", о: "O", п: "P", р: "R",
  с: "S", т: "T", у: "U", ф: "F", х: "H", ц: "TS", ч: "CH", ш: "SH",
  щ: "SCH", ъ: "", ы: "Y", ь: "", э: "E", ю: "YU", я: "YA",
};

function transliterate(str: string): string {
  return str
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch.toUpperCase())
    .join("");
}

/**
 * Генерация уникального кода компании
 *
 * Алгоритм:
 * 1. Берём название компании, убираем ООО/АО/ПАО/ЗАО и кавычки
 * 2. Транслитерируем первые 3 буквы → PREFIX
 * 3. Ищем в БД все коды с таким PREFIX-*
 * 4. Назначаем следующий порядковый номер: PREFIX-001, PREFIX-002...
 *
 * Пример: ООО "ТехноПром" → TEH-001
 *         ООО "ТехноПром-Сервис" → TEH-002
 */
async function generateCompanyCode(name: string): Promise<string> {
  // Убираем организационно-правовую форму и кавычки
  const cleaned = name
    .replace(/ООО|АО|ПАО|ЗАО|ОАО|ИП/gi, "")
    .replace(/[«»""''"]/g, "")
    .trim();

  // Берём первые 3 значимых буквы
  const letters = cleaned.replace(/[^а-яёa-z]/gi, "");
  const prefix = transliterate(letters.slice(0, 3)).toUpperCase() || "CMP";

  // Ищем все существующие коды с этим префиксом
  const existing = await prisma.company.findMany({
    where: { code: { startsWith: `${prefix}-` } },
    select: { code: true },
    orderBy: { code: "desc" },
  });

  // Определяем следующий номер
  let maxNum = 0;
  for (const c of existing) {
    const match = c.code.match(/-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
}

// GET /api/companies — Получить список компаний
// Для USER — только его компания
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
    }

    let whereClause = {};

    if (session.role === "USER") {
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

      whereClause = { id: companyId };
    }

    const companies = await prisma.company.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { employees: true, specifications: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error("Ошибка при получении списка компаний:", error);
    return NextResponse.json(
      { error: "Не удалось получить список компаний" },
      { status: 500 }
    );
  }
}

// POST /api/companies — Создать новую компанию
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
    const { code, name, erpId, inn, kpp, ogrn, address, phone, email, contactPerson, customFields } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Поле 'name' обязательно" },
        { status: 400 }
      );
    }

    // Если код не указан — генерируем автоматически
    const finalCode = code?.trim() || await generateCompanyCode(name);

    const company = await prisma.company.create({
      data: {
        code: finalCode,
        name,
        erpId: erpId ? Number(erpId) : undefined,
        inn: inn || undefined,
        kpp: kpp || undefined,
        ogrn: ogrn || undefined,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        contactPerson: contactPerson || undefined,
        customFields: customFields || {},
      },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error("Ошибка при создании компании:", error);
    return NextResponse.json(
      { error: "Не удалось создать компанию" },
      { status: 500 }
    );
  }
}
