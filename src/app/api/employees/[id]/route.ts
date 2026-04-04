import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/employees/[id] — Получить сотрудника по ID с компанией и группами
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const include = {
      company: true,
      groupMembers: {
        include: {
          group: {
            include: {
              course: true,
              _count: { select: { members: true } },
            },
          },
        },
      },
    };

    // Поддержка поиска по id, code или erpId для коротких URL
    let employee = await prisma.employee.findUnique({ where: { id }, include });
    if (!employee) {
      employee = await prisma.employee.findFirst({
        where: { OR: [{ code: id }, { erpId: isNaN(Number(id)) ? undefined : Number(id) }] },
        include,
      });
    }

    if (!employee) {
      return NextResponse.json(
        { error: "Сотрудник не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error("Ошибка при получении сотрудника:", error);
    return NextResponse.json(
      { error: "Не удалось получить сотрудника" },
      { status: 500 }
    );
  }
}

// PUT /api/employees/[id] — Обновить сотрудника
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { erpId, code, lastName, firstName, middleName, fullName, email, phone, note, companyId } = body;

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(erpId !== undefined && { erpId: erpId ? Number(erpId) : null }),
        ...(code !== undefined && { code }),
        ...(lastName !== undefined && { lastName }),
        ...(firstName !== undefined && { firstName }),
        ...(middleName !== undefined && { middleName }),
        ...(fullName !== undefined && { fullName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(note !== undefined && { note: note || null }),
        ...(companyId !== undefined && { companyId: companyId || null }),
      },
      include: {
        company: true,
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.error("Ошибка при обновлении сотрудника:", error);
    return NextResponse.json(
      { error: "Не удалось обновить сотрудника" },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/[id] — Удалить сотрудника
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.employee.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Сотрудник удалён" });
  } catch (error) {
    console.error("Ошибка при удалении сотрудника:", error);
    return NextResponse.json(
      { error: "Не удалось удалить сотрудника" },
      { status: 500 }
    );
  }
}
