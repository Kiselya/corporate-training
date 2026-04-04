"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileInput, Loader2 } from "lucide-react";
import { useAuth, isAdminOrAbove } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface LogEntry {
  id: string;
  action: string;
  entityType: string;
  fileName: string | null;
  recordsCreated: number;
  recordsUpdated: number;
  recordsErrored: number;
  details: unknown;
  userId: string | null;
  userName: string;
  createdAt: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionLabel(action: string): string {
  switch (action) {
    case "import":
      return "Импорт";
    case "export":
      return "Экспорт";
    default:
      return action;
  }
}

function entityTypeLabel(entityType: string): string {
  switch (entityType) {
    case "Edu_Participant":
      return "Сотрудники";
    case "Edu_Course":
      return "Курсы";
    case "TrainingGroup":
      return "Группа";
    default:
      return entityType;
  }
}

export default function IntegrationLogPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !isAdminOrAbove(user.role))) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/integration-log");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && isAdminOrAbove(user.role)) {
      fetchLogs();
    }
  }, [user, fetchLogs]);

  if (authLoading || !user || !isAdminOrAbove(user.role)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileInput className="h-6 w-6 text-slate-700" />
        <h1 className="text-2xl font-bold tracking-tight">Лог интеграции</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Последние операции ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Операции интеграции пока не выполнялись
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Действие</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Файл</TableHead>
                  <TableHead>Создано</TableHead>
                  <TableHead>Обновлено</TableHead>
                  <TableHead>Ошибки</TableHead>
                  <TableHead>Пользователь</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const hasErrors = log.recordsErrored > 0;
                  const hasSuccess = log.recordsCreated > 0 || log.recordsUpdated > 0;

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            log.action === "import"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }
                        >
                          {actionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {entityTypeLabel(log.entityType)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {log.fileName || "—"}
                      </TableCell>
                      <TableCell>
                        {log.recordsCreated > 0 ? (
                          <span className="font-medium text-green-600">
                            {log.recordsCreated}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.recordsUpdated > 0 ? (
                          <span className="font-medium text-blue-600">
                            {log.recordsUpdated}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasErrors ? (
                          <span className="font-medium text-red-600">
                            {log.recordsErrored}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.userName || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
