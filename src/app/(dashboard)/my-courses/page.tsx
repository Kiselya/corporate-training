"use client";

/**
 * Страница "Мои курсы" — только просмотр для обычного пользователя
 * Прогресс выставляется преподавателем/админом, пользователь видит только результат
 */

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  Building2,
  Users,
  Calendar,
  TrendingUp,
  Loader2,
  Clock,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { pluralizeDays } from "@/lib/types";

interface MyProfileData {
  employee: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    email: string | null;
    companyId: string | null;
  } | null;
  groups: {
    id: string;
    name: string | null;
    startDate: string;
    endDate: string;
    status: string;
    pricePerPerson: number;
    course: { id: string; name: string; durationDays: number };
    memberCount: number;
    avgProgress: number;
    myProgress: number;
    myMemberId: string;
  }[];
  companies: { id: string; name: string; code: string }[];
  message?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PLANNED: { label: "Планируется", className: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "В процессе", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Завершено", className: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Отменено", className: "bg-red-100 text-red-700" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export default function MyCoursesPage() {
  const { user } = useAuth();
  const [data, setData] = useState<MyProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Фильтры — ВСЕ hooks до условных return (правила React)
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"date" | "progress" | "name" | "priority">("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetch("/api/auth/my-profile")
      .then((res) => {
        if (!res.ok) throw new Error("Ошибка загрузки профиля");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const allGroups = data?.groups || [];

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allGroups.length };
    for (const g of allGroups) {
      counts[g.status] = (counts[g.status] || 0) + 1;
    }
    return counts;
  }, [allGroups]);

  const groups = useMemo(() => {
    let result = [...allGroups];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (g) =>
          g.course.name.toLowerCase().includes(q) ||
          (g.name || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((g) => g.status === statusFilter);
    }

    // Приоритет статусов: активные → запланированные → завершённые → отменённые
    const STATUS_PRIORITY: Record<string, number> = {
      IN_PROGRESS: 0,
      PLANNED: 1,
      COMPLETED: 2,
      CANCELLED: 3,
    };

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "priority":
          cmp = (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9);
          if (cmp === 0) cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case "date":
          cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case "progress":
          cmp = a.myProgress - b.myProgress;
          break;
        case "name":
          cmp = a.course.name.localeCompare(b.course.name, "ru");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [allGroups, searchQuery, statusFilter, sortField, sortDir]);

  function toggleSort(field: "date" | "progress" | "name" | "priority") {
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
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Мои курсы
        </h1>
        {data?.employee && (
          <div className="mt-2 flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {data.employee.fullName}
            </span>
            {data.companies.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {data.companies[0].name}
              </span>
            )}
          </div>
        )}
      </div>

      {!data?.employee && (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">
              {data?.message || "Профиль не привязан к участнику обучения"}
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Обратитесь к администратору для привязки вашего аккаунта
            </p>
          </CardContent>
        </Card>
      )}

      {data?.employee && allGroups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">Вы пока не записаны ни на один курс</p>
          </CardContent>
        </Card>
      )}

      {allGroups.length > 0 && (
        <>
          {/* Фильтры */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию курса..."
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: "all", label: "Все" },
                { key: "IN_PROGRESS", label: "В процессе" },
                { key: "PLANNED", label: "Планируется" },
                { key: "COMPLETED", label: "Завершено" },
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
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === key ? "bg-white/20" : "bg-slate-200"}`}>
                      {statusCounts[key]}
                    </span>
                  )}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {([
                  { field: "priority" as const, label: "Приоритет" },
                  { field: "date" as const, label: "Дата" },
                  { field: "progress" as const, label: "Прогресс" },
                  { field: "name" as const, label: "Название" },
                ]).map(({ field, label }) => (
                  <button
                    key={field}
                    onClick={() => toggleSort(field)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      sortField === field ? "bg-slate-200 text-slate-800 font-medium" : "hover:bg-slate-100 text-slate-500"
                    }`}
                  >
                    {label}{sortField === field && (sortDir === "asc" ? " ↑" : " ↓")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Результаты */}
          {groups.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                Ничего не найдено. Попробуйте изменить фильтры.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.id} className="overflow-hidden">
              <div className="flex">
                {/* Цветная полоска по статусу */}
                <div
                  className="w-1.5 shrink-0"
                  style={{
                    backgroundColor:
                      group.status === "COMPLETED" ? "#10B981" :
                      group.status === "IN_PROGRESS" ? "#3B82F6" :
                      group.status === "CANCELLED" ? "#EF4444" : "#94A3B8",
                  }}
                />
                <div className="flex-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{group.course.name}</CardTitle>
                        {group.name && <p className="text-sm text-slate-500">{group.name}</p>}
                      </div>
                      <Badge className={STATUS_CONFIG[group.status]?.className}>
                        {STATUS_CONFIG[group.status]?.label || group.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Информация */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(group.startDate)} — {formatDate(group.endDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {pluralizeDays(group.course.durationDays)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {group.memberCount} чел.
                      </span>
                    </div>

                    {/* Мой прогресс — только просмотр */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Мой прогресс</span>
                        <span className="text-xl font-bold text-blue-600">{group.myProgress}%</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${group.myProgress}%`,
                            backgroundColor: group.myProgress === 100 ? "#10B981" : "#3B82F6",
                          }}
                        />
                      </div>
                      {group.myProgress === 100 && (
                        <p className="text-xs text-green-600 font-medium">Курс завершён!</p>
                      )}
                    </div>

                    {/* Средний по группе */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Средний прогресс группы
                        </span>
                        <span className="text-slate-600">{group.avgProgress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-slate-400 transition-all"
                          style={{ width: `${group.avgProgress}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-400">
                        {group.myProgress > group.avgProgress
                          ? "Вы опережаете группу"
                          : group.myProgress < group.avgProgress
                            ? "Группа впереди — не отставайте!"
                            : "Вы наравне с группой"}
                      </div>
                    </div>
                  </CardContent>
                </div>
              </div>
            </Card>
          ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
