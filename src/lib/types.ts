/**
 * Общие типы для корпоративного обучения
 * Используются как на клиенте, так и на сервере
 */

export type TrainingStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const STATUS_LABELS: Record<TrainingStatus, string> = {
  PLANNED: "Планируется",
  IN_PROGRESS: "В процессе",
  COMPLETED: "Завершено",
  CANCELLED: "Отменено",
};

export const STATUS_COLORS: Record<TrainingStatus, { bg: string; text: string; badge: string }> = {
  PLANNED: { bg: "bg-slate-100", text: "text-slate-700", badge: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { bg: "bg-blue-100", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
  COMPLETED: { bg: "bg-green-100", text: "text-green-700", badge: "bg-green-100 text-green-700" },
  CANCELLED: { bg: "bg-red-100", text: "text-red-700", badge: "bg-red-100 text-red-700" },
};

/**
 * Форматирование стоимости в рублях
 * Пример: 150000 → "150 000 ₽"
 */
export function formatRubles(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value) + " ₽";
}

/**
 * Расчёт стоимости обучения группы
 * Формула: цена за человека × количество участников
 *
 * Бизнес-логика:
 * - Цена берётся из прайс-листа курса на момент создания группы
 * - Пересчитывается при изменении состава участников
 * - Не зависит от статуса группы (стоимость фиксируется при создании)
 */
export function calculateGroupCost(pricePerPerson: number, memberCount: number): number {
  return pricePerPerson * memberCount;
}

/**
 * Расчёт среднего прогресса по группе
 * Формула: среднее арифметическое прогресса всех участников
 *
 * Бизнес-логика:
 * - Каждый участник имеет прогресс от 0 до 100%
 * - Общий прогресс = сумма прогрессов / количество участников
 * - Если участников нет — прогресс 0%
 */
export function calculateAvgProgress(progressValues: number[]): number {
  if (progressValues.length === 0) return 0;
  const sum = progressValues.reduce((a, b) => a + b, 0);
  return Math.round(sum / progressValues.length);
}

/**
 * Расчёт НДС и итогов по спецификации
 * НДС = 22% от суммы без НДС
 */
export function calculateSpecTotals(groupCosts: number[]) {
  const subtotal = groupCosts.reduce((a, b) => a + b, 0);
  const vat = Math.round(subtotal * 0.22);
  const total = subtotal + vat;
  return { subtotal, vat, total };
}

/**
 * Склонение слова "день" по числу
 * 1 день, 2 дня, 5 дней, 21 день, 22 дня...
 */
export function pluralizeDays(n: number): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${n} дней`;
  if (mod10 === 1) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} дня`;
  return `${n} дней`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(date)
  );
}
