import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Builder } from "xml2js";
import { getSession } from "@/lib/auth";

// GET /api/xml/export/[type]/[id] — Экспорт сущности в XML-формат Global ERP
// Параметр type: "employee" | "course" | "group"
// Параметр id: ID записи в нашей системе
export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await params;
    const session = await getSession();

    const builder = new Builder({
      xmldec: { version: "1.0", encoding: "UTF-8" },
      renderOpts: { pretty: true, indent: "  " },
    });

    let xmlObj: Record<string, unknown>;
    let entityType: string;

    switch (type) {
      // ─── Экспорт сотрудника в формат Edu_Participant ────────────────
      // Обратный маппинг полей нашей системы -> формат ERP:
      // firstName (имя)     -> sMiddleName в ERP
      // middleName (отчество) -> sFirstName в ERP
      case "employee": {
        const employee = await prisma.employee.findUnique({
          where: { id },
          include: { company: true },
        });

        if (!employee) {
          return NextResponse.json(
            { error: "Сотрудник не найден" },
            { status: 404 }
          );
        }

        entityType = "Edu_Participant";
        xmlObj = {
          Edu_Participant: {
            id: employee.erpId || "",
            sCode: employee.code || "",
            sLastName: employee.lastName,
            sMiddleName: employee.firstName,     // Имя -> sMiddleName (особенность ERP)
            sFirstName: employee.middleName || "", // Отчество -> sFirstName (особенность ERP)
            sFIO: employee.fullName,
            idOrganization: employee.company?.erpId || "",
            idOrganizationHL: employee.company?.erpId || "",
          },
        };
        break;
      }

      // ─── Экспорт курса в формат Edu_Course ────────────────────────
      case "course": {
        const course = await prisma.course.findUnique({
          where: { id },
        });

        if (!course) {
          return NextResponse.json(
            { error: "Курс не найден" },
            { status: 404 }
          );
        }

        entityType = "Edu_Course";
        xmlObj = {
          Edu_Course: {
            id: course.erpId || "",
            sCode: course.code || "",
            sCourseHL: course.name,
            sDescription: course.description || "",
            nDurationInDays: course.durationDays,
            nPricePerPerson: course.pricePerPerson,
          },
        };
        break;
      }

      // ─── Экспорт группы в формат Edu_TrainingGroup ──────────────
      case "group": {
        const group = await prisma.trainingGroup.findUnique({
          where: { id },
          include: {
            course: true,
            members: {
              include: {
                employee: {
                  include: { company: true },
                },
              },
            },
          },
        });

        if (!group) {
          return NextResponse.json(
            { error: "Группа не найдена" },
            { status: 404 }
          );
        }

        const memberCount = group.members.length;
        const discount = group.discountPercent ?? 0;
        const totalCost = group.pricePerPerson * memberCount * (1 - discount / 100);
        const avgProgress =
          memberCount > 0
            ? Math.round(
                group.members.reduce((sum, m) => sum + m.progressPercent, 0) /
                  memberCount
              )
            : 0;

        entityType = "TrainingGroup";
        xmlObj = {
          Edu_TrainingGroup: {
            id: group.id,
            sName: group.name || "",
            sCourseHL: group.course.name,
            dStartDate: group.startDate.toISOString().split("T")[0],
            dEndDate: group.endDate.toISOString().split("T")[0],
            sStatus: group.status,
            nPricePerPerson: group.pricePerPerson,
            nMemberCount: memberCount,
            nTotalCost: totalCost,
            nAvgProgress: avgProgress,
            Members: {
              Edu_GroupMember: group.members.map((m) => ({
                sFIO: m.employee.fullName,
                sOrganization: m.employee.company?.name || "",
                nProgressPercent: m.progressPercent,
              })),
            },
          },
        };
        break;
      }

      default:
        return NextResponse.json(
          {
            error: `Неизвестный тип '${type}'. Допустимые: employee, course, group`,
          },
          { status: 400 }
        );
    }

    const xml = builder.buildObject(xmlObj);

    // Логируем экспорт
    await prisma.integrationLog.create({
      data: {
        action: "export",
        entityType: entityType!,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsErrored: 0,
        details: { exportedId: id, type },
        userId: session?.id || null,
      },
    });

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}_${id}.xml"`,
      },
    });
  } catch (error) {
    console.error("Ошибка при экспорте XML:", error);
    return NextResponse.json(
      { error: "Не удалось экспортировать в XML" },
      { status: 500 }
    );
  }
}
