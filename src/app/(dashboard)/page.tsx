"use client";

/**
 * Панель управления — 3 вкладки: Финансовый, Аналитический, Управленческий
 * Для USER — персональный дашборд с курсами
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  TrendingUp,
  ArrowRight,
  Banknote,
  Users,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  PieChart as PieChartIcon,
  BookOpen,
  Building2,
  Calendar,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useAuth, isAdminOrAbove, isSuperAdmin } from "@/lib/auth-context";

// ─── Types ───────────────────────────────────────────────────

interface UpcomingTraining {
  id: string;
  name: string | null;
  courseName: string;
  startDate: string;
  endDate: string;
  status: string;
  memberCount: number;
  totalCost: number;
}

interface DashboardData {
  summary: {
    totalGroups: number;
    totalEmployees: number;
    totalCourses: number;
    totalSpecifications: number;
    totalBudget: number;
  };
  financial: {
    revenueByMonth: { month: string; revenue: number }[];
    revenueByMonthByCompany: Record<string, unknown>[];
    companyNames: Record<string, string>;
    revenueByCourse: {
      name: string;
      revenue: number;
      groups: number;
      participants: number;
    }[];
    avgCostPerEmployee: number;
    topExpensiveGroups: {
      name: string;
      courseName: string;
      totalCost: number;
      memberCount: number;
    }[];
  };
  analytical: {
    coursePopularity: {
      name: string;
      groupCount: number;
      totalParticipants: number;
      avgProgress: number;
    }[];
    completionRate: number;
    avgGroupSize: number;
    progressByCourse: {
      name: string;
      avgProgress: number;
      completedCount: number;
      totalCount: number;
    }[];
  };
  operational: {
    groupsByStatus: Record<string, number>;
    upcomingTrainings: UpcomingTraining[];
    conflictsCount: number;
    statuses: { name: string; value: number; color: string }[];
    companiesDistribution: { name: string; value: number }[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────

function formatRubles(value: number): string {
  return (
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(
      value,
    ) + " \u20BD"
  );
}

function formatRublesShort(value: number): string {
  if (value >= 1_000_000) return Math.round(value / 1_000_000) + " млн";
  if (value >= 1_000) return Math.round(value / 1_000) + " тыс";
  return String(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PLANNED: { label: "Планируется", className: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: {
    label: "В процессе",
    className: "bg-blue-100 text-blue-700",
  },
  COMPLETED: {
    label: "Завершено",
    className: "bg-green-100 text-green-700",
  },
  CANCELLED: { label: "Отменено", className: "bg-red-100 text-red-700" },
};

const PIE_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];

// Уникальные цвета для компаний (без дублей)
const COMPANY_COLORS = [
  "#3B82F6", // синий
  "#EF4444", // красный
  "#10B981", // зелёный
  "#F59E0B", // жёлтый
  "#8B5CF6", // фиолетовый
  "#EC4899", // розовый
  "#14B8A6", // бирюзовый
  "#F97316", // оранжевый
  "#6366F1", // индиго
  "#84CC16", // лайм
];

type Period = "month" | "quarter" | "year" | "all";

function filterByPeriod(
  data: { month: string; revenue: number }[],
  period: Period,
): { month: string; revenue: number }[] {
  if (period === "all" || data.length === 0) return data;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return data.filter((item) => {
    // Parse "Апр 2026" format back to date
    const MONTH_MAP: Record<string, number> = {
      "Янв": 0, "Фев": 1, "Мар": 2, "Апр": 3, "Май": 4, "Июн": 5,
      "Июл": 6, "Авг": 7, "Сен": 8, "Окт": 9, "Ноя": 10, "Дек": 11,
    };
    const parts = item.month.split(" ");
    const monthIdx = MONTH_MAP[parts[0]] ?? 0;
    const year = parseInt(parts[1], 10);

    if (period === "month") {
      return year === currentYear && monthIdx === currentMonth;
    }
    if (period === "quarter") {
      const currentQ = Math.floor(currentMonth / 3);
      const itemQ = Math.floor(monthIdx / 3);
      return year === currentYear && itemQ === currentQ;
    }
    if (period === "year") {
      return year === currentYear;
    }
    return true;
  });
}

// ─── KPI Card ────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  borderColor,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  borderColor?: string;
}) {
  return (
    <Card
      className="card-hover"
      style={borderColor ? { borderTop: `3px solid ${borderColor}` } : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">
          {title}
        </CardTitle>
        <Icon className={`h-5 w-5 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── User Dashboard (для роли USER) ─────────────────────────

interface UserProfileData {
  employee: {
    id: string;
    fullName: string;
    email: string | null;
    companyId: string | null;
  } | null;
  groups: {
    id: string;
    name: string | null;
    startDate: string;
    endDate: string;
    status: string;
    course: { id: string; name: string; durationDays: number };
    memberCount: number;
    avgProgress: number;
    myProgress: number;
    myMemberId: string;
  }[];
  companies: { id: string; name: string; code: string }[];
  message?: string;
}

function UserDashboard({ userName }: { userName: string }) {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/my-profile")
      .then((res) => res.json())
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, []);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Расчёт статистики по курсам пользователя
  const groups = profile?.groups || [];
  const totalCourses = groups.length;
  const completedCourses = groups.filter((g) => g.status === "COMPLETED").length;
  const inProgressCourses = groups.filter((g) => g.status === "IN_PROGRESS").length;
  const avgMyProgress =
    groups.length > 0
      ? Math.round(groups.reduce((sum, g) => sum + (g.myProgress || 0), 0) / groups.length)
      : 0;

  return (
    <div className="space-y-6">
      {/* Приветствие */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Добро пожаловать, {userName}!
        </h1>
        {profile?.employee && profile.companies.length > 0 ? (
          <p className="mt-1 text-sm text-slate-500">
            {profile.employee.fullName} · {profile.companies[0].name}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">Ваш личный кабинет обучения</p>
        )}
      </div>

      {/* Профиль не привязан */}
      {!profile?.employee && (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-400 mb-3" />
            <p className="text-slate-700 font-medium">
              Ваш профиль ещё не привязан к участнику обучения
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Обратитесь к администратору для привязки вашего аккаунта
            </p>
          </CardContent>
        </Card>
      )}

      {/* Профиль привязан — полноценный персональный дашборд */}
      {profile?.employee && (
        <>
          {/* KPI карточки */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Мой прогресс</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{avgMyProgress}%</div>
                <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${avgMyProgress}%` }} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Всего курсов</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{totalCourses}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">В процессе</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">{inProgressCourses}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Завершено</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{completedCourses}</div>
              </CardContent>
            </Card>
          </div>

          {/* Ближайшее обучение */}
          {groups.filter((g) => g.status === "PLANNED" || g.status === "IN_PROGRESS").length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ближайшее обучение</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groups
                  .filter((g) => g.status === "PLANNED" || g.status === "IN_PROGRESS")
                  .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                  .slice(0, 3)
                  .map((g) => (
                    <div key={g.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                      <div>
                        <p className="font-medium text-sm text-slate-800">{g.course?.name || g.name}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(g.startDate).toLocaleDateString("ru-RU")} — {new Date(g.endDate).toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={g.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}>
                          {g.status === "IN_PROGRESS" ? "В процессе" : "Планируется"}
                        </Badge>
                        <p className="text-xs text-slate-500 mt-1">{g.myProgress || 0}%</p>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* Быстрые ссылки */}
          {groups.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = "/my-courses"}>
                <CardContent className="py-5 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">Мои курсы</p>
                    <p className="text-xs text-slate-500">Прогресс и детали</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400" />
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = "/my-groups"}>
                <CardContent className="py-5 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">Мои группы</p>
                    <p className="text-xs text-slate-500">Участники и прогресс</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400" />
                </CardContent>
              </Card>
            </div>
          )}

          {groups.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                Вы пока не записаны ни на один курс
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("all");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [companySearch, setCompanySearch] = useState("");
  const [showConflicts, setShowConflicts] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<{ description: string }[]>([]);

  useEffect(() => {
    if (showConflicts && conflictDetails.length === 0) {
      fetch("/api/conflicts")
        .then((r) => r.json())
        .then((d) => setConflictDetails(d.conflicts || []))
        .catch(console.error);
    }
  }, [showConflicts]);

  const toggleCompany = (id: string) => {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isAdmin = isAdminOrAbove(authUser?.role);

  useEffect(() => {
    if (authUser && !isAdminOrAbove(authUser.role)) {
      setLoading(false);
      return;
    }
    const query = selectedCompanyIds.size > 0 ? `?companyIds=${[...selectedCompanyIds].join(",")}` : "";
    Promise.all([
      fetch(`/api/dashboard${query}`).then((res) => {
        if (!res.ok) throw new Error("Ошибка загрузки");
        return res.json();
      }),
      companies.length === 0 ? fetch("/api/companies").then((r) => r.json()) : Promise.resolve(null),
    ])
      .then(([dashData, compsData]) => {
        setData(dashData);
        if (compsData) setCompanies(compsData.map((c: any) => ({ id: c.id, name: c.name })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authUser, selectedCompanyIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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

  // Для пользователей (роль USER) — показываем персональный дашборд
  if (authUser && !isAdmin) {
    return <UserDashboard userName={authUser.name || "Пользователь"} />;
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red-500">Не удалось загрузить данные</p>
      </div>
    );
  }

  const filteredRevenue = filterByPeriod(data.financial.revenueByMonth, period);

  // Фильтруем stacked data по тем же месяцам
  const filteredMonths = new Set(filteredRevenue.map((r) => r.month));
  const filteredRevenueByCompany = data.financial.revenueByMonthByCompany.filter(
    (d) => filteredMonths.has(d.month as string)
  );
  const filteredTotal = filteredRevenue.reduce(
    (sum, r) => sum + r.revenue,
    0,
  );

  // ADMIN видит только аналитическую вкладку (финансовые и управленческие данные — только для владельца)
  if (authUser?.role === "ADMIN") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Панель управления
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Аналитика обучения вашей компании
          </p>
        </div>

        {/* Аналитический контент без табов */}
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 animate-stagger">
            <KpiCard
              title="Средний прогресс"
              value={
                data.analytical.progressByCourse.length > 0
                  ? Math.round(
                      data.analytical.progressByCourse.reduce(
                        (s, c) => s + c.avgProgress,
                        0,
                      ) / data.analytical.progressByCourse.length,
                    ) + "%"
                  : "0%"
              }
              icon={Target}
              color="text-green-600"
              borderColor="#10B981"
            />
            <KpiCard
              title="Процент завершения"
              value={data.analytical.completionRate + "%"}
              icon={CheckCircle2}
              color="text-green-600"
              borderColor="#10B981"
              subtitle={`${data.summary.totalGroups} групп всего`}
            />
            <KpiCard
              title="Средний размер группы"
              value={data.analytical.avgGroupSize + " чел."}
              icon={Users}
              color="text-green-600"
              borderColor="#10B981"
            />
          </div>

          {/* Course popularity chart */}
          {data.analytical.coursePopularity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Популярность курсов
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data.analytical.coursePopularity}
                    margin={{ left: 10, right: 20, top: 15, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#F1F5F9"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: any, name: any) => {
                        if (name === "groupCount")
                          return [String(value), "Групп"];
                        if (name === "totalParticipants")
                          return [String(value), "Участников"];
                        return [String(value), String(name)];
                      }}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                      }}
                    />
                    <Legend
                      formatter={(value: any) => {
                        if (value === "groupCount") return "Групп";
                        if (value === "totalParticipants")
                          return "Участников";
                        return String(value);
                      }}
                    />
                    <Bar
                      dataKey="groupCount"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="totalParticipants"
                      fill="#6EE7B7"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Progress by course */}
          {data.analytical.progressByCourse.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Средний прогресс по курсам
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(250, data.analytical.progressByCourse.length * 50)}>
                  <BarChart
                    data={data.analytical.progressByCourse}
                    layout="vertical"
                    margin={{ left: 10, right: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#F1F5F9"
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v: any) => `${v}%`}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={150}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        `${value}%`,
                        "Прогресс",
                      ]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                      }}
                    />
                    <Bar dataKey="avgProgress" radius={[0, 4, 4, 0]}>
                      {data.analytical.progressByCourse.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.avgProgress >= 80
                              ? "#10B981"
                              : entry.avgProgress >= 40
                                ? "#F59E0B"
                                : "#EF4444"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Панель управления
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Обзор системы корпоративного обучения
          </p>
          {/* Фильтр по компании */}
          {companies.length > 0 && (<>
            <div className="flex items-center gap-2 flex-wrap mt-2 print:hidden">
              <span className="text-xs text-slate-500">Компания:</span>
              <input
                type="text"
                placeholder="Поиск..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="h-6 px-2 text-xs border rounded-md w-36"
              />
              <button
                onClick={() => setSelectedCompanyIds(new Set())}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  selectedCompanyIds.size === 0 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Все
              </button>
              {companies
                .filter((c) => !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase()))
                .map((c, i) => {
                  const color = COMPANY_COLORS[i % COMPANY_COLORS.length];
                  const isSelected = selectedCompanyIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleCompany(c.id)}
                      className="px-2.5 py-1 text-xs rounded-full transition-colors border"
                      style={isSelected
                        ? { backgroundColor: color, color: "#fff", borderColor: color }
                        : { backgroundColor: "#f1f5f9", color: "#64748b", borderColor: "#e2e8f0" }
                      }
                    >
                      {c.name}
                    </button>
                  );
                })}
            </div>
            {/* Заголовок для печати — показывает выбранную компанию */}
            <p className="hidden print:block text-sm text-slate-600 mt-1">
              Компания: {selectedCompanyIds.size > 0 ? companies.filter((c) => selectedCompanyIds.has(c.id)).map((c) => c.name).join(", ") : "Все компании"}
            </p>
          </>)}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/api/reports?format=csv", "_blank")}
          >
            <TrendingUp className="mr-1.5 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Banknote className="mr-1.5 h-4 w-4" />
            Сохранить PDF
          </Button>
        </div>
      </div>

      {/* Tabs — SUPER_ADMIN видит все 3 вкладки */}
      <Tabs defaultValue="financial">
        <TabsList>
          <TabsTrigger value="financial">
            <Banknote className="mr-1.5 h-4 w-4" />
            Финансовый
          </TabsTrigger>
          <TabsTrigger value="analytical">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            Аналитический
          </TabsTrigger>
          <TabsTrigger value="operational">
            <PieChartIcon className="mr-1.5 h-4 w-4" />
            Управленческий
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 1: Финансовый                                      */}
        {/* ═══════════════════════════════════════════════════════ */}
        <TabsContent value="financial" className="space-y-6 mt-4">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 mr-1">Период:</span>
            {(
              [
                { key: "month", label: "Месяц" },
                { key: "quarter", label: "Квартал" },
                { key: "year", label: "Год" },
                { key: "all", label: "Всё время" },
              ] as const
            ).map((p) => (
              <Button
                key={p.key}
                variant={period === p.key ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 animate-stagger">
            <KpiCard
              title="Общий оборот"
              value={formatRubles(
                period === "all" ? data.summary.totalBudget : filteredTotal,
              )}
              icon={Banknote}
              color="text-blue-600"
              borderColor="#3B82F6"
              subtitle={
                period !== "all"
                  ? `За выбранный период`
                  : undefined
              }
            />
            <KpiCard
              title="Средняя стоимость на сотрудника"
              value={formatRubles(data.financial.avgCostPerEmployee)}
              icon={Users}
              color="text-blue-600"
              borderColor="#8B5CF6"
            />
            <KpiCard
              title="Количество спецификаций"
              value={data.summary.totalSpecifications}
              icon={Target}
              color="text-blue-600"
              borderColor="#F59E0B"
            />
          </div>

          {/* Revenue by month bar chart */}
          {filteredRevenue.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Оборот по месяцам
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  {filteredRevenueByCompany.length > 0 && Object.keys(data.financial.companyNames).length > 0 ? (
                    <BarChart
                      data={filteredRevenueByCompany}
                      margin={{ left: 10, right: 20, top: 15, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={formatRublesShort} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: any, name: any) => [formatRubles(Number(value)), name]}
                        contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0" }}
                      />
                      <Legend />
                      {(() => {
                        // Показываем только выбранные компании (или все если ничего не выбрано)
                        const selectedNames = selectedCompanyIds.size > 0
                          ? companies.filter((c) => selectedCompanyIds.has(c.id)).map((c) => c.name)
                          : Object.values(data.financial.companyNames);
                        const visibleNames = (Object.values(data.financial.companyNames) as string[]).filter((n) => selectedNames.includes(n));
                        return visibleNames.map((name, i) => (
                          <Bar
                            key={name}
                            dataKey={name}
                            stackId="revenue"
                            fill={COMPANY_COLORS[companies.findIndex((c) => c.name === name) % COMPANY_COLORS.length] || COMPANY_COLORS[i % COMPANY_COLORS.length]}
                            radius={i === visibleNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                          />
                        ));
                      })()}
                    </BarChart>
                  ) : (
                    <BarChart
                      data={filteredRevenue}
                      margin={{ left: 10, right: 20, top: 15, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={formatRublesShort} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: any) => [formatRubles(Number(value)), "Оборот"]}
                        contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0" }}
                      />
                      <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Revenue by course — horizontal bar */}
          {data.financial.revenueByCourse.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Оборот по курсам
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(250, data.financial.revenueByCourse.length * 50)}>
                  <BarChart
                    data={data.financial.revenueByCourse}
                    layout="vertical"
                    margin={{ left: 10, right: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#F1F5F9"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={formatRublesShort}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={160}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => {
                        if (name === "revenue")
                          return [formatRubles(Number(value)), "Оборот"];
                        if (name === "participants")
                          return [String(value), "Участников"];
                        return [String(value), String(name)];
                      }}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                      }}
                    />
                    <Legend
                      formatter={(value: any) => {
                        if (value === "revenue") return "Оборот";
                        if (value === "participants") return "Участников";
                        return String(value);
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#3B82F6"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar
                      dataKey="participants"
                      fill="#93C5FD"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top 5 expensive groups table */}
          {data.financial.topExpensiveGroups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Топ-5 дорогих групп
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Группа</TableHead>
                      <TableHead>Курс</TableHead>
                      <TableHead className="text-right">Стоимость</TableHead>
                      <TableHead className="text-right">Участников</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.financial.topExpensiveGroups.map((g, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {g.name}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {g.courseName.length > 35
                            ? g.courseName.slice(0, 35) + "..."
                            : g.courseName}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-blue-700">
                          {formatRubles(g.totalCost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {g.memberCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 2: Аналитический                                   */}
        {/* ═══════════════════════════════════════════════════════ */}
        <TabsContent value="analytical" className="space-y-6 mt-4">
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 animate-stagger">
            <KpiCard
              title="Средний прогресс"
              value={
                data.analytical.progressByCourse.length > 0
                  ? Math.round(
                      data.analytical.progressByCourse.reduce(
                        (s, c) => s + c.avgProgress,
                        0,
                      ) / data.analytical.progressByCourse.length,
                    ) + "%"
                  : "0%"
              }
              icon={Target}
              color="text-green-600"
              borderColor="#10B981"
            />
            <KpiCard
              title="Процент завершения"
              value={data.analytical.completionRate + "%"}
              icon={CheckCircle2}
              color="text-green-600"
              borderColor="#10B981"
              subtitle={`${data.summary.totalGroups} групп всего`}
            />
            <KpiCard
              title="Средний размер группы"
              value={data.analytical.avgGroupSize + " чел."}
              icon={Users}
              color="text-green-600"
              borderColor="#10B981"
            />
          </div>

          {/* Course popularity chart */}
          {data.analytical.coursePopularity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Популярность курсов
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data.analytical.coursePopularity}
                    margin={{ left: 10, right: 20, top: 15, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#F1F5F9"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: any, name: any) => {
                        if (name === "groupCount")
                          return [String(value), "Групп"];
                        if (name === "totalParticipants")
                          return [String(value), "Участников"];
                        return [String(value), String(name)];
                      }}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                      }}
                    />
                    <Legend
                      formatter={(value: any) => {
                        if (value === "groupCount") return "Групп";
                        if (value === "totalParticipants")
                          return "Участников";
                        return String(value);
                      }}
                    />
                    <Bar
                      dataKey="groupCount"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="totalParticipants"
                      fill="#6EE7B7"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Progress by course — horizontal bar */}
          {data.analytical.progressByCourse.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Средний прогресс по курсам
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(250, data.analytical.progressByCourse.length * 50)}>
                  <BarChart
                    data={data.analytical.progressByCourse}
                    layout="vertical"
                    margin={{ left: 10, right: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#F1F5F9"
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v: any) => `${v}%`}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={150}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        `${value}%`,
                        "Прогресс",
                      ]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                      }}
                    />
                    <Bar dataKey="avgProgress" radius={[0, 4, 4, 0]}>
                      {data.analytical.progressByCourse.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.avgProgress >= 80
                              ? "#10B981"
                              : entry.avgProgress >= 40
                                ? "#F59E0B"
                                : "#EF4444"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Note */}
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-slate-500 italic">
                Детальная аналитика по этапам курсов будет доступна при
                добавлении модульной структуры
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB 3: Управленческий                                  */}
        {/* ═══════════════════════════════════════════════════════ */}
        <TabsContent value="operational" className="space-y-6 mt-4">
          {/* Conflict alert banner */}
          {data.operational.conflictsCount > 0 && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-red-800 flex items-center justify-between">
                <span>Обнаружены конфликты в расписании ({conflictDetails.length > 0 ? conflictDetails.length : data.operational.conflictsCount})</span>
                <button
                  onClick={() => setShowConflicts(!showConflicts)}
                  className="text-xs font-normal underline hover:no-underline"
                >
                  {showConflicts ? "Скрыть" : "Подробнее"}
                </button>
              </AlertTitle>
              {showConflicts && conflictDetails.length > 0 && (
                <AlertDescription className="mt-2 space-y-1.5">
                  {conflictDetails.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <span className="shrink-0 mt-0.5">•</span>
                      <span>{c.description}</span>
                    </div>
                  ))}
                </AlertDescription>
              )}
            </Alert>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 animate-stagger">
            <KpiCard
              title="Группы в работе"
              value={data.operational.groupsByStatus.IN_PROGRESS || 0}
              icon={Clock}
              color="text-purple-600"
              borderColor="#8B5CF6"
            />
            <KpiCard
              title="Запланировано"
              value={data.operational.groupsByStatus.PLANNED || 0}
              icon={Target}
              color="text-purple-600"
              borderColor="#8B5CF6"
            />
            <KpiCard
              title="Конфликтов"
              value={data.operational.conflictsCount}
              icon={AlertTriangle}
              color={
                data.operational.conflictsCount > 0
                  ? "text-red-500"
                  : "text-purple-600"
              }
              borderColor={data.operational.conflictsCount > 0 ? "#EF4444" : "#8B5CF6"}
            />
          </div>

          {/* Pie charts row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Groups by status — donut */}
            {data.operational.statuses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Группы по статусам
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={data.operational.statuses}
                        cx="50%"
                        cy="55%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }: any) =>
                          `${name}: ${value}`
                        }
                        fontSize={11}
                      >
                        {data.operational.statuses.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #E2E8F0",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Employees by company */}
            {data.operational.companiesDistribution.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Сотрудники по компаниям
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={data.operational.companiesDistribution}
                        cx="50%"
                        cy="55%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }: any) =>
                          `${name}: ${value}`
                        }
                        fontSize={11}
                      >
                        {data.operational.companiesDistribution.map(
                          (_, i) => (
                            <Cell
                              key={i}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                            />
                          ),
                        )}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #E2E8F0",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Ближайшие обучения — компактная таблица, топ-5, без цены */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Ближайшие обучения</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = "/groups"}
                className="print-hidden"
              >
                Все группы <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {data.operational.upcomingTrainings.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  Нет запланированных обучений
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Группа</TableHead>
                      <TableHead>Курс</TableHead>
                      <TableHead>Период</TableHead>
                      <TableHead className="text-center">Участников</TableHead>
                      <TableHead>Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.operational.upcomingTrainings.slice(0, 5).map((group) => (
                      <TableRow
                        key={group.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => window.location.href = `/groups/${group.id}`}
                      >
                        <TableCell className="font-medium text-sm">
                          {group.name || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {group.courseName}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                          {formatDate(group.startDate)} — {formatDate(group.endDate)}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {group.memberCount}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_CONFIG[group.status]?.className}>
                            {STATUS_CONFIG[group.status]?.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
