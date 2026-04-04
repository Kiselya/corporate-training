/**
 * Утилиты для работы с XML — асинхронная интеграция с Global ERP
 *
 * XML формат Global ERP использует следующие корневые элементы:
 * - Edu_Participant — участник обучения (сотрудник)
 * - Edu_Course — курс обучения
 *
 * ВАЖНО: В XML файлах Global ERP поля именуются нестандартно:
 * - sMiddleName — это на самом деле Имя (не отчество!)
 * - sFirstName — это на самом деле Отчество (не имя!)
 * - sFIO — полное ФИО
 * Это особенность API Global ERP, которую нужно учитывать при парсинге.
 */

import { parseStringPromise, Builder } from "xml2js";

// ─── Типы данных из XML Global ERP ────────────────────────

export interface EduParticipantXML {
  id: number;
  sCode: string;
  sLastName: string;
  sMiddleName: string;  // На самом деле — Имя
  sFirstName: string;   // На самом деле — Отчество
  sFIO: string;
  idOrganization: number;
  idOrganizationHL: string;
}

export interface EduCourseXML {
  id: number;
  sCode: string;
  sCourseHL: string;
  sDescription: string;
  nDurationInDays: number;
  nPricePerPerson: number;
}

/**
 * Парсинг XML файла участника обучения (Edu_Participant)
 *
 * Логика парсинга:
 * 1. Парсим XML в JS-объект с помощью xml2js
 * 2. Извлекаем данные из корневого элемента Edu_Participant
 * 3. Преобразуем типы (id и idOrganization в числа)
 * 4. Учитываем перепутанные поля sMiddleName/sFirstName
 */
export async function parseParticipantXML(xmlString: string): Promise<EduParticipantXML> {
  const result = await parseStringPromise(xmlString, { explicitArray: false, trim: true });
  const p = result.Edu_Participant;

  return {
    id: parseInt(p.id, 10),
    sCode: p.sCode || "",
    sLastName: p.sLastName || "",
    sMiddleName: p.sMiddleName || "",  // Это имя
    sFirstName: p.sFirstName || "",     // Это отчество
    sFIO: p.sFIO || "",
    idOrganization: parseInt(p.idOrganization, 10),
    idOrganizationHL: p.idOrganizationHL || "",
  };
}

/**
 * Парсинг XML файла курса обучения (Edu_Course)
 *
 * Логика парсинга:
 * 1. Парсим XML → JS-объект
 * 2. Извлекаем из Edu_Course
 * 3. nDurationInDays и nPricePerPerson преобразуем в числа
 */
export async function parseCourseXML(xmlString: string): Promise<EduCourseXML> {
  const result = await parseStringPromise(xmlString, { explicitArray: false, trim: true });
  const c = result.Edu_Course;

  return {
    id: parseInt(c.id, 10),
    sCode: c.sCode || "",
    sCourseHL: c.sCourseHL || "",
    sDescription: c.sDescription || "",
    nDurationInDays: parseInt(c.nDurationInDays, 10),
    nPricePerPerson: parseFloat(c.nPricePerPerson),
  };
}

/**
 * Генерация XML для участника обучения
 * Формат совместим с Global ERP для обратной загрузки
 */
export function buildParticipantXML(data: EduParticipantXML): string {
  const builder = new Builder({
    xmldec: { version: "1.0", encoding: "UTF-8" },
    rootName: "Edu_Participant",
  });
  return builder.buildObject({
    id: data.id,
    sCode: data.sCode,
    sLastName: data.sLastName,
    sMiddleName: data.sMiddleName,
    sFirstName: data.sFirstName,
    sFIO: data.sFIO,
    idOrganization: data.idOrganization,
    idOrganizationHL: data.idOrganizationHL,
  });
}

/**
 * Генерация XML для курса обучения
 * Формат совместим с Global ERP
 */
export function buildCourseXML(data: EduCourseXML): string {
  const builder = new Builder({
    xmldec: { version: "1.0", encoding: "UTF-8" },
    rootName: "Edu_Course",
  });
  return builder.buildObject({
    id: data.id,
    sCode: data.sCode,
    sCourseHL: data.sCourseHL,
    sDescription: data.sDescription,
    nDurationInDays: data.nDurationInDays,
    nPricePerPerson: data.nPricePerPerson,
  });
}

/**
 * Автоматическое определение типа XML файла
 * Смотрим на корневой элемент: Edu_Participant или Edu_Course
 */
export async function detectXMLType(xmlString: string): Promise<"participant" | "course" | "unknown"> {
  const result = await parseStringPromise(xmlString, { explicitArray: false, trim: true });
  if (result.Edu_Participant) return "participant";
  if (result.Edu_Course) return "course";
  return "unknown";
}
