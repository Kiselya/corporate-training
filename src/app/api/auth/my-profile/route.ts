import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/my-profile
 * Возвращает данные текущего пользователя как участника обучения:
 * - Если user.employeeId установлен — используем его
 * - Если нет — пытаемся найти Employee по email и автоматически привязать
 * - Возвращаем: employee, groups (с курсом, участниками, прогрессом), companies
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Необходима авторизация" },
        { status: 401 }
      );
    }

    // 1. Получаем пользователя с привязкой к сотруднику
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, name: true, role: true, employeeId: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    let employeeId = user.employeeId;

    // 2. Если employeeId не установлен — пытаемся найти по email
    if (!employeeId && user.email) {
      const employee = await prisma.employee.findFirst({
        where: { email: user.email },
      });

      if (employee) {
        // Автоматически привязываем
        await prisma.user.update({
          where: { id: user.id },
          data: { employeeId: employee.id },
        });
        employeeId = employee.id;
      }
    }

    // 3. Если сотрудник не найден — возвращаем пустой профиль
    if (!employeeId) {
      return NextResponse.json({
        employee: null,
        groups: [],
        companies: [],
        message: "Профиль не привязан к участнику обучения",
      });
    }

    // 4. Получаем данные сотрудника со всеми связями
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        company: true,
        groupMembers: {
          include: {
            group: {
              include: {
                course: true,
                members: {
                  include: {
                    employee: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({
        employee: null,
        groups: [],
        companies: [],
        message: "Профиль не привязан к участнику обучения",
      });
    }

    // 5. Формируем ответ
    const groups = employee.groupMembers.map((gm) => {
      const group = gm.group;
      const memberCount = group.members.length;
      const avgProgress =
        memberCount > 0
          ? Math.round(
              group.members.reduce((sum, m) => sum + m.progressPercent, 0) /
                memberCount
            )
          : 0;

      return {
        id: group.id,
        name: group.name,
        startDate: group.startDate,
        endDate: group.endDate,
        status: group.status,
        pricePerPerson: group.pricePerPerson,
        course: group.course,
        memberCount,
        avgProgress,
        myProgress: gm.progressPercent,
        myMemberId: gm.id,
        members: group.members.map((m) => ({
          id: m.id,
          employeeId: m.employeeId,
          fullName: m.employee.fullName,
          progressPercent: m.progressPercent,
        })),
      };
    });

    const companies = employee.company ? [employee.company] : [];

    return NextResponse.json({
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        firstName: employee.firstName,
        lastName: employee.lastName,
        middleName: employee.middleName,
        email: employee.email,
        companyId: employee.companyId,
      },
      groups,
      companies,
    });
  } catch (error) {
    console.error("Ошибка получения профиля:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
