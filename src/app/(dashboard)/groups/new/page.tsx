"use client";

/**
 * Страница создания учебной группы
 *
 * Основной пользовательский сценарий (из ТЗ):
 * 1. Выбрать курс обучения → автоматически подтягивается цена и длительность
 * 2. Задать название группы
 * 3. Выбрать дату начала → дата окончания рассчитывается автоматически
 * 4. Выбрать сотрудников из справочника (с поиском и фильтром по компании)
 * 5. Система автоматически рассчитывает стоимость = цена × кол-во участников
 * 6. Сохранить → переход к карточке группы
 *
 * Расчёт стоимости обучения (real-time):
 * totalCost = pricePerPerson × selectedEmployees.length
 * Обновляется при каждом добавлении/удалении сотрудника
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Calculator, Calendar, Users, Search, Check } from "lucide-react";
import { pluralizeDays } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Course {
  id: string;
  name: string;
  durationDays: number;
  pricePerPerson: number;
  description: string;
}

interface Employee {
  id: string;
  fullName: string;
  email: string;
  company: { id: string; name: string } | null;
}

function formatRubles(v: number) {
  return new Intl.NumberFormat("ru-RU").format(v) + " ₽";
}

/**
 * Расчёт даты окончания с учётом рабочих дней (пн-пт)
 * Пропускает субботы и воскресенья
 */
function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days - 1) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      added++;
    }
  }
  return result;
}

