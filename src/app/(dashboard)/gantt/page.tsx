"use client";

import GanttPage from "@/components/gantt/GanttPage";

export default function GanttPageRoute() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Диаграмма Ганта
        </h1>
        <p className="text-sm text-muted-foreground">
          Визуализация расписания обучения всех групп
        </p>
      </div>
      <div className="h-[calc(100vh-12rem)] border rounded-lg overflow-hidden bg-white">
        <GanttPage />
      </div>
    </div>
  );
}
