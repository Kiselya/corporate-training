"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { pluralizeDays } from "@/lib/types";
import { useAuth, isSuperAdmin } from "@/lib/auth-context";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Users,
  BookOpen,
  Banknote,
} from "lucide-react";

function formatRubles(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value) + " \u20BD";
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
  { label: string; className: string }
> = {
  PLANNED: { label: "Планируется", className: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "В процессе", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Завершено", className: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Отменено", className: "bg-red-100 text-red-700" },
};

const STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

interface Employee {
  id: string;
  fullName: string;
  email: string | null;
  company: { id: string; name: string } | null;
}

interface GroupMember {
  id: string;
  employeeId: string;
  progressPercent: number;
  employee: Employee;
}

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
    description: string | null;
    durationDays: number;
    pricePerPerson: number;
  };
  members: GroupMember[];
  memberCount: number;
  totalCost: number;
  avgProgress: number;
}

/**
 * Компонент ввода прогресса (0–100%)
 *
 * Логика: при фокусе показываем "сырую" строку (может быть пустой),
 * при потере фокуса — валидируем и применяем числовое значение.
 * Это решает проблему "0" который не стирается при повторном редактировании.
 */
function ProgressInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  // Синхронизируем draft с внешним value когда не редактируем
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={editing ? draft : String(value)}
      onFocus={(e) => {
        setEditing(true);
        setDraft(String(value));
        // Выделяем всё через setTimeout чтобы сработало в Safari
        setTimeout(() => e.target.select(), 0);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, "");
        setDraft(raw);
        // Применяем сразу чтобы ползунок синхронизировался
        if (raw !== "") {
          let num = parseInt(raw, 10);
          if (num > 100) num = 100;
          onChange(num);
        }
      }}
      onBlur={() => {
        setEditing(false);
        // При потере фокуса — если пусто, ставим 0
        if (draft === "" || isNaN(parseInt(draft, 10))) {
          onChange(0);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-12 text-right text-sm font-medium tabular-nums bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary focus:outline-none"
    />
  );
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const { user: authUser } = useAuth();

  // Проверка доступа — только ADMIN и SUPER_ADMIN
  useEffect(() => {
    if (authUser && authUser.role === "USER") {
      window.location.href = "/my-courses";
    }
  }, [authUser, router]);

  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  // All employees for adding members
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);

  // Add member dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);

  // Create new employee inline (в том же диалоге)
  const [allCompanies, setAllCompanies] = useState<{ id: string; name: string }[]>([]);
  const [newEmpLastName, setNewEmpLastName] = useState("");
  const [newEmpFirstName, setNewEmpFirstName] = useState("");
  const [newEmpMiddleName, setNewEmpMiddleName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpCompanyId, setNewEmpCompanyId] = useState<string | null>(null);
  const [creatingEmployee, setCreatingEmployee] = useState(false);

  // Remove member dialog
  const [removeMemberOpen, setRemoveMemberOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<GroupMember | null>(null);
  const [removingInProgress, setRemovingInProgress] = useState(false);

  // Progress updates (debounced)
  const [progressUpdates, setProgressUpdates] = useState<Record<string, number>>({});

  const fetchGroup = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      if (res.ok) {
        const data = await res.json();
        setGroup(data);
      }
    } catch (error) {
      console.error("Ошибка загрузки группы:", error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (res.ok) setAllEmployees(await res.json());
    } catch (error) {
      console.error("Ошибка загрузки сотрудников:", error);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/companies");
      if (res.ok) setAllCompanies(await res.json());
    } catch (error) {
      console.error("Ошибка загрузки компаний:", error);
    }
  }, []);

  useEffect(() => {
    fetchGroup();
    fetchEmployees();
    fetchCompanies();
  }, [fetchGroup, fetchEmployees, fetchCompanies]);

  // Employees not already in the group
  const availableEmployees = allEmployees.filter(
    (emp) => !group?.members.some((m) => m.employeeId === emp.id)
  );

  async function handleStatusChange(newStatus: string) {
    if (!group) return;
    try {
      await fetch(`/api/groups/${groupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchGroup();
    } catch (error) {
      console.error("Ошибка обновления статуса:", error);
    }
  }

  async function handleAddMember() {
    if (!selectedEmployeeId) return;
    setAddingMember(true);
    try {
      await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedEmployeeId }),
      });
      setAddMemberOpen(false);
      setSelectedEmployeeId(null);
      await fetchGroup();
      await fetchEmployees();
    } catch (error) {
      console.error("Ошибка добавления участника:", error);
    } finally {
      setAddingMember(false);
    }
  }

  // Создать нового сотрудника и сразу добавить в группу
  async function handleCreateAndAdd() {
    if (!newEmpLastName.trim() || !newEmpFirstName.trim()) return;
    setCreatingEmployee(true);
    try {
      // 1. Создаём сотрудника
      const fullName = [newEmpLastName, newEmpFirstName, newEmpMiddleName]
        .filter(Boolean)
        .join(" ");
      const empRes = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastName: newEmpLastName,
          firstName: newEmpFirstName,
          middleName: newEmpMiddleName || undefined,
          fullName,
          email: newEmpEmail || undefined,
          companyId: (authUser?.role === "ADMIN" && authUser?.companyId) ? authUser.companyId : (newEmpCompanyId || undefined),
        }),
      });
      let newEmp = await empRes.json();
      if (empRes.status === 409) {
        const proceed = confirm(`⚠️ ${newEmp.warning}\n\nСоздать ещё одного сотрудника с таким же ФИО?`);
        if (!proceed) return;
        const retryRes = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lastName: newEmpLastName, firstName: newEmpFirstName,
            middleName: newEmpMiddleName || undefined, fullName,
            email: newEmpEmail || undefined, companyId: newEmpCompanyId || undefined,
            force: true,
          }),
        });
        newEmp = await retryRes.json();
        if (!retryRes.ok) { alert(newEmp.error || "Ошибка создания"); return; }
      } else if (!empRes.ok) {
        alert(newEmp.error || "Ошибка создания сотрудника");
        return;
      }

      // 2. Добавляем в группу
      await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: newEmp.id }),
      });

      // 3. Сброс формы и обновление данных
      setNewEmpLastName("");
      setNewEmpFirstName("");
      setNewEmpMiddleName("");
      setNewEmpEmail("");
      setNewEmpCompanyId(null);
      setAddMemberOpen(false);
      await fetchGroup();
      await fetchEmployees();
    } catch (error) {
      console.error("Ошибка создания сотрудника:", error);
    } finally {
      setCreatingEmployee(false);
    }
  }

  function openRemoveDialog(member: GroupMember) {
    setRemovingMember(member);
    setRemoveMemberOpen(true);
  }

  async function handleRemoveMember() {
    if (!removingMember) return;
    setRemovingInProgress(true);
    try {
      await fetch(`/api/groups/${groupId}/members/${removingMember.id}`, {
        method: "DELETE",
      });
      setRemoveMemberOpen(false);
      setRemovingMember(null);
      await fetchGroup();
    } catch (error) {
      console.error("Ошибка удаления участника:", error);
    } finally {
      setRemovingInProgress(false);
    }
  }

  async function handleProgressChange(memberId: string, value: number) {
    setProgressUpdates((prev) => ({ ...prev, [memberId]: value }));
    try {
      await fetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressPercent: value }),
      });
      // Update local state for avg progress recalculation
      setGroup((prev) => {
        if (!prev) return prev;
        const updatedMembers = prev.members.map((m) =>
          m.id === memberId ? { ...m, progressPercent: value } : m
        );
        const memberCount = updatedMembers.length;
        const avgProgress =
          memberCount > 0
            ? Math.round(
                updatedMembers.reduce((sum, m) => sum + m.progressPercent, 0) /
                  memberCount
              )
            : 0;
        return {
          ...prev,
          members: updatedMembers,
          avgProgress,
        };
      });
    } catch (error) {
      console.error("Ошибка обновления прогресса:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => window.location.href = "/groups"}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Назад к группам
        </Button>
        <p className="text-destructive">Группа не найдена</p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[group.status] || STATUS_CONFIG.PLANNED;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.location.href = "/groups"}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {group.name || group.course.name}
            </h1>
            <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(group.startDate)} &mdash; {formatDate(group.endDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Статус:</Label>
          <Select
            value={group.status}
            onValueChange={(val) => handleStatusChange(val as string)}
          >
            <SelectTrigger className="w-44">
              <SelectValue>{STATUS_CONFIG[group.status]?.label || group.status}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Course Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Курс</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Название: </span>
                <span className="font-medium">{group.course.name}</span>
              </div>
              {group.course.description && (
                <div>
                  <span className="text-muted-foreground">Описание: </span>
                  <span>{group.course.description}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Длительность: </span>
                <span className="font-medium">
                  {pluralizeDays(group.course.durationDays)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Info — только SUPER_ADMIN */}
        {isSuperAdmin(authUser?.role) && <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Финансы</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Цена за человека: </span>
                <span className="font-medium">
                  {formatRubles(group.pricePerPerson)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Участников: </span>
                <span className="font-medium">{group.memberCount}</span>
              </div>
              <Separator />
              <div>
                <span className="text-muted-foreground">Общая стоимость: </span>
                <span className="text-base font-semibold">
                  {formatRubles(group.totalCost)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatRubles(group.pricePerPerson)} x {group.memberCount} участн.
              </p>
            </div>
          </CardContent>
        </Card>}

        {/* Progress */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Прогресс</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-3xl font-bold text-slate-900">
                {group.avgProgress}%
              </div>
              <Progress value={group.avgProgress}>
                <ProgressLabel className="text-xs text-muted-foreground">
                  Средний прогресс
                </ProgressLabel>
                <ProgressValue />
              </Progress>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Участники группы</CardTitle>
              <CardDescription>
                {group.memberCount} участн. в группе
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedEmployeeId(null);
                setAddMemberOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Добавить участника
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {group.members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground">Нет участников</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ФИО</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Компания</TableHead>
                  <TableHead className="w-64">Прогресс</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.members.map((member) => {
                  const currentProgress =
                    progressUpdates[member.id] ?? member.progressPercent;
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.employee.fullName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.employee.email || "---"}
                      </TableCell>
                      <TableCell>
                        {member.employee.company?.name || "---"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={currentProgress}
                            onChange={(e) =>
                              handleProgressChange(
                                member.id,
                                Number(e.target.value)
                              )
                            }
                            className="h-2 w-full cursor-pointer accent-primary"
                          />
                          <div className="flex items-center shrink-0">
                            <ProgressInput
                              value={currentProgress}
                              onChange={(val) =>
                                handleProgressChange(member.id, val)
                              }
                            />
                            <span className="text-sm text-slate-400 ml-0.5">%</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openRemoveDialog(member)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog — с вкладками "Выбрать" / "Создать нового" */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Добавить участника</DialogTitle>
            <DialogDescription>
              Выберите из существующих или создайте нового сотрудника
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="existing" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing">Из справочника</TabsTrigger>
              <TabsTrigger value="create">Создать нового</TabsTrigger>
            </TabsList>

            {/* Вкладка: выбор из существующих */}
            <TabsContent value="existing" className="space-y-4 mt-4">
              {availableEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Все сотрудники уже в группе. Создайте нового на соседней вкладке.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label>Сотрудник</Label>
                  <select
                    className="w-full h-10 px-3 border rounded-md text-sm bg-white"
                    value={selectedEmployeeId || ""}
                    onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
                  >
                    <option value="">Выберите сотрудника</option>
                    {availableEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName}
                        {emp.company ? ` (${emp.company.name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <DialogClose render={<Button variant="outline" />}>
                  Отмена
                </DialogClose>
                <Button
                  onClick={handleAddMember}
                  disabled={addingMember || !selectedEmployeeId}
                >
                  {addingMember ? "Добавление..." : "Добавить"}
                </Button>
              </div>
            </TabsContent>

            {/* Вкладка: создание нового сотрудника */}
            <TabsContent value="create" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Фамилия *</Label>
                  <Input
                    value={newEmpLastName}
                    onChange={(e) => setNewEmpLastName(e.target.value)}
                    placeholder="Иванов"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Имя *</Label>
                  <Input
                    value={newEmpFirstName}
                    onChange={(e) => setNewEmpFirstName(e.target.value)}
                    placeholder="Иван"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Отчество</Label>
                  <Input
                    value={newEmpMiddleName}
                    onChange={(e) => setNewEmpMiddleName(e.target.value)}
                    placeholder="Иванович"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    value={newEmpEmail}
                    onChange={(e) => setNewEmpEmail(e.target.value)}
                    placeholder="ivanov@company.ru"
                    type="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Компания</Label>
                  {authUser?.role === "ADMIN" && authUser?.companyId ? (
                    <div className="flex items-center h-10 px-3 rounded-md border bg-slate-50 text-sm text-slate-700">
                      {allCompanies.find((c) => c.id === authUser.companyId)?.name || "Ваша компания"}
                    </div>
                  ) : (
                    <select
                      className="w-full h-10 px-3 border rounded-md text-sm bg-white"
                      value={newEmpCompanyId || ""}
                      onChange={(e) => setNewEmpCompanyId(e.target.value || null)}
                    >
                      <option value="">Выберите...</option>
                      {allCompanies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              {newEmpLastName && newEmpFirstName && (
                <p className="text-xs text-slate-400">
                  Будет создан: <strong>{newEmpLastName} {newEmpFirstName} {newEmpMiddleName}</strong>
                  {newEmpCompanyId && ` (${allCompanies.find(c => c.id === newEmpCompanyId)?.name})`}
                  {" "}и сразу добавлен в группу
                </p>
              )}
              <div className="flex justify-end gap-2">
                <DialogClose render={<Button variant="outline" />}>
                  Отмена
                </DialogClose>
                <Button
                  onClick={handleCreateAndAdd}
                  disabled={creatingEmployee || !newEmpLastName.trim() || !newEmpFirstName.trim()}
                >
                  {creatingEmployee ? "Создание..." : "Создать и добавить"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <Dialog open={removeMemberOpen} onOpenChange={setRemoveMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить участника</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить участника &laquo;
              {removingMember?.employee.fullName}&raquo; из группы?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Отмена
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={removingInProgress}
            >
              {removingInProgress ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
