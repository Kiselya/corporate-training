import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/conflicts — Проверка конфликтов в расписании
 *
 * Бизнес-логика обнаружения конфликтов:
 * 1. Сотрудник записан на два разных курса в пересекающиеся даты
 * 2. Две группы по одному и тому же курсу начинаются в одно время
 *
 * Алгоритм пересечения интервалов:
 * Два интервала [A_start, A_end] и [B_start, B_end] пересекаются,
 * если A_start <= B_end И B_start <= A_end
 */
export async function GET() {
  try {
    const groups = await prisma.trainingGroup.findMany({
      where: { status: { not: "CANCELLED" } },
      include: {
        course: true,
        members: {
          include: { employee: true },
        },
      },
    });

    const conflicts: {
      type: "employee_overlap" | "course_overlap";
      description: string;
      groupIds: string[];
      employeeId?: string;
      employeeName?: string;
    }[] = [];

    // 1. Проверка: сотрудник записан на пересекающиеся курсы
    const employeeGroups: Record<string, typeof groups> = {};
    for (const group of groups) {
      for (const member of group.members) {
        const empId = member.employeeId;
        if (!employeeGroups[empId]) employeeGroups[empId] = [];
        employeeGroups[empId].push(group);
      }
    }

    for (const [empId, empGroups] of Object.entries(employeeGroups)) {
      for (let i = 0; i < empGroups.length; i++) {
        for (let j = i + 1; j < empGroups.length; j++) {
          const a = empGroups[i];
          const b = empGroups[j];
          // Проверка пересечения интервалов
          if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
            const employee = a.members.find((m) => m.employeeId === empId)?.employee;
            conflicts.push({
              type: "employee_overlap",
              description: `${employee?.fullName || "Сотрудник"} записан одновременно в "${a.name || a.course.name}" и "${b.name || b.course.name}"`,
              groupIds: [a.id, b.id],
              employeeId: empId,
              employeeName: employee?.fullName,
            });
          }
        }
      }
    }

    // 2. Проверка: группы по одному курсу начинаются одновременно
    const courseGroups: Record<string, typeof groups> = {};
    for (const group of groups) {
      if (!courseGroups[group.courseId]) courseGroups[group.courseId] = [];
      courseGroups[group.courseId].push(group);
    }

    for (const [courseId, cGroups] of Object.entries(courseGroups)) {
      for (let i = 0; i < cGroups.length; i++) {
        for (let j = i + 1; j < cGroups.length; j++) {
          const a = cGroups[i];
          const b = cGroups[j];
          if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
            conflicts.push({
              type: "course_overlap",
              description: `Группы "${a.name || "Без названия"}" и "${b.name || "Без названия"}" по курсу "${a.course.name}" пересекаются по датам`,
              groupIds: [a.id, b.id],
            });
          }
        }
      }
    }

    return NextResponse.json({
      conflicts,
      totalConflicts: conflicts.length,
      hasConflicts: conflicts.length > 0,
    });
  } catch (error) {
    console.error("Error checking conflicts:", error);
    return NextResponse.json({ error: "Ошибка проверки конфликтов" }, { status: 500 });
  }
}
