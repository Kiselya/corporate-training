/**
 * Seed-скрипт: начальные данные для системы корпоративного обучения
 * Идемпотентный — можно запускать повторно без дублей
 */
import "dotenv/config";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Начинаем заполнение базы данных...");

  // ─── Компании ────────────────────────────────────────────
  const companies = [
    { code: "ROM", name: 'ООО "Ромашка"', erpId: 162362 },
    { code: "VEK", name: 'ООО "Вектор"', erpId: 162363 },
    { code: "TPR", name: 'АО "ТехноПром"', erpId: 162364 },
    { code: "SST", name: 'ПАО "СеверСтрой"', erpId: 162365 },
    { code: "INF", name: 'ООО "ИнфоСистемы"', erpId: 162366 },
    { code: "ALF", name: 'ЗАО "АльфаКонсалт"', erpId: 162367 },
  ];

  const companyMap = {};
  for (const c of companies) {
    const created = await prisma.company.upsert({
      where: { erpId: c.erpId },
      update: { code: c.code, name: c.name },
      create: c,
    });
    companyMap[c.erpId] = created.id;
    console.log(`  ✓ Компания: ${c.name}`);
  }

  // ─── Участники обучения ──────────────────────────────────
  const employees = [
    { erpId: 1203, code: "0048", lastName: "Иванов", firstName: "Иван", middleName: "Иванович", fullName: "Иванов Иван Иванович", email: "ivanov@romashka.ru", orgErpId: 162362 },
    { erpId: 1204, code: "0049", lastName: "Петров", firstName: "Алексей", middleName: "Сергеевич", fullName: "Петров Алексей Сергеевич", email: "petrov@vektor.ru", orgErpId: 162363 },
    { erpId: 1205, code: "0050", lastName: "Смирнова", firstName: "Мария", middleName: "Андреевна", fullName: "Смирнова Мария Андреевна", email: "smirnova@technoprom.ru", orgErpId: 162364 },
    { erpId: 1206, code: "0051", lastName: "Кузнецов", firstName: "Дмитрий", middleName: "Олегович", fullName: "Кузнецов Дмитрий Олегович", email: "kuznetsov@severstroy.ru", orgErpId: 162365 },
    { erpId: 1207, code: "0052", lastName: "Васильева", firstName: "Екатерина", middleName: "Игоревна", fullName: "Васильева Екатерина Игоревна", email: "vasileva@infosys.ru", orgErpId: 162366 },
    { erpId: 1208, code: "0053", lastName: "Новиков", firstName: "Роман", middleName: "Владимирович", fullName: "Новиков Роман Владимирович", email: "novikov@alfaconsult.ru", orgErpId: 162367 },
  ];

  for (const e of employees) {
    await prisma.employee.upsert({
      where: { erpId: e.erpId },
      update: { lastName: e.lastName, firstName: e.firstName, middleName: e.middleName, fullName: e.fullName, email: e.email },
      create: {
        erpId: e.erpId, code: e.code, lastName: e.lastName, firstName: e.firstName,
        middleName: e.middleName, fullName: e.fullName, email: e.email, companyId: companyMap[e.orgErpId],
      },
    });
    console.log(`  ✓ Участник: ${e.fullName}`);
  }

  // ─── Курсы обучения ──────────────────────────────────────
  const courses = [
    { erpId: 4217, code: "0001", name: "Базовый курс бизнес-аналитика", description: "Курс для бизнес-аналитиков по ознакомлению с общесистемными возможностями Global ERP.", durationDays: 3, pricePerPerson: 10000 },
    { erpId: 4218, code: "0002", name: "Продвинутый курс бизнес-аналитика", description: "Расширенный курс бизнес-аналитика знакомит пользователей с продвинутыми возможностями системы.", durationDays: 5, pricePerPerson: 18000 },
    { erpId: 4219, code: "0003", name: "Управление проектами в ИТ", description: "Программа охватывает основы и практику управления ИТ-проектами.", durationDays: 4, pricePerPerson: 15000 },
    { erpId: 4220, code: "0004", name: "Основы работы в Global ERP", description: "Курс знакомит с интерфейсом и базовыми модулями системы Global ERP.", durationDays: 2, pricePerPerson: 8000 },
    { erpId: 4221, code: "0005", name: "Финансовый учет и бюджетирование", description: "Принципы финансового учета, формирования бюджета и анализа затрат.", durationDays: 3, pricePerPerson: 12000 },
    { erpId: 4222, code: "0006", name: "Управление корпоративным обучением", description: "Методы планирования, организации и оценки эффективности корпоративного обучения.", durationDays: 4, pricePerPerson: 16000 },
  ];

  for (const c of courses) {
    await prisma.course.upsert({
      where: { erpId: c.erpId },
      update: { name: c.name, description: c.description, durationDays: c.durationDays, pricePerPerson: c.pricePerPerson },
      create: c,
    });
    console.log(`  ✓ Курс: ${c.name} (${c.pricePerPerson}₽/чел, ${c.durationDays} дн.)`);
  }

  // ─── Учебные группы (только если нет ни одной) ───────────
  const existingGroups = await prisma.trainingGroup.count();
  if (existingGroups === 0) {
    const courseRecords = await prisma.course.findMany();
    const employeeRecords = await prisma.employee.findMany();

    const group1 = await prisma.trainingGroup.create({
      data: {
        name: "Группа БА-2026-01",
        courseId: courseRecords.find(c => c.erpId === 4217).id,
        startDate: new Date("2026-04-07"),
        endDate: new Date("2026-04-09"),
        pricePerPerson: 10000,
        status: "IN_PROGRESS",
        members: {
          create: [
            { employeeId: employeeRecords[0].id, progressPercent: 75 },
            { employeeId: employeeRecords[1].id, progressPercent: 50 },
            { employeeId: employeeRecords[2].id, progressPercent: 90 },
          ],
        },
      },
    });
    console.log(`  ✓ Группа: ${group1.name}`);

    const group2 = await prisma.trainingGroup.create({
      data: {
        name: "Группа ИТ-2026-01",
        courseId: courseRecords.find(c => c.erpId === 4219).id,
        startDate: new Date("2026-04-10"),
        endDate: new Date("2026-04-13"),
        pricePerPerson: 15000,
        status: "PLANNED",
        members: {
          create: [
            { employeeId: employeeRecords[3].id, progressPercent: 0 },
            { employeeId: employeeRecords[4].id, progressPercent: 0 },
          ],
        },
      },
    });
    console.log(`  ✓ Группа: ${group2.name}`);

    const group3 = await prisma.trainingGroup.create({
      data: {
        name: "Группа ERP-2026-01",
        courseId: courseRecords.find(c => c.erpId === 4220).id,
        startDate: new Date("2026-04-14"),
        endDate: new Date("2026-04-15"),
        pricePerPerson: 8000,
        status: "PLANNED",
        members: {
          create: [
            { employeeId: employeeRecords[0].id, progressPercent: 0 },
            { employeeId: employeeRecords[5].id, progressPercent: 0 },
            { employeeId: employeeRecords[3].id, progressPercent: 0 },
            { employeeId: employeeRecords[4].id, progressPercent: 0 },
          ],
        },
      },
    });
    console.log(`  ✓ Группа: ${group3.name}`);

    // Группа 4 — ЗАВЕРШЁННАЯ (для демо completionRate на дашборде)
    const group4 = await prisma.trainingGroup.create({
      data: {
        name: "Группа БА-2026-00 (архив)",
        courseId: courseRecords.find(c => c.erpId === 4217).id,
        startDate: new Date("2026-03-10"),
        endDate: new Date("2026-03-12"),
        pricePerPerson: 10000,
        status: "COMPLETED",
        members: {
          create: [
            { employeeId: employeeRecords[1].id, progressPercent: 100 },
            { employeeId: employeeRecords[2].id, progressPercent: 95 },
          ],
        },
      },
    });
    console.log(`  ✓ Группа: ${group4.name} (COMPLETED)`);

    // Группа 5 — пересекается с группой 2 для сотрудника [3] → конфликт расписания
    const group5 = await prisma.trainingGroup.create({
      data: {
        name: "Группа ФИН-2026-01",
        courseId: courseRecords.find(c => c.erpId === 4221)?.id || courseRecords[2].id,
        startDate: new Date("2026-04-11"),
        endDate: new Date("2026-04-12"),
        pricePerPerson: 12000,
        status: "PLANNED",
        discountPercent: 10,
        members: {
          create: [
            { employeeId: employeeRecords[3].id, progressPercent: 0 },
          ],
        },
      },
    });
    console.log(`  ✓ Группа: ${group5.name} (конфликт с Группа ИТ для сотрудника ${employeeRecords[3].fullName})`);

    // Спецификация
    const company = await prisma.company.findFirst({ where: { erpId: 162362 } });
    await prisma.specification.upsert({
      where: { number: "SPEC-2026-001" },
      update: {},
      create: {
        number: "SPEC-2026-001",
        date: new Date("2026-04-01"),
        companyId: company.id,
        trainingGroups: { connect: [{ id: group1.id }, { id: group2.id }] },
      },
    });
    console.log("  ✓ Спецификация: SPEC-2026-001");

    // Вторая спецификация — PAID (для демо финансового цикла)
    await prisma.specification.upsert({
      where: { number: "SPEC-2026-002" },
      update: {},
      create: {
        number: "SPEC-2026-002",
        date: new Date("2026-03-15"),
        companyId: company.id,
        status: "PAID",
        trainingGroups: { connect: [{ id: group4.id }] },
      },
    });
    console.log("  ✓ Спецификация: SPEC-2026-002 (PAID)");
  } else {
    console.log(`  ⏭ Группы уже существуют (${existingGroups}), пропускаем`);
  }

  // ─── Модули курсов ───────────────────────────────────────
  const courseRecords = await prisma.course.findMany();
  const baCourse = courseRecords.find(c => c.erpId === 4217);
  if (baCourse) {
    const existingModules = await prisma.courseModule.count({ where: { courseId: baCourse.id } });
    if (existingModules === 0) {
      await prisma.courseModule.createMany({
        data: [
          { courseId: baCourse.id, title: "Введение в Global ERP", type: "LECTURE", durationHours: 2, orderIndex: 1 },
          { courseId: baCourse.id, title: "Интерфейс системы", type: "PRACTICE", durationHours: 3, orderIndex: 2 },
          { courseId: baCourse.id, title: "Работа с данными", type: "LECTURE", durationHours: 2, orderIndex: 3 },
          { courseId: baCourse.id, title: "Практическое задание", type: "ASSIGNMENT", durationHours: 4, orderIndex: 4 },
          { courseId: baCourse.id, title: "Итоговый тест", type: "TEST", durationHours: 1, orderIndex: 5 },
        ],
      });
      console.log("  ✓ Модули: Базовый курс БА (5 модулей)");
    } else {
      console.log(`  ⏭ Модули курса БА уже существуют (${existingModules}), пропускаем`);
    }
  }

  // Модули для ИТ-курса
  const itCourse = courseRecords.find(c => c.erpId === 4219);
  if (itCourse) {
    const existingItModules = await prisma.courseModule.count({ where: { courseId: itCourse.id } });
    if (existingItModules === 0) {
      await prisma.courseModule.createMany({
        data: [
          { courseId: itCourse.id, title: "Архитектура ИТ-инфраструктуры", type: "LECTURE", durationHours: 3, orderIndex: 1 },
          { courseId: itCourse.id, title: "Настройка серверного окружения", type: "PRACTICE", durationHours: 4, orderIndex: 2 },
          { courseId: itCourse.id, title: "Мониторинг и безопасность", type: "LECTURE", durationHours: 2, orderIndex: 3 },
          { courseId: itCourse.id, title: "Лабораторная работа", type: "ASSIGNMENT", durationHours: 6, orderIndex: 4 },
          { courseId: itCourse.id, title: "Экзамен", type: "TEST", durationHours: 2, orderIndex: 5 },
        ],
      });
      console.log("  ✓ Модули: ИТ-курс (5 модулей)");
    }
  }

  // ─── Администратор ───────────────────────────────────────
  const bcrypt = await import("bcryptjs");
  const adminExists = await prisma.user.findUnique({ where: { email: "admin@training.local" } });
  if (!adminExists) {
    const hash = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: {
        email: "admin@training.local",
        passwordHash: hash,
        name: "Администратор",
        role: "SUPER_ADMIN",
        mustChangePassword: false,
      },
    });
    console.log("  ✓ Суперадмин: admin@training.local / admin123");
  } else {
    console.log("  ✓ Суперадмин уже существует");
  }

  // ─── Промокод ────────────────────────────────────────────
  const promoExists = await prisma.promoCode.findUnique({ where: { code: "SPRING2026" } });
  if (!promoExists) {
    await prisma.promoCode.create({
      data: {
        code: "SPRING2026",
        discountPercent: 15,
        description: "Весенняя скидка 15% на обучение",
        isActive: true,
        validTo: new Date("2026-06-30"),
      },
    });
    console.log("  ✓ Промокод: SPRING2026 (15%)");
  }

  console.log("\n✅ База данных заполнена успешно!");
  console.log("   Вход: admin@training.local / admin123");
}

main()
  .catch((e) => { console.error("❌ Ошибка:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
