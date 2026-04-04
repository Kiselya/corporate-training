"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Неверный email или пароль");
        return;
      }

      const data = await res.json();

      if (data.mustChangePassword) {
        window.location.href = "/change-password";
      } else {
        window.location.href = "/";
      }
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md px-4">
      {/* Gradient accent line */}
      <div className="mx-auto max-w-md mb-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-t-lg" />
      <Card className="rounded-t-none pt-2">
        <CardHeader className="text-center px-8 pt-6">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl">Корпоративное обучение</CardTitle>
          <CardDescription>Платформа обучения · Global ERP</CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Войти
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/register"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Есть инвайт-ссылка? Зарегистрироваться
            </Link>
          </div>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs text-slate-400">
        &copy; 2026 Global ERP &mdash; Экосистема СТИК
      </p>
    </div>
  );
}
