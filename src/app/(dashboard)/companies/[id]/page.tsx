"use client";

import { useEffect, useState, useCallback, use } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Building2, Users, BookOpen, FileText, Mail, Phone, MapPin, GraduationCap, Plus, X } from "lucide-react";
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
  return new Intl.NumberFormat("ru-RU").format(Math.round(v)) + " \u20BD";
}

interface CompanyData {
  id: string;
  code: string;
  name: string;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  employees: {
    id: string;
    fullName: string;
    email: string | null;
    groupMembers: {
      progressPercent: number;
      group: {
        id: string;
        name: string | null;
        startDate: string;
        endDate: string;
        status: string;
        pricePerPerson: number;
        course: { name: string };
        _count: { members: number };
      };
    }[];
  }[];
  specifications: {
    id: string;
    number: string;
    date: string;
    status: string;
    trainingGroups: {
      pricePerPerson: number;
      members: { id: string }[];
      course: { name: string };
    }[];
  }[];
  courses: { courseId: string; course: { id: string; name: string; code: string | null; pricePerPerson: number; durationDays: number } }[];
  _count: { employees: number; specifications: number };
}

interface AllCourse {
  id: string;
  name: string;
  code: string | null;
  pricePerPerson: number;
  durationDays: number;
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const isAdmin = isAdminOrAbove(user?.role);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [allCourses, setAllCourses] = useState<AllCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCourseSelector, setShowCourseSelector] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchCompany = useCallback(() => {
    return fetch(`/api/companies/${id}`).then((r) => r.json()).then(setCompany);
  }, [id]);

  useEffect(() => {
    Promise.all([
      fetchCompany(),
      fetch("/api/courses").then((r) => r.json()).then(setAllCourses),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fetchCompany]);

  async function addCourse(courseId: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addCourseIds: [courseId] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Ошибка добавления курса");
      }
      await fetchCompany();
    } catch (e) {
      console.error(e);
      alert("Ошибка сети");
    } finally {
      setUpdating(false);
    }
  }

  async function removeCourse(courseId: string) {
    setUpdating(true);
    await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeCourseIds: [courseId] }),
    });
    await fetchCompany();
    setUpdating(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!company) {
    return <div className="text-center py-12 text-slate-500">Компания не найдена</div>;
  }

  // Собираем все уникальные группы через сотрудников
  const employees = company.employees || [];
  const specifications = company.specifications || [];
  const companyCourses = company.courses || [];
  const _count = company._count || { employees: 0, specifications: 0 };
  const groupsMap = new Map<string, { name: string; course: string; status: string; startDate: string; endDate: string; price: number; memberCount: number; avgProgress: number }>();
  for (const emp of employees) {
    for (const gm of emp.groupMembers) {
      const g = gm.group;
      if (!groupsMap.has(g.id)) {
        groupsMap.set(g.id, {
          name: g.name || `Группа #${g.id.slice(0, 6)}`,
          course: g.course.name,
          status: g.status,
          startDate: g.startDate,
          endDate: g.endDate,
          price: g.pricePerPerson,
          memberCount: g._count.members,
          avgProgress: 0,
        });
      }
    }
  }

  // Общие расчёты
  const totalSpent = specifications.reduce((sum, spec) => {
    const specTotal = spec.trainingGroups.reduce((s, g) => s + g.pricePerPerson * g.members.length, 0);
    return sum + specTotal;
  }, 0);

  const totalVAT = Math.round(totalSpent * 0.22);
  const totalWithVAT = totalSpent + totalVAT;
  const uniqueCourses = new Set<string>();
  for (const emp of employees) {
    for (const gm of emp.groupMembers) {
      uniqueCourses.add(gm.group.course.name);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.location.href = "/companies"}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Назад
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-600" />
            <h1 className="text-2xl font-bold text-slate-800">{company.name}</h1>
            <Badge variant="secondary" className="font-mono">{company.code}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            {company.inn && <span>ИНН: {company.inn}</span>}
            {company.contactPerson && <span>Контакт: {company.contactPerson}</span>}
            {company.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{company.phone}</span>}
            {company.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{company.email}</span>}
          </div>
          {company.address && (
            <div className="flex items-center gap-1 mt-0.5 text-sm text-slate-400">
              <MapPin className="h-3 w-3" />{company.address}
            </div>
          )}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Сотрудников</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-slate-900">{_count.employees}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Курсов</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-blue-600">{uniqueCourses.size}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Спецификаций</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-amber-600">{_count.specifications}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Общая сумма с НДС</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatRubles(totalWithVAT)}</div></CardContent>
        </Card>
      </div>

      {/* Доступные курсы компании */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Доступные курсы ({companyCourses.length})</CardTitle>
            </div>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setShowCourseSelector(!showCourseSelector)}>
                <Plus className="h-4 w-4 mr-1" />
                Назначить курсы
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Назначенные курсы */}
          {companyCourses.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {companyCourses.map((cc) => (
                <div key={cc.courseId} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">
                  <span
                    className="cursor-pointer hover:underline"
                    onClick={() => window.location.href = `/courses/${cc.course.code || cc.courseId}`}
                  >
                    {cc.course.name}
                  </span>
                  <span className="text-xs text-blue-400">{formatRubles(cc.course.pricePerPerson)}/чел</span>
                  {isAdmin && (
                    <button
                      onClick={() => removeCourse(cc.courseId)}
                      className="ml-1 hover:text-red-500 transition-colors"
                      disabled={updating}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">Курсы не назначены</p>
          )}

          {/* Селектор для добавления курсов */}
          {showCourseSelector && (
            <div className="border rounded-lg p-3 space-y-2">
              <input
                type="text"
                placeholder="Поиск курса..."
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-full h-8 px-3 text-sm border rounded-md mb-1"
              />
              {allCourses
                .filter((c) => !companyCourses.some((cc) => cc.courseId === c.id))
                .filter((c) => !courseSearch || c.name.toLowerCase().includes(courseSearch.toLowerCase()))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => addCourse(c.id)}
                    disabled={updating}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm text-left rounded-md hover:bg-slate-50 border transition-colors"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.durationDays} дн. · {formatRubles(c.pricePerPerson)}/чел</span>
                  </button>
                ))}
              {allCourses.filter((c) => !companyCourses.some((cc) => cc.courseId === c.id)).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Все курсы уже назначены</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Сотрудники */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Сотрудники ({employees.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Групп</TableHead>
                <TableHead>Средний прогресс</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => {
                const avg = emp.groupMembers.length > 0
                  ? Math.round(emp.groupMembers.reduce((s, g) => s + g.progressPercent, 0) / emp.groupMembers.length)
                  : 0;
                return (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => window.location.href = `/employees/${emp.id}`}
                  >
                    <TableCell className="font-medium text-blue-600">{emp.fullName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{emp.email || "—"}</TableCell>
                    <TableCell>{emp.groupMembers.length}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={avg} className="h-2 w-20" />
                        <span className="text-sm">{avg}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Учебные группы */}
      {groupsMap.size > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Учебные группы ({groupsMap.size})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Группа</TableHead>
                  <TableHead>Курс</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Участников</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...groupsMap.entries()].map(([gId, g]) => {
                  const statusCfg = STATUS_CONFIG[g.status] || STATUS_CONFIG.PLANNED;
                  return (
                    <TableRow
                      key={gId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => window.location.href = `/groups/${gId}`}
                    >
                      <TableCell className="font-medium text-blue-600">{g.name}</TableCell>
                      <TableCell className="text-sm">{g.course}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(g.startDate)} — {formatDate(g.endDate)}
                      </TableCell>
                      <TableCell><Badge className={statusCfg.className}>{statusCfg.label}</Badge></TableCell>
                      <TableCell className="text-right">{g.memberCount}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Спецификации */}
      {specifications.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Спецификации ({specifications.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Групп</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specifications.map((spec) => {
                  const subtotal = spec.trainingGroups.reduce((s, g) => s + g.pricePerPerson * g.members.length, 0);
                  const SPEC_STATUS: Record<string, { label: string; className: string }> = {
                    FORMED: { label: "Сформирован", className: "bg-slate-100 text-slate-700" },
                    ISSUED: { label: "Выставлен", className: "bg-blue-100 text-blue-700" },
                    PENDING: { label: "Ожидание", className: "bg-amber-100 text-amber-700" },
                    PAID: { label: "Оплачен", className: "bg-green-100 text-green-700" },
                    ARCHIVED: { label: "Архив", className: "bg-slate-100 text-slate-500" },
                  };
                  const sCfg = SPEC_STATUS[spec.status] || SPEC_STATUS.FORMED;
                  return (
                    <TableRow key={spec.id}>
                      <TableCell className="font-mono font-medium">{spec.number}</TableCell>
                      <TableCell className="text-sm">{formatDate(spec.date)}</TableCell>
                      <TableCell><Badge className={sCfg.className}>{sCfg.label}</Badge></TableCell>
                      <TableCell>{spec.trainingGroups.length}</TableCell>
                      <TableCell className="text-right font-medium">{formatRubles(subtotal)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
