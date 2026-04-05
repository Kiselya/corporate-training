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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Users,
  Clock,
  GraduationCap,
} from "lucide-react";
import { pluralizeDays, formatDate } from "@/lib/types";
import { useAuth, isAdminOrAbove, isSuperAdmin } from "@/lib/auth-context";

// --- Типы ---

type ModuleType = "LECTURE" | "PRACTICE" | "TEST" | "ASSIGNMENT";

interface CourseModule {
  id: string;
  title: string;
  type: ModuleType;
  durationHours: number;
  orderIndex: number;
  description: string | null;
}

interface TrainingGroup {
  id: string;
  name: string | null;
  startDate: string;
  endDate: string;
  status: string;
  _count: {
    members: number;
  };
}

interface CourseData {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  durationDays: number;
  pricePerPerson: number;
  modules: CourseModule[];
  trainingGroups: TrainingGroup[];
}

// --- Конфиги ---

const MODULE_TYPE_CONFIG: Record<
  ModuleType,
  { label: string; className: string }
> = {
  LECTURE: { label: "Лекция", className: "bg-blue-100 text-blue-700" },
  PRACTICE: { label: "Практика", className: "bg-green-100 text-green-700" },
  TEST: { label: "Тест", className: "bg-amber-100 text-amber-700" },
  ASSIGNMENT: { label: "Задание", className: "bg-purple-100 text-purple-700" },
};

const MODULE_TYPES: ModuleType[] = ["LECTURE", "PRACTICE", "TEST", "ASSIGNMENT"];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PLANNED: { label: "Планируется", className: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "В процессе", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Завершено", className: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Отменено", className: "bg-red-100 text-red-700" },
};

// --- Утилиты ---

function formatRubles(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value) + " \u20BD";
}

function formatHours(h: number): string {
  return `${h} ч.`;
}

function pluralizeModules(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${n} модулей`;
  if (mod10 === 1) return `${n} модуль`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} модуля`;
  return `${n} модулей`;
}

