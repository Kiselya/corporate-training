"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Calendar, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PLANNED: { label: "Планируется", className: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "В процессе", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Завершено", className: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Отменено", className: "bg-red-100 text-red-700" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface GroupData {
  id: string;
  name: string | null;
  startDate: string;
  endDate: string;
  status: string;
  course: { name: string; code: string | null };
  myProgress: number;
  avgProgress: number;
  memberCount: number;
  members: { fullName: string; progressPercent: number }[];
}

export default function MyGroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/my-profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.groups) {
          setGroups(data.groups.map((g: any) => ({
            id: g.id,
            name: g.name,
            startDate: g.startDate,
            endDate: g.endDate,
            status: g.status,
            course: g.course || { name: "—", code: null },
            myProgress: g.myProgress ?? 0,
            avgProgress: g.avgProgress ?? 0,
            memberCount: g.memberCount ?? 0,
            members: g.members || [],
          })));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Мои учебные группы</h1>
        <p className="mt-1 text-sm text-slate-500">Группы, в которых вы участвуете</p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            Вы пока не записаны ни в одну учебную группу.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const statusCfg = STATUS_CONFIG[group.status] || STATUS_CONFIG.PLANNED;
            return (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {group.name || group.course.name}
                      </CardTitle>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5" />
                          {group.course.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(group.startDate)} — {formatDate(group.endDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {group.memberCount} участн.
                        </span>
                      </div>
                    </div>
                    <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Мой прогресс */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">Мой прогресс</span>
                      <span className="font-semibold">{group.myProgress}%</span>
                    </div>
                    <Progress value={group.myProgress} className="h-2.5" />
                  </div>

                  {/* Участники группы */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">
                      Участники ({group.members.length})
                    </h4>
                    <div className="space-y-1.5">
                      {group.members.map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700">{m.fullName}</span>
                          <div className="flex items-center gap-2">
                            <Progress value={m.progressPercent} className="h-1.5 w-20" />
                            <span className="text-xs text-slate-500 w-8 text-right">{m.progressPercent}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
