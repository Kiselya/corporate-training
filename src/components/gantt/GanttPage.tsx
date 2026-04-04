"use client";

import { useState, useEffect, useMemo } from "react";
import GanttChart, { type GanttGroup } from "./GanttChart";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth, isAdminOrAbove, isSuperAdmin } from "@/lib/auth-context";

interface GanttGroupWithCompany extends GanttGroup {
  companyIds: string[];
}

interface CompanyOption {
  id: string;
  name: string;
}

export default function GanttPage() {
  const { user } = useAuth();
  const [allGroups, setAllGroups] = useState<GanttGroupWithCompany[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [companySearch, setCompanySearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isUser = user && !isAdminOrAbove(user.role);

    if (isUser) {
      fetch("/api/auth/my-profile")
        .then((r) => r.json())
        .then((profileData) => {
          if (!profileData.groups || profileData.groups.length === 0) {
            setAllGroups([]);
            return;
          }
          const mapped: GanttGroupWithCompany[] = profileData.groups.map((g: any) => ({
            id: g.id,
            name: g.name || g.course?.name || "Без названия",
            courseName: g.course?.name || "—",
            startDate: g.startDate,
            endDate: g.endDate,
            status: g.status,
            memberCount: g.memberCount ?? 0,
            totalCost: g.pricePerPerson * (g.memberCount ?? 0),
            avgProgress: g.avgProgress ?? 0,
            pricePerPerson: g.pricePerPerson,
            companyIds: [],
          }));
          setAllGroups(mapped);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        fetch("/api/groups").then((r) => r.json()),
        fetch("/api/companies").then((r) => r.json()),
      ])
        .then(([data, comps]) => {
          const mapped: GanttGroupWithCompany[] = data.map((g: any) => ({
            id: g.id,
            name: g.name || g.course?.name || "Без названия",
            courseName: g.course?.name || "—",
            startDate: g.startDate,
            endDate: g.endDate,
            status: g.status,
            memberCount: g.memberCount ?? g.members?.length ?? 0,
            totalCost: g.totalCost ?? (g.pricePerPerson * (g.memberCount ?? g.members?.length ?? 0)),
            avgProgress: g.avgProgress ?? 0,
            pricePerPerson: g.pricePerPerson,
            companyIds: g.companyIds || [],
          }));
          setAllGroups(mapped);
          // ADMIN видит только свою компанию в фильтре
          const allComps = comps.map((c: any) => ({ id: c.id, name: c.name }));
          if (user?.role === "ADMIN" && user?.companyId) {
            setCompanies(allComps.filter((c: CompanyOption) => c.id === user.companyId));
          } else {
            setCompanies(allComps);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user]);

  const toggleCompany = (id: string) => {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredGroups = useMemo(() => {
    if (selectedCompanyIds.size === 0) return allGroups;
    return allGroups.filter((g) =>
      g.companyIds.some((cId) => selectedCompanyIds.has(cId))
    );
  }, [allGroups, selectedCompanyIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (allGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">
          Нет учебных групп для отображения. Создайте первую группу.
        </CardContent>
      </Card>
    );
  }

  const isAdmin = user && isAdminOrAbove(user.role);

  return (
    <div className="flex flex-col gap-3 flex-1">
      {/* Фильтр по компании — только для ADMIN/SUPER_ADMIN */}
      {isAdmin && companies.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-1 pt-1 print:hidden">
          <span className="text-sm font-medium text-slate-600 shrink-0">Компания:</span>
          <input
            type="text"
            placeholder="Поиск компании..."
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            className="h-7 px-2 text-xs border rounded-md w-44"
          />
          <button
            onClick={() => setSelectedCompanyIds(new Set())}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors shrink-0 ${
              selectedCompanyIds.size === 0
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Все
          </button>
          {companies
            .filter((c) => !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase()))
            .map((c) => (
            <button
              key={c.id}
              onClick={() => toggleCompany(c.id)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors shrink-0 ${
                selectedCompanyIds.has(c.id)
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <Card className="flex-1 overflow-hidden">
        <GanttChart groups={filteredGroups} readOnly={user ? !isAdminOrAbove(user.role) : false} showFinancials={isSuperAdmin(user?.role)} />
      </Card>
    </div>
  );
}
