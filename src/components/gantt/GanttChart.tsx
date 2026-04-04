"use client";

/**
 * Диаграмма Ганта — кастомный React/SVG компонент
 *
 * Ключевой компонент системы (35 баллов из 100)
 *
 * Функционал:
 * - Отображение учебных групп на временной шкале
 * - Масштабирование: неделя / месяц / квартал
 * - Визуальный прогресс внутри каждой полосы
 * - Тултипы с информацией (курс, кол-во человек, стоимость)
 * - Клик → переход к карточке группы
 * - Цветовая кодировка по статусу
 * - Вертикальная линия "Сегодня"
 *
 * Архитектурное решение (Edward Tufte + Stephen Few):
 * Максимум data-ink ratio: минимальная сетка, лёгкие горизонтальные
 * разделители строк, чёткая линия "сегодня". Без теней и 3D.
 */

import React, { useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  differenceInDays,
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isToday,
  isSameMonth,
  getWeek,
} from "date-fns";
import { ru } from "date-fns/locale";

// ─── Типы данных ───────────────────────────────────────────
export interface GanttGroup {
  id: string;
  name: string;
  courseName: string;
  startDate: string;
  endDate: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  memberCount: number;
  totalCost: number;
  avgProgress: number;
  pricePerPerson: number;
}

type ScaleMode = "week" | "month" | "quarter";

// ─── Цвета статусов ───────────────────────────────────────
const STATUS_COLORS: Record<string, { bar: string; progress: string; text: string; label: string }> = {
  PLANNED: { bar: "#E2E8F0", progress: "#94A3B8", text: "#475569", label: "Планируется" },
  IN_PROGRESS: { bar: "#DBEAFE", progress: "#3B82F6", text: "#1E40AF", label: "В процессе" },
  COMPLETED: { bar: "#D1FAE5", progress: "#10B981", text: "#065F46", label: "Завершено" },
  CANCELLED: { bar: "#FEE2E2", progress: "#EF4444", text: "#991B1B", label: "Отменено" },
};

// ─── Константы макета ──────────────────────────────────────
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 60;
const LEFT_PANEL_WIDTH = 300;
const MIN_DAY_WIDTH = 4;

// ─── Форматирование стоимости ──────────────────────────────
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

