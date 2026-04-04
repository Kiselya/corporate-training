import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard — Полная статистика для панели управления (3 вкладки)
 *
 * Структура ответа:
 * - summary: общие KPI
 * - financial: финансовые данные (оборот по месяцам, по курсам, топ-5 дорогих групп)
 * - analytical: аналитика (популярность курсов, прогресс, завершаемость)
 * - operational: управленческие данные (статусы, ближайшие обучения, конфликты)
 */

const MONTH_NAMES_RU = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

export async function GET(request: Request) {
  try {
    // Фильтр по компании (опционально, поддерживает несколько через запятую)
    const { searchParams } = new URL(request.url);
    const companyIdsParam = searchParams.get("companyIds");
    const companyIds = companyIdsParam ? companyIdsParam.split(",").filter(Boolean) : [];

    const groupWhere = companyIds.length > 0
      ? { members: { some: { employee: { companyId: { in: companyIds } } } } }
      : {};
    const empWhere = companyIds.length > 0 ? { companyId: { in: companyIds } } : {};

    const [
      totalGroups,
      totalEmployees,
      totalCourses,
      totalSpecifications,
      groups,
      groupsByStatus,
      upcomingTrainings,
      employeesByCompany,
    ] = await Promise.all([
      prisma.trainingGroup.count({ where: groupWhere }),
      prisma.employee.count({ where: empWhere }),
      prisma.course.count(),
      prisma.specification.count({ where: companyIds.length > 0 ? { companyId: { in: companyIds } } : {} }),

      // Все группы с участниками и прогрессом — для всех расчётов
      prisma.trainingGroup.findMany({
        where: groupWhere,
        include: {
          course: true,
          members: {
            select: {
              progressPercent: true,
              employeeId: true,
              employee: { select: { companyId: true } },
            },
          },
          _count: { select: { members: true } },
        },
      }),

      prisma.trainingGroup.groupBy({
        by: ["status"],
        where: groupWhere,
        _count: { id: true },
      }),

      prisma.trainingGroup.findMany({
        where: { ...groupWhere, status: { in: ["PLANNED", "IN_PROGRESS"] } },
        include: {
          course: true,
          _count: { select: { members: true } },
        },
        orderBy: { startDate: "asc" },
        take: 10,
      }),

      prisma.company.findMany({
        select: {
          name: true,
          _count: { select: { employees: true } },
        },
        orderBy: { employees: { _count: "desc" } },
      }),
    ]);

    // ─── Summary ─────────────────────────────────────────────────
    // Расчёт стоимости с учётом скидки (discountPercent)
    const calcCost = (price: number, members: number, discount?: number | null) =>
      price * members * (1 - (discount ?? 0) / 100);

    const totalBudget = groups.reduce(
      (sum, g) => sum + calcCost(g.pricePerPerson, g._count.members, g.discountPercent),
      0,
    );

    // ─── Статусы (общая карта) ───────────────────────────────────
    const statusMap: Record<string, number> = {
      PLANNED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const item of groupsByStatus) {
      statusMap[item.status] = item._count.id;
    }

    // ─── FINANCIAL ───────────────────────────────────────────────

    // 1. Revenue by month (по startDate группы)
    const revenueByMonthMap: Record<string, number> = {};
    for (const g of groups) {
      const d = new Date(g.startDate);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const cost = calcCost(g.pricePerPerson, g._count.members, g.discountPercent);
      revenueByMonthMap[key] = (revenueByMonthMap[key] || 0) + cost;
    }
    const revenueByMonth = Object.entries(revenueByMonthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, revenue]) => {
        const [year, monthIdx] = key.split("-");
        const monthName = MONTH_NAMES_RU[parseInt(monthIdx, 10)];
        return {
          month: `${monthName} ${year}`,
          revenue: Math.round(revenue),
        };
      });

    // 1b. Revenue by month broken down by company (для stacked bar chart)
    // Определяем "основную компанию" группы по большинству участников
    const revenueByMonthCompanyMap: Record<string, Record<string, number>> = {};
    for (const g of groups) {
      const d = new Date(g.startDate);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const cost = calcCost(g.pricePerPerson, g._count.members, g.discountPercent);

      // Считаем сколько участников от каждой компании
      const companyCounts: Record<string, number> = {};
      for (const m of g.members) {
        const cId = m.employee?.companyId || "unknown";
        companyCounts[cId] = (companyCounts[cId] || 0) + 1;
      }
      // Распределяем стоимость пропорционально участникам от каждой компании
      const totalMembers = g._count.members || 1;
      for (const [cId, count] of Object.entries(companyCounts)) {
        if (!revenueByMonthCompanyMap[monthKey]) revenueByMonthCompanyMap[monthKey] = {};
        const share = (cost * count) / totalMembers;
        revenueByMonthCompanyMap[monthKey][cId] = (revenueByMonthCompanyMap[monthKey][cId] || 0) + share;
      }
    }

    // Собираем все уникальные companyId
    const allCompanyIds = [...new Set(groups.flatMap((g) => g.members.map((m) => m.employee?.companyId).filter(Boolean)))];
    // Получаем имена компаний
    const companyNames = await prisma.company.findMany({
      where: { id: { in: allCompanyIds as string[] } },
      select: { id: true, name: true },
    });
    const companyNameMap: Record<string, string> = {};
    for (const c of companyNames) companyNameMap[c.id] = c.name;

    const revenueByMonthByCompany = Object.entries(revenueByMonthCompanyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, companies]) => {
        const [year, monthIdx] = key.split("-");
        const monthName = MONTH_NAMES_RU[parseInt(monthIdx, 10)];
        const entry: Record<string, unknown> = { month: `${monthName} ${year}` };
        for (const [cId, revenue] of Object.entries(companies)) {
          entry[companyNameMap[cId] || cId] = Math.round(revenue);
        }
        return entry;
      });

    // 2. Revenue by course (с участниками)
    const revenueByCourseMap: Record<
      string,
      { revenue: number; groups: number; participants: number }
    > = {};
    for (const g of groups) {
      const name = g.course.name;
      if (!revenueByCourseMap[name]) {
        revenueByCourseMap[name] = { revenue: 0, groups: 0, participants: 0 };
      }
      revenueByCourseMap[name].revenue += calcCost(g.pricePerPerson, g._count.members, g.discountPercent);
      revenueByCourseMap[name].groups += 1;
      revenueByCourseMap[name].participants += g._count.members;
    }
    const revenueByCourse = Object.entries(revenueByCourseMap)
      .map(([name, data]) => ({
        name: name.length > 30 ? name.slice(0, 30) + "…" : name,
        revenue: Math.round(data.revenue),
        groups: data.groups,
        participants: data.participants,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 3. Average cost per employee
    const avgCostPerEmployee =
      totalEmployees > 0 ? Math.round(totalBudget / totalEmployees) : 0;

    // 4. Top 5 most expensive groups
    const topExpensiveGroups = groups
      .map((g) => ({
        name: g.name || "Без названия",
        courseName: g.course.name,
        totalCost: Math.round(calcCost(g.pricePerPerson, g._count.members, g.discountPercent)),
        memberCount: g._count.members,
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);

    // ─── ANALYTICAL ──────────────────────────────────────────────

    // Course popularity + average progress
    const courseAnalyticsMap: Record<
      string,
      {
        groupCount: number;
        totalParticipants: number;
        totalProgress: number;
        memberCount: number;
        completedCount: number;
        totalCount: number;
      }
    > = {};
    for (const g of groups) {
      const name = g.course.name;
      if (!courseAnalyticsMap[name]) {
        courseAnalyticsMap[name] = {
          groupCount: 0,
          totalParticipants: 0,
          totalProgress: 0,
          memberCount: 0,
          completedCount: 0,
          totalCount: 0,
        };
      }
      const ca = courseAnalyticsMap[name];
      ca.groupCount += 1;
      ca.totalParticipants += g._count.members;
      ca.totalCount += 1;
      if (g.status === "COMPLETED") ca.completedCount += 1;
      for (const m of g.members) {
        ca.totalProgress += m.progressPercent;
        ca.memberCount += 1;
      }
    }

    const coursePopularity = Object.entries(courseAnalyticsMap)
      .map(([name, data]) => ({
        name: name.length > 30 ? name.slice(0, 30) + "…" : name,
        groupCount: data.groupCount,
        totalParticipants: data.totalParticipants,
        avgProgress:
          data.memberCount > 0
            ? Math.round(data.totalProgress / data.memberCount)
            : 0,
      }))
      .sort((a, b) => b.totalParticipants - a.totalParticipants);

    const progressByCourse = Object.entries(courseAnalyticsMap)
      .map(([name, data]) => ({
        name: name.length > 25 ? name.slice(0, 25) + "…" : name,
        avgProgress:
          data.memberCount > 0
            ? Math.round(data.totalProgress / data.memberCount)
            : 0,
        completedCount: data.completedCount,
        totalCount: data.totalCount,
      }))
      .sort((a, b) => b.avgProgress - a.avgProgress);

    // Completion rate
    const completedGroups = statusMap.COMPLETED || 0;
    const completionRate =
      totalGroups > 0 ? Math.round((completedGroups / totalGroups) * 100) : 0;

    // Average group size
    const totalMembers = groups.reduce((sum, g) => sum + g._count.members, 0);
    const avgGroupSize =
      groups.length > 0
        ? Math.round((totalMembers / groups.length) * 10) / 10
        : 0;

    // ─── OPERATIONAL ─────────────────────────────────────────────

    // Статусы для pie chart
    const chartStatuses = [
      { name: "В процессе", value: statusMap.IN_PROGRESS, color: "#3B82F6" },
      { name: "Планируется", value: statusMap.PLANNED, color: "#94A3B8" },
      { name: "Завершено", value: statusMap.COMPLETED, color: "#10B981" },
      { name: "Отменено", value: statusMap.CANCELLED, color: "#EF4444" },
    ].filter((s) => s.value > 0);

    // Участники по компаниям
    const companiesDistribution = employeesByCompany
      .filter((c) => c._count.employees > 0)
      .map((c) => ({
        name: c.name.length > 20 ? c.name.slice(0, 20) + "…" : c.name,
        value: c._count.employees,
      }));

    // Conflicts count (inline overlap check)
    // Считаем количество уникальных конфликтов сотрудников с пересекающимися группами
    const activeGroups = groups.filter((g) => g.status !== "CANCELLED");
    const employeeGroupsMap: Record<string, typeof activeGroups> = {};
    for (const group of activeGroups) {
      for (const member of group.members) {
        const empId = member.employeeId;
        if (!employeeGroupsMap[empId]) employeeGroupsMap[empId] = [];
        employeeGroupsMap[empId].push(group);
      }
    }

    let conflictsCount = 0;
    for (const empGroups of Object.values(employeeGroupsMap)) {
      for (let i = 0; i < empGroups.length; i++) {
        for (let j = i + 1; j < empGroups.length; j++) {
          const a = empGroups[i];
          const b = empGroups[j];
          if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
            conflictsCount++;
          }
        }
      }
    }

    // ─── Response ────────────────────────────────────────────────

    return NextResponse.json({
      summary: {
        totalGroups,
        totalEmployees,
        totalCourses,
        totalSpecifications,
        totalBudget: Math.round(totalBudget),
      },
      financial: {
        revenueByMonth,
        revenueByMonthByCompany,
        companyNames: companyNameMap,
        revenueByCourse,
        avgCostPerEmployee,
        topExpensiveGroups,
      },
      analytical: {
        coursePopularity,
        completionRate,
        avgGroupSize,
        progressByCourse,
      },
      operational: {
        groupsByStatus: statusMap,
        upcomingTrainings: upcomingTrainings.map((t) => ({
          id: t.id,
          name: t.name,
          courseName: t.course.name,
          startDate: t.startDate,
          endDate: t.endDate,
          status: t.status,
          memberCount: t._count.members,
          totalCost: Math.round(t.pricePerPerson * t._count.members * (1 - (t.discountPercent ?? 0) / 100)),
        })),
        conflictsCount,
        statuses: chartStatuses,
        companiesDistribution,
      },
    });
  } catch (error) {
    console.error("Ошибка при получении данных дашборда:", error);
    return NextResponse.json(
      { error: "Не удалось получить данные дашборда" },
      { status: 500 },
    );
  }
}