// --- Компонент ---

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const { user } = useAuth();
  const isAdmin = isAdminOrAbove(user?.role);
  const showPrice = isSuperAdmin(user?.role);

  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);

  // Module dialog state
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<ModuleType>("LECTURE");
  const [formDuration, setFormDuration] = useState("1");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete module dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingModule, setDeletingModule] = useState<CourseModule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCourse = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      if (res.ok) {
        setCourse(await res.json());
      }
    } catch (error) {
      console.error("Ошибка загрузки курса:", error);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  // --- Module CRUD ---

  function openCreateModule() {
    setEditingModule(null);
    setFormTitle("");
    setFormType("LECTURE");
    setFormDuration("1");
    setFormDescription("");
    setModuleDialogOpen(true);
  }

  function openEditModule(mod: CourseModule) {
    setEditingModule(mod);
    setFormTitle(mod.title);
    setFormType(mod.type);
    setFormDuration(String(mod.durationHours));
    setFormDescription(mod.description || "");
    setModuleDialogOpen(true);
  }

  async function handleSaveModule() {
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      const nextOrder =
        course && course.modules.length > 0
          ? Math.max(...course.modules.map((m) => m.orderIndex)) + 1
          : 1;

      const payload = {
        title: formTitle,
        type: formType,
        durationHours: Number(formDuration) || 1,
        description: formDescription || undefined,
        orderIndex: editingModule ? editingModule.orderIndex : nextOrder,
      };

      if (editingModule) {
        await fetch(`/api/courses/${courseId}/modules/${editingModule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`/api/courses/${courseId}/modules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setModuleDialogOpen(false);
      await fetchCourse();
    } catch (error) {
      console.error("Ошибка сохранения модуля:", error);
    } finally {
      setSaving(false);
    }
  }

  function openDeleteModule(mod: CourseModule) {
    setDeletingModule(mod);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteModule() {
    if (!deletingModule) return;
    setDeleting(true);
    try {
      await fetch(`/api/courses/${courseId}/modules/${deletingModule.id}`, {
        method: "DELETE",
      });
      setDeleteDialogOpen(false);
      setDeletingModule(null);
      await fetchCourse();
    } catch (error) {
      console.error("Ошибка удаления модуля:", error);
    } finally {
      setDeleting(false);
    }
  }

  // --- Computed values ---

  const totalHours = course
    ? course.modules.reduce((sum, m) => sum + m.durationHours, 0)
    : 0;

  const typeCounts = course
    ? MODULE_TYPES.reduce(
        (acc, t) => {
          acc[t] = course.modules.filter((m) => m.type === t).length;
          return acc;
        },
        {} as Record<ModuleType, number>
      )
    : ({} as Record<ModuleType, number>);

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => window.location.href = "/courses"}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Назад к курсам
        </Button>
        <p className="text-destructive">Курс не найден</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.location.href = isAdmin ? "/courses" : "/my-courses"}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {course.name}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            {course.code && (
              <span className="font-mono">{course.code}</span>
            )}
            <span>{pluralizeDays(course.durationDays)}</span>
            {showPrice && (
              <span>{formatRubles(course.pricePerPerson)} / чел.</span>
            )}
            <span>
              {course.trainingGroups.length}{" "}
              {course.trainingGroups.length === 1
                ? "группа"
                : course.trainingGroups.length >= 2 &&
                    course.trainingGroups.length <= 4
                  ? "группы"
                  : "групп"}
            </span>
          </div>
          {course.description && (
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              {course.description}
            </p>
          )}
        </div>
      </div>

      {/* Summary + Modules */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Summary Card */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Сводка по модулям</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Всего модулей</span>
                  <span className="font-semibold">{course.modules.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Общая длительность</span>
                  <span className="font-semibold">{formatHours(totalHours)}</span>
                </div>
                <div className="border-t pt-3 space-y-2">
                  {MODULE_TYPES.map((t) => {
                    const count = typeCounts[t] || 0;
                    if (count === 0) return null;
                    const cfg = MODULE_TYPE_CONFIG[t];
                    return (
                      <div key={t} className="flex items-center justify-between">
                        <Badge className={cfg.className}>{cfg.label}</Badge>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    );
                  })}
                  {course.modules.length === 0 && (
                    <p className="text-xs text-muted-foreground">Модули не добавлены</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modules Table */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Модули курса</CardTitle>
                  <CardDescription>
                    {course.modules.length > 0
                      ? `${pluralizeModules(course.modules.length)}, ${formatHours(totalHours)}`
                      : "Программа курса пока не заполнена"}
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Button onClick={openCreateModule}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Добавить модуль
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {course.modules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Модули не добавлены</p>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={openCreateModule}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Добавить первый модуль
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>Название</TableHead>
                      <TableHead className="w-28">Тип</TableHead>
                      <TableHead className="w-28 text-right">Длительность</TableHead>
                      {isAdmin && (
                        <TableHead className="w-24 text-right">Действия</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {course.modules.map((mod) => {
                      const typeCfg = MODULE_TYPE_CONFIG[mod.type];
                      return (
                        <TableRow
                          key={mod.id}
                          className={isAdmin ? "cursor-pointer hover:bg-muted/50" : ""}
                          onClick={isAdmin ? () => openEditModule(mod) : undefined}
                        >
                          <TableCell className="text-center font-mono text-sm text-muted-foreground">
                            {mod.orderIndex}
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium">{mod.title}</span>
                              {mod.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {mod.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={typeCfg.className}>
                              {typeCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 text-sm">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatHours(mod.durationHours)}
                            </div>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div
                                className="flex items-center justify-end gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openEditModule(mod)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openDeleteModule(mod)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Groups Section — ADMIN/SUPER_ADMIN видят все, USER — не видит (у него "Мои группы") */}
      {isAdmin && course.trainingGroups.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Учебные группы</CardTitle>
            </div>
            <CardDescription>
              Группы, обучающиеся по этому курсу
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Участников</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {course.trainingGroups.map((group) => {
                  const statusCfg =
                    STATUS_CONFIG[group.status] || STATUS_CONFIG.PLANNED;
                  return (
                    <TableRow
                      key={group.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => window.location.href = `/groups/${group.id}`}
                    >
                      <TableCell>
                        <span className="font-medium text-blue-600 hover:underline">
                          {group.name || "Без названия"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(group.startDate)} &mdash;{" "}
                        {formatDate(group.endDate)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusCfg.className}>
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {group._count.members}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Module Create/Edit Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingModule ? "Редактировать модуль" : "Новый модуль"}
            </DialogTitle>
            <DialogDescription>
              {editingModule
                ? "Измените параметры модуля"
                : "Добавьте новый модуль в программу курса"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="module-title">Название</Label>
              <Input
                id="module-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Введение в систему"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="module-type">Тип</Label>
                <select
                  id="module-type"
                  className="w-full h-10 px-3 border rounded-md text-sm bg-white"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as ModuleType)}
                >
                  {MODULE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MODULE_TYPE_CONFIG[t].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="module-duration">Длительность (ч.)</Label>
                <Input
                  id="module-duration"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  placeholder="2"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-description">Описание</Label>
              <Textarea
                id="module-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Краткое описание модуля..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Отмена
            </DialogClose>
            <Button
              onClick={handleSaveModule}
              disabled={saving || !formTitle.trim()}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Module Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить модуль</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить модуль &laquo;{deletingModule?.title}
              &raquo;? Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Отмена
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteModule}
              disabled={deleting}
            >
              {deleting ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
