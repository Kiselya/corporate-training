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
import { Separator } from "@/components/ui/separator";
import { Plus, Check, Trash2, Pencil, Lock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

interface Company {
  id: string;
  code: string;
  name: string;
}

interface TrainingGroup {
  id: string;
  name: string | null;
  pricePerPerson: number;
  memberCount: number;
  totalCost: number;
  course: {
    id: string;
    name: string;
  };
  members: unknown[];
}

const SPEC_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  FORMED: { label: "Сформирован", className: "bg-slate-100 text-slate-700" },
  ISSUED: { label: "Выставлен", className: "bg-blue-100 text-blue-700" },
  PENDING: { label: "Ждет уточнения", className: "bg-amber-100 text-amber-700" },
  PAID: { label: "Оплачен", className: "bg-green-100 text-green-700" },
  ARCHIVED: { label: "В архиве", className: "bg-purple-100 text-purple-700" },
};

interface Specification {
  id: string;
  number: string;
  date: string;
  companyId: string;
  status: string;
  company: Company;
  trainingGroups: TrainingGroup[];
  subtotal: number;
  vat: number;
  total: number;
}

interface GroupOption {
  id: string;
  name: string | null;
  pricePerPerson: number;
  memberCount: number;
  totalCost: number;
  course: { name: string };
  members: unknown[];
}

