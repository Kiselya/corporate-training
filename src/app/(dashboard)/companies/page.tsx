"use client";

/**
 * Страница управления компаниями
 *
 * Функционал:
 * - Таблица компаний с кол-вом сотрудников (считается автоматически)
 * - Создание/редактирование: код, название, реквизиты (ИНН, КПП, ОГРН, адрес)
 * - Динамические пользовательские поля (JSON customFields)
 *   Пользователь может добавлять произвольные поля без изменения схемы БД
 */

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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, X, Search, SlidersHorizontal } from "lucide-react";

interface Company {
  id: string;
  code: string;
  name: string;
  erpId: number | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  customFields: Record<string, string> | null;
  createdAt: string;
  _count: {
    employees: number;
    specifications: number;
  };
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields — основные
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  // Form fields — реквизиты
  const [formInn, setFormInn] = useState("");
  const [formKpp, setFormKpp] = useState("");
  const [formOgrn, setFormOgrn] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formContactPerson, setFormContactPerson] = useState("");
  // Form fields — пользовательские
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);
  const [newFieldKey, setNewFieldKey] = useState("");

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Поиск и сортировка
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"name" | "code" | "employees" | "date">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filteredCompanies = useMemo(() => {
    let result = [...companies];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.inn || "").includes(q) ||
          (c.contactPerson || "").toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name, "ru");
          break;
        case "code":
          cmp = a.code.localeCompare(b.code);
          break;
        case "employees":
          cmp = (a._count?.employees ?? 0) - (b._count?.employees ?? 0);
          break;
        case "date":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [companies, searchQuery, sortField, sortDir]);

  function toggleSort(field: "name" | "code" | "employees" | "date") {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/companies");
      if (res.ok) setCompanies(await res.json());
    } catch (error) {
      console.error("Ошибка загрузки:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  function resetForm() {
    setFormCode("");
    setFormName("");
    setFormInn("");
    setFormKpp("");
    setFormOgrn("");
    setFormAddress("");
    setFormPhone("");
    setFormEmail("");
    setFormContactPerson("");
    setCustomFields([]);
    setNewFieldKey("");
  }

  function openCreateDialog() {
    setEditingCompany(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(company: Company) {
    setEditingCompany(company);
    setFormCode(company.code);
    setFormName(company.name);
    setFormInn(company.inn || "");
    setFormKpp(company.kpp || "");
    setFormOgrn(company.ogrn || "");
    setFormAddress(company.address || "");
    setFormPhone(company.phone || "");
    setFormEmail(company.email || "");
    setFormContactPerson(company.contactPerson || "");
    // Преобразуем JSON customFields в массив { key, value }
    const cf = company.customFields || {};
    setCustomFields(Object.entries(cf).map(([key, value]) => ({ key, value: String(value) })));
    setNewFieldKey("");
    setDialogOpen(true);
  }

  function addCustomField() {
    const key = newFieldKey.trim();
    if (!key) return;
    if (customFields.some((f) => f.key === key)) return; // дубликат
    setCustomFields([...customFields, { key, value: "" }]);
    setNewFieldKey("");
  }

  function updateCustomField(index: number, value: string) {
    setCustomFields((prev) => prev.map((f, i) => (i === index ? { ...f, value } : f)));
  }

  function removeCustomField(index: number) {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);

    // Собираем customFields обратно в JSON объект
    const cfObj: Record<string, string> = {};
    for (const f of customFields) {
      if (f.key.trim()) cfObj[f.key.trim()] = f.value;
    }

    const payload = {
      code: formCode,
      name: formName,
      inn: formInn || null,
      kpp: formKpp || null,
      ogrn: formOgrn || null,
      address: formAddress || null,
      phone: formPhone || null,
      email: formEmail || null,
      contactPerson: formContactPerson || null,
      customFields: cfObj,
    };

    try {
      if (editingCompany) {
        await fetch(`/api/companies/${editingCompany.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setDialogOpen(false);
      await fetchCompanies();
    } catch (error) {
      console.error("Ошибка сохранения:", error);
    } finally {
      setSaving(false);
    }
  }

  function openDeleteDialog(company: Company) {
    setDeletingCompany(company);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingCompany) return;
    setDeleting(true);
    try {
      await fetch(`/api/companies/${deletingCompany.id}`, { method: "DELETE" });
      setDeleteDialogOpen(false);
      setDeletingCompany(null);
      await fetchCompanies();
    } catch (error) {
      console.error("Ошибка удаления:", error);
    } finally {
      setDeleting(false);
    }
  }

  // Подсчёт заполненных полей у компании (для бейджика)
  function filledFieldsCount(c: Company): number {
    let count = 0;
    if (c.inn) count++;
    if (c.kpp) count++;
    if (c.ogrn) count++;
    if (c.address) count++;
    if (c.phone) count++;
    if (c.email) count++;
    if (c.contactPerson) count++;
    const cf = c.customFields || {};
    count += Object.keys(cf).length;
    return count;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Компании
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Справочник организаций с реквизитами
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-1.5 h-4 w-4" />
          Добавить компанию
        </Button>
      </div>

      {/* Поиск и сортировка */}
      {companies.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию, коду, ИНН или контакту..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {([
              { field: "name" as const, label: "Название" },
              { field: "code" as const, label: "Код" },
              { field: "employees" as const, label: "Сотрудники" },
              { field: "date" as const, label: "Дата" },
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
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-slate-500">
                {searchQuery ? "Ничего не найдено. Попробуйте изменить запрос." : "Компании не найдены"}
              </p>
              {!searchQuery && (
                <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Добавить первую компанию
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Код</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>ИНН</TableHead>
                  <TableHead>Контакт</TableHead>
                  <TableHead className="text-center">Доп. поля</TableHead>
                  <TableHead>Добавлена</TableHead>
                  <TableHead className="text-right">Сотрудников</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-mono text-sm">{company.code}</TableCell>
                    <TableCell
                      className="font-medium text-blue-600 cursor-pointer hover:underline"
                      onClick={() => window.location.href = `/companies/${company.id}`}
                    >{company.name}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {company.inn || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {company.contactPerson || company.phone || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {filledFieldsCount(company) > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {filledFieldsCount(company)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(company.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right">{company._count.employees}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(company)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(company)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
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

      {/* ─── Диалог создания/редактирования ────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Редактировать компанию" : "Новая компания"}
            </DialogTitle>
            <DialogDescription>
              Заполните основные данные и реквизиты. Добавьте свои поля на вкладке «Дополнительные».
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="main" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="main">Основное</TabsTrigger>
              <TabsTrigger value="requisites">Реквизиты</TabsTrigger>
              <TabsTrigger value="custom">
                Дополнительные
                {customFields.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs">
                    {customFields.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Вкладка: Основное */}
            <TabsContent value="main" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Название компании *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder='ООО "ТехноПром"'
                />
              </div>
              <div className="space-y-2">
                <Label>Код</Label>
                <Input
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="Сгенерируется автоматически (напр. TEH-001)"
                />
                <p className="text-xs text-slate-400">
                  Оставьте пустым — система создаст код из названия. Или введите свой.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Контактное лицо</Label>
                  <Input
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                    placeholder="Иванов И.И."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Телефон</Label>
                  <Input
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="info@company.ru"
                  type="email"
                />
              </div>
            </TabsContent>

            {/* Вкладка: Реквизиты */}
            <TabsContent value="requisites" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>ИНН</Label>
                  <Input
                    value={formInn}
                    onChange={(e) => setFormInn(e.target.value)}
                    placeholder="1234567890"
                    maxLength={12}
                  />
                </div>
                <div className="space-y-2">
                  <Label>КПП</Label>
                  <Input
                    value={formKpp}
                    onChange={(e) => setFormKpp(e.target.value)}
                    placeholder="123456789"
                    maxLength={9}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ОГРН</Label>
                  <Input
                    value={formOgrn}
                    onChange={(e) => setFormOgrn(e.target.value)}
                    placeholder="1234567890123"
                    maxLength={15}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Юридический адрес</Label>
                <Input
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="г. Москва, ул. Примерная, д. 1"
                />
              </div>
            </TabsContent>

            {/* Вкладка: Дополнительные (пользовательские) поля */}
            <TabsContent value="custom" className="space-y-4 mt-4">
              <p className="text-sm text-slate-500">
                Добавьте любые дополнительные поля. Например: расчётный счёт, банк, БИК, примечание.
              </p>

              {/* Существующие кастомные поля */}
              {customFields.map((field, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-40 shrink-0">
                    <span className="text-sm font-medium text-slate-700">{field.key}</span>
                  </div>
                  <Input
                    value={field.value}
                    onChange={(e) => updateCustomField(i, e.target.value)}
                    placeholder="Значение..."
                    className="flex-1"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeCustomField(i)}>
                    <X className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              ))}

              {/* Добавление нового поля */}
              <Separator />
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label>Название нового поля</Label>
                  <Input
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    placeholder="Например: Расчётный счёт"
                    onKeyDown={(e) => e.key === "Enter" && addCustomField()}
                  />
                </div>
                <Button variant="outline" onClick={addCustomField} disabled={!newFieldKey.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Добавить
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <DialogClose render={<Button variant="outline" />}>
              Отмена
            </DialogClose>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Диалог подтверждения удаления ─────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить компанию</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить компанию «{deletingCompany?.name}»?
              Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Отмена
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