export default function NewGroupPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);

  // Форма
  const [name, setName] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  // Поиск и фильтры для участников
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  // Загрузка справочников
  useEffect(() => {
    fetch("/api/courses").then((r) => r.json()).then(setCourses);
    fetch("/api/employees").then((r) => r.json()).then(setEmployees);
  }, []);

  // Автовычисление даты окончания при изменении курса или даты начала
  useEffect(() => {
    if (selectedCourse && startDate) {
      const end = addBusinessDays(new Date(startDate), selectedCourse.durationDays);
      setEndDate(end.toISOString().split("T")[0]);
    }
  }, [selectedCourseId, startDate, selectedCourse]);

  // Уникальные компании для фильтра
  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employees) {
      if (emp.company) {
        map.set(emp.company.id, emp.company.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [employees]);

  // Фильтрация списка участников
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Поиск по ФИО и email
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = emp.fullName.toLowerCase().includes(q);
        const matchEmail = emp.email?.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      // Фильтр по компании
      if (companyFilter !== "all") {
        if (emp.company?.id !== companyFilter) return false;
      }
      return true;
    });
  }, [employees, searchQuery, companyFilter]);

  /**
   * Расчёт стоимости обучения (бизнес-логика)
   * Формула: цена курса за человека × количество выбранных сотрудников
   */
  const totalCost = selectedCourse
    ? selectedCourse.pricePerPerson * selectedEmployees.length
    : 0;

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  // Валидация дат
  const dateError = useMemo(() => {
    if (startDate && endDate) {
      if (new Date(endDate) < new Date(startDate)) {
        return "Дата окончания не может быть раньше даты начала";
      }
    }
    return null;
  }, [startDate, endDate]);

  const canSubmit =
    selectedCourseId &&
    startDate &&
    endDate &&
    !dateError &&
    selectedEmployees.length > 0 &&
    !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          courseId: selectedCourseId,
          startDate,
          endDate,
          pricePerPerson: selectedCourse!.pricePerPerson,
          memberIds: selectedEmployees,
        }),
      });
      const data = await res.json();
      router.push(`/groups/${data.id}`);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/groups")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Назад
        </Button>
        <h1 className="text-2xl font-bold text-slate-800">Создание учебной группы</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основная форма */}
        <div className="lg:col-span-2 space-y-6">
          {/* Параметры обучения */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Параметры обучения
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Название группы (опционально)</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Группа БА-2026-02"
                />
              </div>

              <div>
                <Label>Курс обучения *</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md text-sm bg-white"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                >
                  <option value="">Выберите курс...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {formatRubles(c.pricePerPerson)}/чел, {pluralizeDays(c.durationDays)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCourse && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                  <strong>{selectedCourse.name}</strong>
                  <p className="mt-1 text-blue-600">{selectedCourse.description}</p>
                  <div className="mt-2 flex gap-4">
                    <span>Длительность: {pluralizeDays(selectedCourse.durationDays)}</span>
                    <span>Цена: {formatRubles(selectedCourse.pricePerPerson)} / чел.</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Дата начала *</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Дата окончания *</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || undefined}
                  />
                  {selectedCourse && startDate && !dateError && (
                    <p className="text-xs text-slate-500 mt-1">
                      Рассчитано автоматически: {pluralizeDays(selectedCourse.durationDays)} (рабочих). Можно изменить.
                    </p>
                  )}
                  {dateError && (
                    <p className="text-xs text-red-500 mt-1">{dateError}</p>
                  )}
                  {!endDate && startDate && (
                    <p className="text-xs text-amber-500 mt-1">
                      Выберите курс — дата рассчитается автоматически
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Выбор сотрудников */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Участники обучения
                <Badge variant="secondary" className="ml-2">
                  {selectedEmployees.length} выбрано
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Поиск и фильтры */}
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
                  className="h-10 px-3 border rounded-md text-sm bg-white min-w-[180px]"
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                >
                  <option value="all">Все компании</option>
                  {companyOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Быстрые действия: выбрать всех / снять выделение */}
              {filteredEmployees.length > 0 && (
                <div className="flex gap-2 text-xs">
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      const ids = filteredEmployees.map((e) => e.id);
                      setSelectedEmployees((prev) => [...new Set([...prev, ...ids])]);
                    }}
                  >
                    Выбрать всех ({filteredEmployees.length})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    className="text-slate-500 hover:underline"
                    onClick={() => {
                      const ids = new Set(filteredEmployees.map((e) => e.id));
                      setSelectedEmployees((prev) => prev.filter((id) => !ids.has(id)));
                    }}
                  >
                    Снять выделение
                  </button>
                </div>
              )}

              {/* Список сотрудников */}
              <div className="space-y-1.5 max-h-[400px] overflow-auto">
                {filteredEmployees.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    {searchQuery || companyFilter !== "all"
                      ? "Никого не найдено. Попробуйте изменить фильтры."
                      : "Нет сотрудников. Добавьте их в справочнике."}
                  </p>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected = selectedEmployees.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50 border-blue-300"
                            : "hover:bg-slate-50 border-slate-200"
                        }`}
                        onClick={() => toggleEmployee(emp.id)}
                      >
                        {/* Чекбокс */}
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                            isSelected
                              ? "border-blue-600 bg-blue-600"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                        </div>
                        {/* ФИО и компания */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{emp.fullName}</div>
                          <div className="text-xs text-slate-500">
                            {emp.company?.name || "Без компании"}
                            {emp.email ? ` · ${emp.email}` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Боковая панель — расчёт стоимости */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-green-600" />
                Расчёт стоимости
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Цена за человека</span>
                <span className="font-medium">
                  {selectedCourse ? formatRubles(selectedCourse.pricePerPerson) : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Участников</span>
                <span className="font-medium">{selectedEmployees.length}</span>
              </div>
              <Separator />
              {/* Формула расчёта: цена × участники */}
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Формула</span>
                <span className="text-xs text-slate-400">
                  {selectedCourse ? formatRubles(selectedCourse.pricePerPerson) : "0"} × {selectedEmployees.length}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Итого</span>
                <span className="text-green-700">{formatRubles(totalCost)}</span>
              </div>

              <Separator />

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {saving ? "Сохранение..." : "Создать группу"}
              </Button>

              {!canSubmit && !saving && (
                <div className="text-xs text-amber-600 text-center space-y-0.5">
                  {!selectedCourseId && <p>Выберите курс</p>}
                  {!startDate && <p>Укажите дату начала</p>}
                  {!endDate && <p>Укажите дату окончания</p>}
                  {dateError && <p>{dateError}</p>}
                  {selectedEmployees.length === 0 && <p>Выберите хотя бы одного участника</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
