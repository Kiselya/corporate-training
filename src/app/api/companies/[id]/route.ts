import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
        employees: true,
        specifications: true,
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