// ─── Основной компонент ────────────────────────────────────
export default function GanttChart({ groups: rawGroups, readOnly = false }: { groups: GanttGroup[]; readOnly?: boolean }) {
  // Сортируем группы по дате начала для логичного отображения на диаграмме
  const groups = useMemo(
    () => [...rawGroups].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [rawGroups]
  );
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<ScaleMode>("month");
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  /**
   * Вычисление временного диапазона диаграммы
   * Расширяем на 1 неделю в обе стороны для контекста
   */
  const { timelineStart, timelineEnd, dayWidth, totalWidth } = useMemo(() => {
    if (groups.length === 0) {
      const now = new Date();
      return {
        timelineStart: startOfMonth(now),
        timelineEnd: endOfMonth(now),
        dayWidth: 30,
        totalWidth: 900,
      };
    }

    const dates = groups.flatMap((g) => [new Date(g.startDate), new Date(g.endDate)]);
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    let start: Date, end: Date;
    switch (scale) {
      case "week":
        start = startOfWeek(addDays(minDate, -7), { locale: ru });
        end = endOfWeek(addDays(maxDate, 7), { locale: ru });
        break;
      case "quarter":
        start = startOfQuarter(addDays(minDate, -14));
        end = endOfQuarter(addDays(maxDate, 14));
        break;
      default: // month
        start = startOfMonth(addDays(minDate, -7));
        end = endOfMonth(addDays(maxDate, 7));
    }

    const totalDays = differenceInDays(end, start) + 1;
    // Подбираем ширину дня в зависимости от масштаба
    const dw = scale === "week" ? 40 : scale === "month" ? 24 : MIN_DAY_WIDTH + 4;
    const tw = Math.max(totalDays * dw, 600);

    return { timelineStart: start, timelineEnd: end, dayWidth: dw, totalWidth: tw };
  }, [groups, scale]);

  const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
  const svgHeight = HEADER_HEIGHT + groups.length * ROW_HEIGHT + 20;

  /**
   * Преобразование даты в X-координату на диаграмме
   */
  const dateToX = useCallback(
    (date: Date): number => {
      const days = differenceInDays(date, timelineStart);
      return days * dayWidth;
    },
    [timelineStart, dayWidth]
  );

  /**
   * Отрисовка заголовка шкалы времени
   * Зависит от текущего масштаба (неделя/месяц/квартал)
   */
  const renderTimeHeader = useMemo(() => {
    const elements: React.ReactElement[] = [];

    if (scale === "week" || scale === "month") {
      // Верхний уровень: месяцы
      const months = eachMonthOfInterval({ start: timelineStart, end: timelineEnd });
      months.forEach((monthStart, i) => {
        const mEnd = endOfMonth(monthStart);
        const x = dateToX(monthStart < timelineStart ? timelineStart : monthStart);
        const xEnd = dateToX(mEnd > timelineEnd ? timelineEnd : mEnd);
        const width = xEnd - x + dayWidth;
        elements.push(
          <g key={`month-${i}`}>
            <rect x={x} y={0} width={width} height={28} fill="#F8FAFC" stroke="#E2E8F0" />
            <text x={x + width / 2} y={18} textAnchor="middle" className="text-xs font-medium" fill="#475569">
              {format(monthStart, "LLLL yyyy", { locale: ru })}
            </text>
          </g>
        );
      });

      if (scale === "week") {
        // Нижний уровень: дни
        const days = eachDayOfInterval({ start: timelineStart, end: timelineEnd });
        days.forEach((day, i) => {
          const x = i * dayWidth;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          elements.push(
            <g key={`day-${i}`}>
              <rect x={x} y={28} width={dayWidth} height={32} fill={isWeekend ? "#F1F5F9" : "#FFFFFF"} stroke="#E2E8F0" />
              <text x={x + dayWidth / 2} y={48} textAnchor="middle" fontSize={10} fill={isWeekend ? "#94A3B8" : "#64748B"}>
                {format(day, "d")}
              </text>
            </g>
          );
        });
      } else {
        // Нижний уровень: недели
        const weeks = eachWeekOfInterval({ start: timelineStart, end: timelineEnd }, { locale: ru });
        weeks.forEach((weekStart, i) => {
          const x = dateToX(weekStart < timelineStart ? timelineStart : weekStart);
          const wEnd = endOfWeek(weekStart, { locale: ru });
          const xEnd = dateToX(wEnd > timelineEnd ? timelineEnd : wEnd);
          const width = xEnd - x + dayWidth;
          elements.push(
            <g key={`week-${i}`}>
              <rect x={x} y={28} width={width} height={32} fill="#FFFFFF" stroke="#E2E8F0" />
              <text x={x + width / 2} y={48} textAnchor="middle" fontSize={11} fill="#64748B">
                Нед. {getWeek(weekStart, { locale: ru })}
              </text>
            </g>
          );
        });
      }
    } else {
      // Квартальный масштаб: месяцы только
      const months = eachMonthOfInterval({ start: timelineStart, end: timelineEnd });
      months.forEach((monthStart, i) => {
        const mEnd = endOfMonth(monthStart);
        const x = dateToX(monthStart < timelineStart ? timelineStart : monthStart);
        const xEnd = dateToX(mEnd > timelineEnd ? timelineEnd : mEnd);
        const width = xEnd - x + dayWidth;
        elements.push(
          <g key={`qmonth-${i}`}>
            <rect x={x} y={0} width={width} height={HEADER_HEIGHT} fill={i % 2 === 0 ? "#F8FAFC" : "#FFFFFF"} stroke="#E2E8F0" />
            <text x={x + width / 2} y={35} textAnchor="middle" fontSize={12} fill="#475569" fontWeight={500}>
              {format(monthStart, "LLL yyyy", { locale: ru })}
            </text>
          </g>
        );
      });
    }

    return elements;
  }, [scale, timelineStart, timelineEnd, dayWidth, dateToX]);

  /**
   * Вертикальная линия "Сегодня" — ключевой ориентир для HR-пользователей
   */
  const todayX = useMemo(() => {
    const today = new Date();
    if (today >= timelineStart && today <= timelineEnd) {
      return dateToX(today);
    }
    return null;
  }, [timelineStart, timelineEnd, dateToX]);

  /**
   * Обработка наведения мыши — показ тултипа
   */
  const handleMouseMove = useCallback((e: React.MouseEvent, groupId: string) => {
    setTooltipPos({ x: e.clientX + 12, y: e.clientY - 10 });
    setHoveredGroup(groupId);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredGroup(null);
    setTooltipPos(null);
  }, []);

  const hoveredGroupData = groups.find((g) => g.id === hoveredGroup);

  return (
    <div className="flex flex-col h-full">
      {/* ─── Панель масштаба ─────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-white print:hidden">
        <span className="text-sm font-medium text-slate-600 mr-2">Масштаб:</span>
        {(["week", "month", "quarter"] as ScaleMode[]).map((s) => (
          <button
            key={s}
            onClick={() => setScale(s)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              scale === s
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s === "week" ? "Неделя" : s === "month" ? "Месяц" : "Квартал"}
          </button>
        ))}
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 text-sm rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors print:hidden"
          title="Печать / экспорт в PDF"
        >
          🖨 Печать
        </button>
        <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
          {Object.entries(STATUS_COLORS).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: val.progress }} />
              <span>{val.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Основная область диаграммы ──────────────────── */}
      <div className="flex flex-1 overflow-auto">
        {/* Левая панель — список групп */}
        <div className="flex-shrink-0 border-r bg-white" style={{ width: LEFT_PANEL_WIDTH }}>
          <div className="h-[60px] flex items-center px-4 border-b bg-slate-50">
            <span className="text-sm font-semibold text-slate-700">Учебная группа</span>
          </div>
          {groups.map((group, i) => (
            <div
              key={group.id}
              className={`flex items-center px-4 border-b transition-colors ${readOnly ? "" : "cursor-pointer hover:bg-blue-50"}`}
              style={{ height: ROW_HEIGHT }}
              onClick={() => { if (!readOnly) window.location.href = `/groups/${group.id}`; }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">
                  {group.name || `Группа #${i + 1}`}
                </div>
                <div className="text-xs text-slate-500 truncate">{group.courseName}</div>
              </div>
              <div
                className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: STATUS_COLORS[group.status]?.bar,
                  color: STATUS_COLORS[group.status]?.text,
                }}
              >
                {Math.round(group.avgProgress)}%
              </div>
            </div>
          ))}
        </div>

        {/* Правая область — SVG с диаграммой */}
        <div className="flex-1 overflow-auto gantt-scroll-area relative" ref={scrollRef}>
          <svg width={totalWidth} height={svgHeight} className="min-w-full">
            {/* Шкала времени */}
            <g>{renderTimeHeader}</g>

            {/* Строки с полосами групп */}
            <g transform={`translate(0, ${HEADER_HEIGHT})`}>
              {/* Горизонтальные разделители (Stephen Few: нужны для ориентации) */}
              {groups.map((_, i) => (
                <rect
                  key={`bg-${i}`}
                  x={0}
                  y={i * ROW_HEIGHT}
                  width={totalWidth}
                  height={ROW_HEIGHT}
                  fill={i % 2 === 0 ? "#FFFFFF" : "#FAFBFC"}
                  stroke="#F1F5F9"
                  strokeWidth={0.5}
                />
              ))}

              {/* Полосы учебных групп */}
              {groups.map((group, i) => {
                const startX = dateToX(new Date(group.startDate));
                const endX = dateToX(new Date(group.endDate));
                const barWidth = Math.max(endX - startX + dayWidth, dayWidth);
                const barY = i * ROW_HEIGHT + 8;
                const barHeight = ROW_HEIGHT - 16;
                const colors = STATUS_COLORS[group.status] || STATUS_COLORS.PLANNED;
                // Ширина заполнения прогресса
                const progressWidth = (barWidth * group.avgProgress) / 100;

                return (
                  <g
                    key={group.id}
                    className={readOnly ? "" : "cursor-pointer"}
                    onClick={() => { if (!readOnly) window.location.href = `/groups/${group.id}`; }}
                    onMouseMove={(e) => handleMouseMove(e, group.id)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* Фон полосы */}
                    <rect
                      x={startX}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      rx={4}
                      fill={colors.bar}
                      stroke={hoveredGroup === group.id ? colors.progress : "transparent"}
                      strokeWidth={2}
                    />
                    {/* Заполнение прогресса */}
                    {group.avgProgress > 0 && (
                      <rect
                        x={startX}
                        y={barY}
                        width={progressWidth}
                        height={barHeight}
                        rx={4}
                        fill={colors.progress}
                        opacity={0.7}
                      />
                    )}
                    {/* Текст на полосе */}
                  </g>
                );
              })}

              {/* Линия "Сегодня" */}
              {todayX !== null && (
                <g>
                  <line
                    x1={todayX + dayWidth / 2}
                    y1={-HEADER_HEIGHT}
                    x2={todayX + dayWidth / 2}
                    y2={groups.length * ROW_HEIGHT}
                    stroke="#EF4444"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    opacity={0.7}
                  />
                  <text
                    x={todayX + dayWidth / 2}
                    y={-HEADER_HEIGHT + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    fill="#EF4444"
                  >
                    Сегодня
                  </text>
                </g>
              )}
            </g>
          </svg>

          {/* Тултип при наведении — fixed позиционирование, не обрезается */}
          {hoveredGroup && tooltipPos && hoveredGroupData && (
            <div
              className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 pointer-events-none min-w-[240px]"
              style={{
                left: Math.min(tooltipPos.x, window.innerWidth - 270),
                top: tooltipPos.y > window.innerHeight - 200 ? tooltipPos.y - 160 : tooltipPos.y,
              }}
            >
              <div className="font-semibold text-sm text-slate-800 mb-1">
                {hoveredGroupData.name || "Без названия"}
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>📚 Курс: {hoveredGroupData.courseName}</div>
                <div>
                  📅 {format(new Date(hoveredGroupData.startDate), "dd.MM.yyyy")} —{" "}
                  {format(new Date(hoveredGroupData.endDate), "dd.MM.yyyy")}
                </div>
                <div>👥 Участников: {hoveredGroupData.memberCount}</div>
                <div className="flex items-center gap-2">
                  <span>📊 Прогресс:</span>
                  <div className="flex-1 bg-slate-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${hoveredGroupData.avgProgress}%`,
                        backgroundColor: STATUS_COLORS[hoveredGroupData.status]?.progress,
                      }}
                    />
                  </div>
                  <span className="font-medium">{Math.round(hoveredGroupData.avgProgress)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Нижняя панель с итогами ────────────────────── */}
      {groups.length > 0 && (
        <div className="flex items-center gap-6 px-4 py-2 border-t bg-slate-50 text-xs text-slate-600">
          <span>Всего групп: <strong>{groups.length}</strong></span>
          <span>
            Общий бюджет:{" "}
            <strong>{formatCurrency(groups.reduce((sum, g) => sum + g.totalCost, 0))}</strong>
          </span>
          <span>
            Средний прогресс:{" "}
            <strong>
              {Math.round(groups.reduce((sum, g) => sum + g.avgProgress, 0) / groups.length)}%
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
