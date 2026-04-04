"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileUp, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FileResult {
  filename: string;
  type: string | null;
  created: number;
  updated: number;
  errors: string[];
}

interface ImportResponse {
  results: FileResult[];
  totalCreated: number;
  totalUpdated: number;
  totalErrors: number;
  error?: string;
}

interface XmlImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function XmlImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: XmlImportDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ImportResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFiles([]);
    setResults(null);
    setUploading(false);
    setDragOver(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        reset();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset]
  );

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const xmlFiles = Array.from(newFiles).filter(
      (f) => f.name.endsWith(".xml") || f.type === "text/xml" || f.type === "application/xml"
    );
    setFiles((prev) => [...prev, ...xmlFiles]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [addFiles]
  );

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    setUploading(true);
    setResults(null);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const res = await fetch("/api/xml/import", {
        method: "POST",
        body: formData,
      });

      const data: ImportResponse = await res.json();

      if (!res.ok) {
        setResults({
          results: [],
          totalCreated: 0,
          totalUpdated: 0,
          totalErrors: 1,
          error: data.error || "Ошибка загрузки",
        });
      } else {
        setResults(data);
        if (data.totalErrors === 0 && onSuccess) {
          onSuccess();
        }
      }
    } catch (err) {
      setResults({
        results: [],
        totalCreated: 0,
        totalUpdated: 0,
        totalErrors: 1,
        error: "Ошибка сети при загрузке файлов",
      });
    } finally {
      setUploading(false);
    }
  }, [files, onSuccess]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Импорт XML</DialogTitle>
          <DialogDescription>
            Загрузите один или несколько XML-файлов формата Edu_Participant или Edu_Course.
          </DialogDescription>
        </DialogHeader>

        {/* Drag & Drop Zone */}
        {!results && (
          <>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
                dragOver
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400"
              }`}
            >
              <Upload
                className={`h-8 w-8 ${dragOver ? "text-blue-500" : "text-slate-400"}`}
              />
              <p className="text-sm text-muted-foreground">
                Перетащите XML файлы сюда
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-4 w-4" />
                Выбрать файлы
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xml,text/xml,application/xml"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Selected files list */}
            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Выбрано файлов: {files.length}
                </p>
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded bg-slate-50 px-3 py-1.5 text-sm"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="ml-2 shrink-0 text-xs text-red-500 hover:text-red-700"
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Импортировать {files.length}{" "}
                      {files.length === 1
                        ? "файл"
                        : files.length < 5
                          ? "файла"
                          : "файлов"}
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-4">
            {results.error && !results.results.length && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <XCircle className="h-4 w-4 shrink-0" />
                {results.error}
              </div>
            )}

            {results.results.length > 0 && (
              <>
                {/* Summary */}
                <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-3 text-sm">
                  <span>
                    Создано:{" "}
                    <span className="font-medium text-green-600">
                      {results.totalCreated}
                    </span>
                  </span>
                  <span>
                    Обновлено:{" "}
                    <span className="font-medium text-blue-600">
                      {results.totalUpdated}
                    </span>
                  </span>
                  <span>
                    Ошибок:{" "}
                    <span
                      className={`font-medium ${
                        results.totalErrors > 0 ? "text-red-600" : "text-muted-foreground"
                      }`}
                    >
                      {results.totalErrors}
                    </span>
                  </span>
                </div>

                {/* Per-file results */}
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {results.results.map((fileResult, index) => {
                    const hasErrors = fileResult.errors.length > 0;
                    const isSuccess =
                      !hasErrors &&
                      (fileResult.created > 0 || fileResult.updated > 0);

                    return (
                      <div
                        key={`${fileResult.filename}-${index}`}
                        className={`rounded-lg border p-3 text-sm ${
                          hasErrors
                            ? "border-red-200 bg-red-50"
                            : "border-green-200 bg-green-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {hasErrors ? (
                            <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                          )}
                          <span className="font-medium truncate">
                            {fileResult.filename}
                          </span>
                          {fileResult.type && (
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                              {fileResult.type}
                            </span>
                          )}
                        </div>
                        {isSuccess && (
                          <p className="mt-1 ml-6 text-xs text-muted-foreground">
                            Создано: {fileResult.created}, Обновлено:{" "}
                            {fileResult.updated}
                          </p>
                        )}
                        {hasErrors &&
                          fileResult.errors.map((err, errIdx) => (
                            <p
                              key={errIdx}
                              className="mt-1 ml-6 text-xs text-red-600"
                            >
                              {err}
                            </p>
                          ))}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <Button
              variant="outline"
              onClick={reset}
              className="w-full"
            >
              Загрузить ещё
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