export default function SpecificationsPage() {
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allGroups, setAllGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Specification | null>(null);
  const [formNumber, setFormNumber] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formCompanyId, setFormCompanyId] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Поиск и фильтр
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: specifications.length };
    for (const s of specifications) {
      counts[s.status] = (counts[s.status] || 0) + 1;
    }
    return counts;
  }, [specifications]);

  const filteredSpecs = useMemo(() => {
    let result = [...specifications];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.number.toLowerCase().includes(q) ||
          s.company.name.toLowerCase().includes(q) ||
          formatDate(s.date).includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    return result;
  }, [specifications, searchQuery, statusFilter]);

  const fetchData = useCallback(async () => {
    try {
      const [specRes, compRes, grpRes] = await Promise.all([
        fetch("/api/specifications"),
        fetch("/api/companies"),
        fetch("/api/groups"),
      ]);
      if (specRes.ok) setSpecifications(await specRes.json());
      if (compRes.ok) setCompanies(await compRes.json());
      if (grpRes.ok) setAllGroups(await grpRes.json());
    } catch (error) {
      console.error("Ошибка загрузки:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreateDialog() {
    setEditingSpec(null);
    setFormNumber("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormCompanyId(null);
    setSelectedGroupIds(new Set());
    setDialogOpen(true);
  }

  function openEditDialog(spec: Specification) {
    setEditingSpec(spec);
    setFormNumber(spec.number);
    setFormDate(spec.date.split("T")[0]);
    setFormCompanyId(spec.companyId);
    setSelectedGroupIds(new Set(spec.trainingGroups.map((g) => g.id)));
    setDialogOpen(true);
  }

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  // Compute client-side totals for selected groups in dialog
  const selectedGroups = allGroups.filter((g) => selectedGroupIds.has(g.id));
  const dialogSubtotal = selectedGroups.reduce((sum, g) => {
    const memberCount = g.memberCount ?? g.members?.length ?? 0;
    return sum + g.pricePerPerson * memberCount;
  }, 0);
  const dialogVat = Math.round(dialogSubtotal * 0.22 * 100) / 100;
  const dialogTotal = Math.round((dialogSubtotal + dialogVat) * 100) / 100;

  async function handleSave() {
    if (!formNumber.trim() || !formDate || !formCompanyId) return;
    setSaving(true);
    try {
      if (editingSpec) {
        await fetch(`/api/specifications/${editingSpec.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: formNumber,
            date: formDate,
            companyId: formCompanyId,
            groupIds: Array.from(selectedGroupIds),
          }),
        });
      } else {
        await fetch("/api/specifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: formNumber,
            date: formDate,
            companyId: formCompanyId,
            groupIds: Array.from(selectedGroupIds),
          }),
        });
      }
      setDialogOpen(false);
      await fetchData();
    } catch (error) {
      console.error("Ошибка сохранения:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(specId: string) {
    if (!confirm("Удалить спецификацию? Это действие необратимо.")) return;
    try {
      await fetch(`/api/specifications/${specId}`, { method: "DELETE" });
      await fetchData();
    } catch (error) {
      console.error("Ошибка удаления:", error);
    }
  }

  async function handleStatusChange(specId: string, newStatus: string) {
    try {
      await fetch(`/api/specifications/${specId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchData();
    } catch (error) {
      console.error("Ошибка смены статуса:", error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Спецификации
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Документы и спецификации обучения
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-1.5 h-4 w-4" />
          Создать спецификацию
        </Button>
      </div>

      {/* Поиск и фильтр по статусу */}
      {specifications.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по номеру, дате или компании..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: "all", label: "Все" },
              { key: "FORMED", label: "Сформирован" },
              { key: "ISSUED", label: "Выставлен" },
              { key: "PENDING", label: "Ждет уточнения" },
              { key: "PAID", label: "Оплачен" },
              { key: "ARCHIVED", label: "В архиве" },
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
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Загрузка...</p>
            </div>
          ) : filteredSpecs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all" ? "Ничего не найдено. Попробуйте изменить фильтры." : "Спецификации не найдены"}
              </p>
              {!searchQuery && statusFilter === "all" && (
              <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                <Plus className="mr-1.5 h-4 w-4" />
                Создать первую спецификацию
              </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Компания</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Групп</TableHead>
                  <TableHead className="text-right">Без НДС</TableHead>
                  <TableHead className="text-right">НДС 22%</TableHead>
                  <TableHead className="text-right">Итого</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSpecs.map((spec) => {
                  const statusCfg = SPEC_STATUS_CONFIG[spec.status] || SPEC_STATUS_CONFIG.FORMED;
                  return (
                  <TableRow key={spec.id}>
                    <TableCell className="font-mono font-medium">
                      {spec.number}
                    </TableCell>
                    <TableCell>{formatDate(spec.date)}</TableCell>
                    <TableCell>{spec.company.name}</TableCell>
                    <TableCell>
                      <Select
                        value={spec.status}
                        onValueChange={(val) => val && handleStatusChange(spec.id, val)}
                      >
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue>
                            <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SPEC_STATUS_CONFIG).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      {spec.trainingGroups.length}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRubles(spec.subtotal)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRubles(spec.vat)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatRubles(spec.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {spec.status === "PAID" || spec.status === "ARCHIVED" ? (
                        <span className="flex items-center justify-end gap-1 text-xs text-slate-400">
                          <Lock className="h-3.5 w-3.5" /> Закрыт
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(spec)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(spec.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Specification Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSpec ? "Редактировать спецификацию" : "Новая спецификация"}</DialogTitle>
            <DialogDescription>
              {editingSpec ? "Измените данные спецификации" : "Создайте спецификацию с привязкой групп"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="spec-number">Номер</Label>
                <Input
                  id="spec-number"
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  placeholder="SPEC-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spec-date">Дата</Label>
                <Input
                  id="spec-date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Компания</Label>
              <Select
                value={formCompanyId ?? undefined}
                onValueChange={(val) => setFormCompanyId(val as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{formCompanyId ? companies.find(c => c.id === formCompanyId)?.name || "Выберите компанию" : "Выберите компанию"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Учебные группы</Label>
              <div className="max-h-48 overflow-y-auto rounded-md border">
                {allGroups.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                    Нет доступных групп
                  </p>
                ) : (
                  allGroups.map((group) => {
                    const isSelected = selectedGroupIds.has(group.id);
                    const memberCount = group.memberCount ?? group.members?.length ?? 0;
                    return (
                      <div
                        key={group.id}
                        className={`flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-muted/50 ${
                          isSelected ? "bg-primary/5" : ""
                        }`}
                        onClick={() => toggleGroup(group.id)}
                      >
                        <div
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">
                            {group.name || group.course.name}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            ({memberCount} участн.)
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          {formatRubles(group.pricePerPerson * memberCount)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {selectedGroupIds.size > 0 && (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Сумма без НДС:</span>
                  <span className="font-medium">{formatRubles(dialogSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">НДС (22%):</span>
                  <span className="font-medium">{formatRubles(dialogVat)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-medium">Итого с НДС:</span>
                  <span className="font-semibold">{formatRubles(dialogTotal)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Отмена
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !formNumber.trim() ||
                !formDate ||
                !formCompanyId
              }
            >
              {saving ? "Сохранение..." : editingSpec ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
