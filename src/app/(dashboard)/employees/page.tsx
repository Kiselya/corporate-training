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
import { Plus, Pencil, Trash2, Upload, Download, Search } from "lucide-react";
import { useAuth, isAdminOrAbove } from "@/lib/auth-context";

interface Company {
  id: string;
  code: string;
  name: string;
}

interface Employee {
  id: string;
  code: string | null;
  lastName: string;
  firstName: string;
  middleName: string | null;
  fullName: string;
  email: string | null;
  companyId: string | null;
  company: Company | null;
  groupMembers?: unknown[];
  _count?: { groupMembers: number };
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const isAdmin = isAdminOrAbove(user?.role);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formLastName, setFormLastName] = useState("");
  const [formFirstName, setFormFirstName] = useState("");
  const [formMiddleName, setFormMiddleName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formCompanyId, setFormCompanyId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  // XML import
  const [importing, setImporting] = useState(false);

  // Поиск и фильтр
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  const filteredEmployees = useMemo(() => {
    let result = [...employees];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          (e.email || "").toLowerCase().includes(q)
      );
    }

    if (companyFilter !== "all") {
      result = result.filter((e) => e.company?.id === companyFilter);
    }

    return result;
  }, [employees, searchQuery, companyFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, compRes] = await Promise.all([
        fetch("/api/employees"),
        fetch("/api/companies"),
      ]);
      if (empRes.ok) setEmployees(await empRes.json());
      if (compRes.ok) setCompanies(await compRes.json());
    } catch (error) {
      console.error("Ошибка загрузки:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Загрузка при монтировании + при возврате на страницу (focus)
  useEffect(() => {
    fetchData();
    const handleFocus = () => fetchData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchData]);

  function openCreateDialog() {
    setEditingEmployee(null);
    setFormLastName("");
    setFormFirstName("");
    setFormMiddleName("");
    setFormEmail("");
    setFormPhone("");
    setFormNote("");
    setFormCompanyId("");
    setDialogOpen(true);
  }

  function openEditDialog(emp: Employee) {
    setEditingEmployee(emp);
    setFormLastName(emp.lastName);
    setFormFirstName(emp.firstName);
    setFormMiddleName(emp.middleName || "");
    setFormEmail(emp.email || "");
    setFormPhone((emp as any).phone || "");
    setFormNote((emp as any).note || "");
    setFormCompanyId(emp.companyId || "");
    setDialogOpen(true);
  }

  const fullName = [formLastName, formFirstName, formMiddleName]
    .filter(Boolean)
    .join(" ");

  async function handleSave() {
    if (!formLastName.trim() || !formFirstName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        lastName: formLastName,
        firstName: formFirstName,
        middleName: formMiddleName || undefined,
        fullName,
        email: formEmail || undefined,
        phone: formPhone || undefined,
        note: formNote || undefined,
        companyId: formCompanyId || undefined,
      };
      if (editingEmployee) {
        await fetch(`/api/employees/${editingEmployee.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const res = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status === 409) {
          const data = await res.json();
          const proceed = confirm(`⚠️ ${data.warning}\n\nСоздать ещё одного сотрудника с таким же ФИО?`);
          if (!proceed) { setSaving(false); return; }
          // Повторный запрос с флагом force
          await fetch("/api/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, force: true }),
          });
        }
      }
      setDialogOpen(false);
      await fetchData();
    } catch (error) {
      console.error("Ошибка сохранения:", error);
    } finally {
      setSaving(false);
    }
  }

  function openDeleteDialog(emp: Employee) {
    setDeletingEmployee(emp);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingEmployee) return;
    setDeleting(true);
    try {
      await fetch(`/api/employees/${deletingEmployee.id}`, {
        method: "DELETE",
      });
      setDeleteDialogOpen(false);
      setDeletingEmployee(null);
      await fetchData();
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
        await fetchData();
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
            Учащиеся
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Реестр участников обучения
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
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
          )}
          <Button onClick={openCreateDialog}>
            <Plus className="mr-1.5 h-4 w-4" />
            Добавить учащегося
          </Button>
        </div>
      </div>

      {/* Поиск и фильтр по компании */}
      {employees.length > 0 && (
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по ФИО или email..."
              className="pl-9"
            />
          </div>
          <select
            className="h-10 px-3 border rounded-md text-sm bg-white min-w-[200px]"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          >
            <option value="all">Все компании ({employees.length})</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({employees.filter((e) => e.company?.id === c.id).length})
              </option>
            ))}
          </select>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">
                {searchQuery || companyFilter !== "all" ? "Никого не найдено. Попробуйте изменить фильтры." : "Учащиеся не найдены"}
              </p>
              {!searchQuery && companyFilter === "all" && (
                <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Добавить первого учащегося
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ФИО</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Компания</TableHead>
                  <TableHead>Заметка</TableHead>
                  <TableHead className="text-right">Кол-во групп</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <a href={`/employees/${emp.code || emp.id}`} className="font-medium text-blue-600 hover:underline">
                        {emp.fullName}
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {emp.email || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(emp as any).phone || "—"}
                    </TableCell>
                    <TableCell>{emp.company?.name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                      {(emp as any).note || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {emp._count?.groupMembers ?? emp.groupMembers?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => window.open(`/api/xml/export/employee/${emp.id}`, "_blank")}
                            title="Экспорт XML"
                          >
                            <Download className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(emp)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openDeleteDialog(emp)}
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
              {editingEmployee ? "Редактировать сотрудника" : "Новый сотрудник"}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee
                ? "Измените данные сотрудника"
                : "Заполните данные для создания сотрудника"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emp-lastName">Фамилия</Label>
              <Input
                id="emp-lastName"
                value={formLastName}
                onChange={(e) => setFormLastName(e.target.value)}
                placeholder="Иванов"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-firstName">Имя</Label>
              <Input
                id="emp-firstName"
                value={formFirstName}
                onChange={(e) => setFormFirstName(e.target.value)}
                placeholder="Иван"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-middleName">Отчество</Label>
              <Input
                id="emp-middleName"
                value={formMiddleName}
                onChange={(e) => setFormMiddleName(e.target.value)}
                placeholder="Иванович"
              />
            </div>
            {fullName && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                ФИО: <span className="font-medium text-foreground">{fullName}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emp-email">Email</Label>
                <Input
                  id="emp-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="ivan@company.ru"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-phone">Телефон</Label>
                <Input
                  id="emp-phone"
                  value={formPhone}
                  onChange={(e) => {
                    // Оставляем только цифры и +
                    let v = e.target.value.replace(/[^\d+]/g, "");
                    if (v && !v.startsWith("+7")) {
                      v = v.startsWith("7") ? "+" + v : v.startsWith("8") ? "+7" + v.slice(1) : "+7" + v;
                    }
                    if (v.length > 12) v = v.slice(0, 12); // +7 + 10 цифр = 12 символов
                    setFormPhone(v);
                  }}
                  placeholder="+7XXXXXXXXXX"
                  maxLength={12}
                />
                {formPhone && formPhone.length > 0 && formPhone.length < 12 && (
                  <p className="text-xs text-amber-600">Введите 10 цифр после +7</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-note">Заметка</Label>
              <Input
                id="emp-note"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="Дополнительная информация..."
              />
            </div>
            <div className="space-y-2">
              <Label>Компания</Label>
              {user?.role === "ADMIN" && user?.companyId ? (
                <div className="flex items-center h-10 px-3 rounded-md border bg-slate-50 text-sm text-slate-700">
                  {companies.find((c) => c.id === user.companyId)?.name || "Ваша компания"}
                </div>
              ) : (
                <select
                  className="w-full h-10 px-3 border rounded-md text-sm bg-white"
                  value={formCompanyId}
                  onChange={(e) => setFormCompanyId(e.target.value)}
                >
                  <option value="">Выберите компанию</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Отмена
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={saving || !formLastName.trim() || !formFirstName.trim()}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить сотрудника</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить сотрудника &laquo;{deletingEmployee?.fullName}&raquo;?
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
