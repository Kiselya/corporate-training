import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStringPromise } from "xml2js";
import { getSession } from "@/lib/auth";

// ─── Валидация XML-данных перед импортом ────────────────────────
function validateParsedXml(parsed: Record<string, unknown>, filename: string): {
  valid: boolean;
  type?: "Edu_Participant" | "Edu_Course";
  error?: string;
} {
  // Определяем тип по корневому элементу
  if (parsed.Edu_Participants || parsed.Edu_Participant) {
    const root = (parsed.Edu_Participants || parsed) as Record<string, unknown>;
    const participants = root.Edu_Participant;

    // Проверяем наличие записей
    const items = Array.isArray(participants) ? participants : participants ? [participants] : [];
    for (const p of items) {
      const item = p as Record<string, unknown>;
      if (!item.id) {
        return {
          valid: false,
          error: `Отсутствует обязательное поле: id`,
        };
      }
      if (!item.sFIO) {
        return {
          valid: false,
          error: `Отсутствует обязательное поле: sFIO`,
        };
      }
    }
    return { valid: true, type: "Edu_Participant" };
  }

  if (parsed.Edu_Courses || parsed.Edu_Course) {
    const root = (parsed.Edu_Courses || parsed) as Record<string, unknown>;
    const courses = root.Edu_Course;

    const items = Array.isArray(courses) ? courses : courses ? [courses] : [];
    for (const c of items) {
      const item = c as Record<string, unknown>;
      if (!item.id) {
        return {
          valid: false,
          error: `Отсутствует обязательное поле: id`,
        };
      }
      if (!item.sCourseHL) {
        return {
          valid: false,
          error: `Отсутствует обязательное поле: sCourseHL`,
        };
      }
    }
    return { valid: true, type: "Edu_Course" };
  }

  // Неизвестный корневой элемент
  const rootKeys = Object.keys(parsed);
  return {
    valid: false,
    error: `Неизвестный формат XML. Корневой элемент: ${rootKeys[0] || "пусто"}. Ожидается Edu_Participant или Edu_Course`,
  };
}

