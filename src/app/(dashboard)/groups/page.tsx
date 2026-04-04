"use client";

/**
 * Страница учебных групп — список с поиском, фильтрацией и сортировкой
 *
 * UX-решения (Jakob Nielsen + Steve Krug):
 * - Поиск по тексту — одно поле, ищет по названию группы и курса
 * - Фильтр по статусу — быстрые кнопки-вкладки с счётчиками
 * - Фильтр по курсу — выпадающий список
 * - Сортировка — по дате начала, стоимости, прогрессу
 * - Итоги — общее кол-во, бюджет, средний прогресс по выборке
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Plus, Users, Calendar, Search, ArrowUpDown, SlidersHorizontal, Inbox } from "lucide-react";
import { pluralizeDays } from "@/lib/types";
import { useAuth, isSuperAdmin } from "@/lib/auth-context";

function formatRubles(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; order: number }
> = {
  PLANNED: { label: "Планируется", className: "bg-slate-100 text-slate-700", order: 1 },
  IN_PROGRESS: { label: "В процессе", className: "bg-blue-100 text-blue-700", order: 0 },
  COMPLETED: { label: "Завершено", className: "bg-green-100 text-green-700", order: 2 },
  CANCELLED: { label: "Отменено", className: "bg-red-100 text-red-700", order: 3 },
};

type SortField = "date" | "cost" | "progress" | "name";
type SortDir = "asc" | "desc";

interface GroupData {
  id: string;
  name: string | null;
  startDate: string;
  endDate: string;
  status: string;
  pricePerPerson: number;
  course: {
    id: string;
    name: string;
    durationDays: number;
  };
  members: unknown[];
  memberCount: number;
  totalCost: number;
  avgProgress: number;
}

export default function GroupsPage() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const showFinancials = isSuperAdmin(authUser?.role);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);

  // Фильтры
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/groups");
      if (res.ok) setGroups(await res.json());
    } catch (error) {
      console.error("Ошибка загрузки групп:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Уникальные курсы для фильтра
  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) {
      map.set(g.course.id, g.course.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [groups]);

  // Счётчики по статусам (для вкладок)
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: groups.length };
    for (const g of groups) {
      counts[g.status] = (counts[g.status] || 0) + 1;
    }
    return counts;
  }, [groups]);

  // Фильтрация + сортировка
  const filteredGroups = useMemo(() => {
    let result = [...groups];

    // Поиск по тексту
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (g) =>
          (g.name || "").toLowerCase().includes(q) ||
          g.course.name.toLowerCase().includes(q)
      );
    }

    // Фильтр по статусу
    if (statusFilter !== "all") {
      result = result.filter((g) => g.status === statusFilter);
    }

    // Фильтр по курсу
    if (courseFilter !== "all") {
      result = result.filter((g) => g.course.id === courseFilter);
    }

    // Сортировка
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case "cost":
          cmp = a.totalCost - b.totalCost;
          break;
        case "progress":
          cmp = a.avgProgress - b.avgProgress;
          break;
        case "name":
          cmp = (a.name || a.course.name).localeCompare(b.name || b.course.name, "ru");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [groups, searchQuery, statusFilter, courseFilter, sortField, sortDir]);

  // Итоги по отфильтрованной выборке
  const summary = useMemo(() => {
    const totalBudget = filteredGroups.reduce((sum, g) => sum + g.totalCost, 0);
    const avgProgress =
      filteredGroups.length > 0
        ? Math.round(filteredGroups.reduce((sum, g) => sum + g.avgProgress, 0) / filteredGroups.length)
        : 0;
    const totalMembers = filteredGroups.reduce((sum, g) => sum + g.memberCount, 0);
    return { totalBudget, avgProgress, totalMembers };
  }, [filteredGroups]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Учебные группы
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {groups.length > 0 ? `Всего ${groups.length} групп` : "Управление учебными группами"}
          </p>
        </div>
        <Button onClick={() => window.location.href = "/groups/new"}>
          <Plus className="mr-1.5 h-4 w-4" />
          Создать группу
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-slate-500">Учебные группы не найдены</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/groups/new"}>
              <Plus className="mr-1.5 h-4 w-4" /> Создать первую группу
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Панель фильтров */}
          <div className="space-y-3">
            {/* Строка поиска + фильтр по курсу */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по названию группы или курса..."
                  className="pl-9"
                />
              </div>
              <select
                className="h-10 px-3 border rounded-md text-sm bg-white min-w-[200px]"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
              >
                <option value="all">Все курсы</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Вкладки статусов */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: "all", label: "Все" },
                { key: "IN_PROGRESS", label: "В процессе" },
                { key: "PLANNED", label: "Планируется" },
                { key: "COMPLETED", label: "Завершено" },
                { key: "CANCELLED", label: "Отменено" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    statusFilter === key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label}
                  {(statusCounts[key] ?? 0) > 0 && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        statusFilter === key ? "bg-white/20" : "bg-slate-200"
                      }`}
                    >
                      {statusCounts[key]}
                    </span>
                  )}
                </button>
              ))}

              {/* Сортировка */}
              <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Сортировка:</span>
                {([
                  { field: "date" as SortField, label: "Дата" },
                  ...(showFinancials ? [{ field: "cost" as SortField, label: "Стоимость" }] : []),
                  { field: "progress" as SortField, label: "Прогресс" },
                  { field: "name" as SortField, label: "Название" },
                ]).map(({ field, label }) => (
                  <button
                    key={field}
                    onClick={() => toggleSort(field)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      sortField === field
                        ? "bg-slate-200 text-slate-800 font-medium"
                        : "hover:bg-slate-100 text-slate-500"
                    }`}
                  >
                    {label}
                    {sortField === field && (
                      <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Итоги по выборке */}
          {filteredGroups.length > 0 && (
            <div className="flex items-center gap-6 px-4 py-2.5 bg-slate-50 rounded-lg text-sm text-slate-600">
              <span>
                Найдено: <strong>{filteredGroups.length}</strong> из {groups.length}
              </span>
              <span>
                Участников: <strong>{summary.totalMembers}</strong>
              </span>
              {showFinancials && <span>
                Бюджет: <strong>{formatRubles(summary.totalBudget)}</strong>
              </span>}
              <span>
                Ср. прогресс: <strong>{summary.avgProgress}%</strong>
              </span>
            </div>
          )}

          {/* Карточки групп */}
          {filteredGroups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                  <Search className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-lg font-medium text-slate-700">Ничего не найдено</p>
                <p className="mt-1 text-sm text-slate-500 max-w-sm text-center">
                  По вашему запросу не найдено учебных групп. Попробуйте изменить параметры поиска или сбросить фильтры.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => { setSearchQuery(""); setStatusFilter("all"); setCourseFilter("all"); }}
                >
                  Сбросить фильтры
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 animate-stagger">
              {filteredGroups.map((group) => {
                const statusCfg = STATUS_CONFIG[group.status] || STATUS_CONFIG.PLANNED;
                return (
                  <Card
                    key={group.id}
                    className="cursor-pointer card-hover"
                    onClick={() => window.location.href = `/groups/${group.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="leading-snug text-base">
                          {group.name || group.course.name}
                        </CardTitle>
                        <Badge className={statusCfg.className + " shrink-0"}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <CardDescription>{group.course.name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              {formatDate(group.startDate)} — {formatDate(group.endDate)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Users className="h-3.5 w-3.5" />
                            <span>{group.memberCount} участн.</span>
                          </div>
                          {showFinancials && <span className="font-semibold text-green-700">
                            {formatRubles(group.totalCost)}
                          </span>}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Прогресс</span>
                            <span className="font-medium">{group.avgProgress}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${group.avgProgress}%`,
                                backgroundColor:
                                  group.avgProgress === 100
                                    ? "#10B981"
                                    : group.avgProgress > 0
                                      ? "#3B82F6"
                                      : "#CBD5E1",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
