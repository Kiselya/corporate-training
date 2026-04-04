"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
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
import { Plus, Pencil, Trash2, Upload, Download, Search } from "lucide-react";
import { pluralizeDays } from "@/lib/types";
import { useAuth, isAdminOrAbove, isSuperAdmin } from "@/lib/auth-context";

function formatRubles(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value) + " \u20BD";
}

interface Course {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  durationDays: number;
  pricePerPerson: number;
  _count: {
    trainingGroups: number;
  };
}

export default function CoursesPage() {
  const { user } = useAuth();
  const isAdmin = isAdminOrAbove(user?.role);
  const showPrice = isSuperAdmin(user?.role);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDuration, setFormDuration] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);

  // XML import
  const [importing, setImporting] = useState(false);

  // Поиск
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCourses = useMemo(() => {
    if (!searchQuery) return courses;
    const q = searchQuery.toLowerCase();
    return courses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code || "").toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
    );
  }, [courses, searchQuery]);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch("/api/courses");
      if (res.ok) setCourses(await res.json());
    } catch (error) {
      console.error("Ошибка загрузки курсов:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  function openCreateDialog() {
    setEditingCourse(null);
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setFormDuration("");
    setFormPrice("");
    setDialogOpen(true);
  }

  function openEditDialog(course: Course) {
    setEditingCourse(course);
    setFormCode(course.code || "");
    setFormName(course.name);
    setFormDescription(course.description || "");
    setFormDuration(String(course.durationDays));
    setFormPrice(String(course.pricePerPerson));
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formDuration || !formPrice) return;
    setSaving(true);
    try {
      const payload = {
        code: formCode || undefined,
        name: formName,
        description: formDescription || undefined,
        durationDays: Number(formDuration),
        pricePerPerson: Number(formPrice),
      };
      if (editingCourse) {
        await fetch(`/api/courses/${editingCourse.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setDialogOpen(false);
      await fetchCourses();
    } catch (error) {
      console.error("Ошибка сохранения:", error);
    } finally {
      setSaving(false);
    }
  }

  function openDeleteDialog(course: Course) {
    setDeletingCourse(course);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingCourse) return;
    setDeleting(true);
    try {
      await fetch(`/api/courses/${deletingCourse.id}`, { method: "DELETE" });
      setDeleteDialogOpen(false);
      setDeletingCourse(null);
      await fetchCourses();
    } catch (error) {
      console.error("Ошибка удаления:", error);
    } finally {
      setDeleting(false);
    }
  }

  async function handleXmlImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/xml/import", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        await fetchCourses();
      } else {
        console.error("Ошибка импорта XML");
      }
    } catch (error) {
      console.error("Ошибка импорта:", error);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Курсы обучения
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Каталог образовательных программ
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* XML импорт/экспорт — только для администратора */}
          {isAdmin && (
            <>
              <Button variant="outline" className="relative" disabled={importing}>
                <Upload className="mr-1.5 h-4 w-4" />
                {importing ? "Импорт..." : "Импорт XML"}
                <input
                  type="file"
                  accept=".xml"
                  onChange={handleXmlImport}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </Button>
            </>
          )}
          <Button onClick={openCreateDialog}>
            <Plus className="mr-1.5 h-4 w-4" />
            Добавить курс
          </Button>
        </div>
      </div>

      {/* Поиск */}
      {courses.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию, коду или описанию курса..."
            className="pl-9"
          />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Загрузка...</p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">
                {searchQuery ? "Ничего не найдено. Попробуйте изменить запрос." : "Курсы не найдены"}
              </p>
              {!searchQuery && (
                <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Добавить первый курс
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Код</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead className="text-right">Длительность</TableHead>
                  {showPrice && <TableHead className="text-right">Цена/чел</TableHead>}
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCourses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-mono text-sm">
                      {course.code || "---"}
                    </TableCell>
                    <TableCell className="font-medium">{course.name}</TableCell>
                    <TableCell className="text-right">
                      {pluralizeDays(course.durationDays)}
                    </TableCell>
                    {showPrice && (
                      <TableCell className="text-right">
                        {formatRubles(course.pricePerPerson)}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => window.open(`/api/xml/export/course/${course.id}`, "_blank")}
                            title="Экспорт XML"
                          >
                            <Download className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(course)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openDeleteDialog(course)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCourse ? "Редактировать курс" : "Новый курс"}
            </DialogTitle>
            <DialogDescription>
              {editingCourse
                ? "Измените данные курса"
                : "Заполните данные для создания курса"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="course-code">Код</Label>
              <Input
                id="course-code"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="COURSE-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-name">Название</Label>
              <Input
                id="course-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Название курса"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-description">Описание</Label>
              <Textarea
                id="course-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Описание курса..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="course-duration">Длительность (дней)</Label>
                <Input
                  id="course-duration"
                  type="number"
                  min="1"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  placeholder="5"
                />
              </div>
              {showPrice && <div className="space-y-2">
                <Label htmlFor="course-price">Цена за человека</Label>
                <Input
                  id="course-price"
                  type="number"
                  min="0"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="15000"
                />
              </div>}
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Отмена
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={saving || !formName.trim() || !formDuration || !formPrice}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить курс</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить курс &laquo;{deletingCourse?.name}&raquo;?
              Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Отмена
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
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