// ─── Обработка одного файла ─────────────────────────────────────
async function processFile(file: File): Promise<{
  filename: string;
  type: string | null;
  created: number;
  updated: number;
  errors: string[];
}> {
  const filename = file.name;
  const result = {
    filename,
    type: null as string | null,
    created: 0,
    updated: 0,
    errors: [] as string[],
  };

  // Парсим XML
  let parsed: Record<string, unknown>;
  try {
    const xmlContent = await file.text();
    parsed = await parseStringPromise(xmlContent, {
      explicitArray: false,
      trim: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Ошибка парсинга XML: ${message}`);
    return result;
  }

  // Валидация
  const validation = validateParsedXml(parsed, filename);
  if (!validation.valid) {
    result.errors.push(validation.error!);
    return result;
  }

  result.type = validation.type!;

  // ─── Обработка Edu_Participant ──────────────────────────────
  if (validation.type === "Edu_Participant") {
    const root = (parsed.Edu_Participants || parsed) as Record<string, unknown>;
    let participants = root.Edu_Participant;

    if (!Array.isArray(participants)) {
      participants = participants ? [participants] : [];
    }

    for (const p of participants as Record<string, unknown>[]) {
      try {
        const erpId = p.id ? Number(p.id) : null;

        const employeeData = {
          code: (p.sCode as string) || null,
          lastName: (p.sLastName as string) || "",
          firstName: (p.sMiddleName as string) || "",
          middleName: (p.sFirstName as string) || null,
          fullName:
            (p.sFIO as string) ||
            [p.sLastName, p.sMiddleName, p.sFirstName].filter(Boolean).join(" "),
        };

        let companyId: string | null = null;
        if (p.idOrganization) {
          const company = await prisma.company.findFirst({
            where: { erpId: Number(p.idOrganization) },
          });
          if (company) {
            companyId = company.id;
          }
        }

        if (erpId) {
          const existing = await prisma.employee.findUnique({
            where: { erpId },
          });

          if (existing) {
            await prisma.employee.update({
              where: { erpId },
              data: { ...employeeData, companyId },
            });
            result.updated++;
          } else {
            await prisma.employee.create({
              data: { ...employeeData, erpId, companyId },
            });
            result.created++;
          }
        } else {
          await prisma.employee.create({
            data: { ...employeeData, companyId },
          });
          result.created++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(
          `Ошибка обработки участника ${(p as Record<string, unknown>).sFIO || (p as Record<string, unknown>).id || "unknown"}: ${message}`
        );
      }
    }
  }

  // ─── Обработка Edu_Course ────────────────────────────────────
  if (validation.type === "Edu_Course") {
    const root = (parsed.Edu_Courses || parsed) as Record<string, unknown>;
    let courses = root.Edu_Course;

    if (!Array.isArray(courses)) {
      courses = courses ? [courses] : [];
    }

    for (const c of courses as Record<string, unknown>[]) {
      try {
        const erpId = c.id ? Number(c.id) : null;

        const courseData = {
          code: (c.sCode as string) || null,
          name: (c.sCourseHL as string) || "Без названия",
          description: (c.sDescription as string) || null,
          durationDays: c.nDurationInDays ? Number(c.nDurationInDays) : 1,
          pricePerPerson: c.nPricePerPerson ? Number(c.nPricePerPerson) : 0,
        };

        if (erpId) {
          const existing = await prisma.course.findUnique({
            where: { erpId },
          });

          if (existing) {
            await prisma.course.update({
              where: { erpId },
              data: courseData,
            });
            result.updated++;
          } else {
            const newCourse = await prisma.course.create({
              data: { ...courseData, erpId },
            });

            await prisma.priceHistory.create({
              data: {
                courseId: newCourse.id,
                pricePerPerson: courseData.pricePerPerson,
              },
            });

            result.created++;
          }
        } else {
          const newCourse = await prisma.course.create({
            data: courseData,
          });

          await prisma.priceHistory.create({
            data: {
              courseId: newCourse.id,
              pricePerPerson: courseData.pricePerPerson,
            },
          });

          result.created++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(
          `Ошибка обработки курса ${(c as Record<string, unknown>).sCourseHL || (c as Record<string, unknown>).id || "unknown"}: ${message}`
        );
      }
    }
  }

  return result;
}

// POST /api/xml/import — Батч-импорт данных из XML-файлов (формат Global ERP Hackathon)
// Поддерживает загрузку нескольких файлов через поля "file" или "files"
// Форматы: Edu_Participant, Edu_Course
export async function POST(request: Request) {
  try {
    const session = await getSession();
    const formData = await request.formData();

    // Собираем файлы из полей "file" и "files"
    const files: File[] = [];
    const fileEntries = formData.getAll("file");
    const filesEntries = formData.getAll("files");

    for (const entry of [...fileEntries, ...filesEntries]) {
      if (entry instanceof File && entry.size > 0) {
        files.push(entry);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "XML-файлы не переданы. Используйте поле 'file' или 'files'" },
        { status: 400 }
      );
    }

    // Обрабатываем каждый файл независимо
    const results: {
      filename: string;
      type: string | null;
      created: number;
      updated: number;
      errors: string[];
    }[] = [];

    for (const file of files) {
      const fileResult = await processFile(file);
      results.push(fileResult);

      // Логируем каждый импорт
      await prisma.integrationLog.create({
        data: {
          action: "import",
          entityType: fileResult.type || "unknown",
          fileName: fileResult.filename,
          recordsCreated: fileResult.created,
          recordsUpdated: fileResult.updated,
          recordsErrored: fileResult.errors.length,
          details: fileResult.errors.length > 0 ? { errors: fileResult.errors } : undefined,
          userId: session?.id || null,
        },
      });
    }

    // Считаем итоги
    const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    return NextResponse.json({
      results,
      totalCreated,
      totalUpdated,
      totalErrors,
    });
  } catch (error) {
    console.error("Ошибка при импорте XML:", error);
    return NextResponse.json(
      { error: "Не удалось импортировать XML" },
      { status: 500 }
    );
  }
}
