"use client";

/**
 * Профиль сотрудника — просмотр всех курсов и прогресса
 * Доступ: ADMIN, SUPER_ADMIN
 */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  Mail,
  BookOpen,
  Calendar,
  Users,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { pluralizeDays } from "@/lib/types";
import { useAuth, isAdminOrAbove } from "@/lib/auth-context";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PLANNED: { label: "Планируется", className: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "В процессе", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Завершено", className: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Отменено", className: "bg-red-100 text-red-700" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatRubles(v: number) {
  return new Intl.NumberFormat("ru-RU").format(v) + " ₽";
}

interface EmployeeProfile {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  email: string | null;
  company: { id: string; name: string; code: string } | null;
  groupMembers: {
    id: string;
    progressPercent: number;
    group: {
      id: string;
      name: string | null;
      startDate: string;
      endDate: string;
      status: string;
      pricePerPerson: number;
      course: { name: string; durationDays: number };
      _count: { members: number };
    };
  }[];
}

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Назначение прав
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantPassword, setGrantPassword] = useState("admin123");
  const [grantRole, setGrantRole] = useState("ADMIN");
  const [granting, setGranting] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);

  async function handleGrantAccess() {
    if (!grantEmail.trim() || !grantPassword.trim()) return;
    setGranting(true);
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: grantEmail,
          password: grantPassword,
          name: employee?.fullName,
          role: grantRole,
          employeeId: id,
          companyId: employee?.company?.id,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        alert(data.error);
        return;
      }
      if (!res.ok) {
        alert(data.error || "Ошибка");
        return;
      }
      setGrantOpen(false);
      setHasAccount(true);
      alert(`Аккаунт создан: ${grantEmail} / ${grantPassword}\nРоль: ${grantRole === "ADMIN" ? "Администратор" : "Пользователь"}`);
    } catch (e) {
      console.error(e);
    } finally {
      setGranting(false);
    }
  }

  useEffect(() => {
    fetch(`/api/employees/${id}`)
      .then((r) => r.json())
      .then(setEmployee)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!employee) {
    return <div className="text-center py-12 text-slate-500">Сотрудник не найден</div>;
  }

  const groups = employee.groupMembers || [];
  const totalGroups = groups.length;
  const completed = groups.filter((g) => g.group.status === "COMPLETED").length;
  const inProgress = groups.filter((g) => g.group.status === "IN_PROGRESS").length;
  const avgProgress =
    groups.length > 0
      ? Math.round(groups.reduce((sum, g) => sum + g.progressPercent, 0) / groups.length)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.location.href = "/employees"}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Назад
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{employee.fullName}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            {employee.company && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {employee.company.name}
              </span>
            )}
            {employee.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {employee.email}
              </span>
            )}
          </div>
        </div>
        {isAdminOrAbove(authUser?.role) && !hasAccount && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setGrantEmail(employee.email || "");
              setGrantOpen(true);
            }}
          >
            <ShieldCheck className="h-4 w-4 mr-1" />
            Назначить права
          </Button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Средний прогресс</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{avgProgress}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Всего курсов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{totalGroups}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">В процессе</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Завершено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Курсы */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Курсы ({totalGroups})
        </h2>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-slate-500">
              Сотрудник не записан ни на один курс
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {groups.map((gm) => (
              <Card
                key={gm.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => window.location.href = `/groups/${gm.group.id}`}
              >
                <div className="flex">
                  <div
                    className="w-1.5 shrink-0"
                    style={{
                      backgroundColor:
                        gm.group.status === "COMPLETED" ? "#10B981" :
                        gm.group.status === "IN_PROGRESS" ? "#3B82F6" :
                        gm.group.status === "CANCELLED" ? "#EF4444" : "#94A3B8",
                    }}
                  />
                  <div className="flex-1 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-slate-800">{gm.group.course.name}</h3>
                        {gm.group.name && (
                          <p className="text-xs text-slate-500 mt-0.5">{gm.group.name}</p>
                        )}
                      </div>
                      <Badge className={STATUS_CONFIG[gm.group.status]?.className}>
                        {STATUS_CONFIG[gm.group.status]?.label}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(gm.group.startDate)} — {formatDate(gm.group.endDate)}
                      </span>
                      <span>{pluralizeDays(gm.group.course.durationDays)}</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {gm.group._count.members} чел.
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-medium text-slate-700">Прогресс</span>
                        <span className="text-lg font-bold text-blue-600">{gm.progressPercent}%</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${gm.progressPercent}%`,
                            backgroundColor: gm.progressPercent === 100 ? "#10B981" : "#3B82F6",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      {/* Диалог назначения прав */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Назначить права доступа</DialogTitle>
            <DialogDescription>
              Создать аккаунт для {employee.fullName} с доступом в систему.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email (для входа)</Label>
              <Input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="user@company.ru" />
            </div>
            <div className="space-y-2">
              <Label>Временный пароль</Label>
              <Input value={grantPassword} onChange={(e) => setGrantPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={grantRole} onValueChange={(val) => val && setGrantRole(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите роль" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Пользователь</SelectItem>
                  <SelectItem value="ADMIN">Администратор</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Отмена</Button>
            <Button onClick={handleGrantAccess} disabled={granting || !grantEmail.trim()}>
              {granting ? "Создание..." : "Создать аккаунт"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
