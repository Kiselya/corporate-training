import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/companies/[id] — Получить компанию по ID с сотрудниками и спецификациями
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        employees: {
          include: {
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
          },
        },
        specifications: {
          include: {
            trainingGroups: {
              include: { course: true, members: true },
            },
          },
        },
        courses: {
          include: { course: true },
        },
        _count: {
          select: { employees: true, specifications: true },
        },
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Компания не найдена" },
        { status: 404 }
      );
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error("Ошибка при получении компании:", error);
    return NextResponse.json(
      { error: "Не удалось получить компанию" },
      { status: 500 }
    );
  }
}

// PUT /api/companies/[id] — Обновить компанию
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { code, name, erpId, inn, kpp, ogrn, address, phone, email, contactPerson, customFields } = body;

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(erpId !== undefined && { erpId: erpId ? Number(erpId) : null }),
        ...(inn !== undefined && { inn: inn || null }),
        ...(kpp !== undefined && { kpp: kpp || null }),
        ...(ogrn !== undefined && { ogrn: ogrn || null }),
        ...(address !== undefined && { address: address || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(contactPerson !== undefined && { contactPerson: contactPerson || null }),
        ...(customFields !== undefined && { customFields }),
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("Ошибка при обновлении компании:", error);
    return NextResponse.json(
      { error: "Не удалось обновить компанию" },
      { status: 500 }
    );
  }
}

// DELETE /api/companies/[id] — Удалить компанию
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.company.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Компания удалена" });
  } catch (error) {
    console.error("Ошибка при удалении компании:", error);
    return NextResponse.json(
      { error: "Не удалось удалить компанию" },
      { status: 500 }
    );
  }
}

// PATCH /api/companies/[id] — Назначить/удалить курсы компании
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const { addCourseIds, removeCourseIds } = await request.json();

    if (addCourseIds && Array.isArray(addCourseIds)) {
      for (const courseId of addCourseIds) {
        await prisma.companyCourse.upsert({
          where: { companyId_courseId: { companyId: id, courseId } },
          update: {},
          create: { companyId: id, courseId },
        });
      }
    }

    if (removeCourseIds && Array.isArray(removeCourseIds)) {
      await prisma.companyCourse.deleteMany({
        where: { companyId: id, courseId: { in: removeCourseIds } },
      });
    }

    const updated = await prisma.companyCourse.findMany({
      where: { companyId: id },
      include: { course: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Ошибка назначения курсов:", error);
    return NextResponse.json({ error: `Ошибка: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}
