import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reports?from=2026-01-01&to=2026-12-31&format=json
 *
 * Выгрузка отчётности по обучению за период
 * Отчёт содержит: информацию по группам обучения, прогресс,
 * стоимость обучения в разрезе групп.
 *
 * Формула расчёта стоимости группы:
 * totalCost = pricePerPerson × memberCount
 *
 * Формула среднего прогресса:
 * avgProgress = SUM(member.progressPercent) / memberCount
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const format = searchParams.get("format") || "json";

    const where: Record<string, unknown> = {};
    if (from || to) {
      where.startDate = {};
      if (from) (where.startDate as Record<string, unknown>).gte = new Date(from);
      if (to) (where.startDate as Record<string, unknown>).lte = new Date(to);
    }

    const groups = await prisma.trainingGroup.findMany({
      where,
      include: {
        course: true,
        members: {
          include: {
            employee: {
              include: { company: true },
            },
          },
        },
        specification: true,
      },
      orderBy: { startDate: "asc" },
    });

    // Формируем данные отчёта
    const reportData = groups.map((group) => {
      const memberCount = group.members.length;
      const totalCost = group.pricePerPerson * memberCount;
      const avgProgress =
        memberCount > 0
          ? Math.round(group.members.reduce((sum, m) => sum + m.progressPercent, 0) / memberCount)
          : 0;

      return {
        groupName: group.name || `Группа #${group.id.slice(0, 6)}`,
        courseName: group.course.name,
        startDate: group.startDate.toISOString().split("T")[0],
        endDate: group.endDate.toISOString().split("T")[0],
        status: group.status,
        statusLabel:
          group.status === "PLANNED" ? "Планируется" :
          group.status === "IN_PROGRESS" ? "В процессе" :
          group.status === "COMPLETED" ? "Завершено" : "Отменено",
        memberCount,
        pricePerPerson: group.pricePerPerson,
        totalCost,
        avgProgress,
        specificationNumber: group.specification?.number || "—",
        members: group.members.map((m) => ({
          fullName: m.employee.fullName,
          company: m.employee.company?.name || "—",
          progress: m.progressPercent,
        })),
      };
    });

    // Итоги
    const totalBudget = reportData.reduce((sum, g) => sum + g.totalCost, 0);
    const totalMembers = reportData.reduce((sum, g) => sum + g.memberCount, 0);
    const avgProgressAll =
      reportData.length > 0
        ? Math.round(reportData.reduce((sum, g) => sum + g.avgProgress, 0) / reportData.length)
        : 0;

    const report = {
      generatedAt: new Date().toISOString(),
      period: { from: from || "начало", to: to || "конец" },
      summary: {
        totalGroups: reportData.length,
        totalMembers,
        totalBudget,
        avgProgress: avgProgressAll,
      },
      groups: reportData,
    };

    if (format === "csv") {
      // Экспорт в CSV (для Excel)
      const headers = [
        "Группа",
        "Курс",
        "Начало",
        "Окончание",
        "Статус",
        "Участников",
        "Цена/чел (₽)",
        "Стоимость (₽)",
        "Прогресс (%)",
        "Спецификация",
      ];
      const rows = reportData.map((g) =>
        [
          g.groupName,
          g.courseName,
          g.startDate,
          g.endDate,
          g.statusLabel,
          g.memberCount,
          g.pricePerPerson,
          g.totalCost,
          g.avgProgress,
          g.specificationNumber,
        ].join(";")
      );
      const csv = "\uFEFF" + [headers.join(";"), ...rows].join("\n"); // BOM для корректного отображения кириллицы в Excel

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="report_${from || "all"}_${to || "all"}.csv"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Ошибка формирования отчёта" }, { status: 500 });
  }
}
