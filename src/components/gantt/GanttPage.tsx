"use client";

import { useState, useEffect } from "react";
import GanttChart, { type GanttGroup } from "./GanttChart";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth, isAdminOrAbove } from "@/lib/auth-context";

export default function GanttPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GanttGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isUser = user && !isAdminOrAbove(user.role);

    if (isUser) {
      // Для USER: загружаем только свои группы через my-profile
      fetch("/api/auth/my-profile")
        .then((r) => r.json())
        .then((profileData) => {
          if (!profileData.groups || profileData.groups.length === 0) {
            setGroups([]);
            return;
          }
          const mapped: GanttGroup[] = profileData.groups.map((g: any) => ({
            id: g.id,
            name: g.name || `Группа #${g.id.slice(0, 6)}`,
            courseName: g.course?.name || "—",
            startDate: g.startDate,
            endDate: g.endDate,
            status: g.status,
            memberCount: g.memberCount ?? 0,
            totalCost: g.pricePerPerson * (g.memberCount ?? 0),
            avgProgress: g.avgProgress ?? 0,
            pricePerPerson: g.pricePerPerson,
          }));
          setGroups(mapped);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      // Для ADMIN/SUPER_ADMIN: загружаем все группы
      fetch("/api/groups")
        .then((r) => r.json())
        .then((data) => {
          const mapped: GanttGroup[] = data.map((g: any) => ({
            id: g.id,
            name: g.name || `Группа #${g.id.slice(0, 6)}`,
            courseName: g.course?.name || "—",
            startDate: g.startDate,
            endDate: g.endDate,
            status: g.status,
            memberCount: g.memberCount ?? g.members?.length ?? 0,
            totalCost: g.totalCost ?? (g.pricePerPerson * (g.memberCount ?? g.members?.length ?? 0)),
            avgProgress: g.avgProgress ?? 0,
            pricePerPerson: g.pricePerPerson,
          }));
          setGroups(mapped);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">
          Нет учебных групп для отображения. Создайте первую группу.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex-1 overflow-hidden">
      <GanttChart groups={groups} readOnly={user ? !isAdminOrAbove(user.role) : false} />
    </Card>
  );
}
