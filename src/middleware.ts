import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "hackathon-secret-2026"
);

// Маршруты, доступные без авторизации
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/seed",
  "/_next",
  "/favicon",
];

// Маршруты, доступные при mustChangePassword (помимо смены пароля)
const CHANGE_PASSWORD_ALLOWED = [
  "/change-password",
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/auth/me",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Пропускаем публичные маршруты
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Пропускаем статические файлы
  if (
    pathname.includes(".") &&
    !pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  // Чтение JWT из cookie
  const token = request.cookies.get("session")?.value;

  if (!token) {
    // Для API-маршрутов возвращаем 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Необходима авторизация" },
        { status: 401 }
      );
    }
    // Для страниц — редирект на логин
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Верификация JWT (jose совместима с Edge Runtime)
    const { payload } = await jwtVerify(token, SECRET);

    // Проверка обязательной смены пароля
    if (payload.mustChangePassword === true) {
      const isAllowed = CHANGE_PASSWORD_ALLOWED.some((path) =>
        pathname.startsWith(path)
      );

      if (!isAllowed) {
        // Для API-маршрутов — ошибка
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Необходимо сменить пароль" },
            { status: 403 }
          );
        }
        // Для страниц — редирект на смену пароля
        const changePasswordUrl = new URL("/change-password", request.url);
        return NextResponse.redirect(changePasswordUrl);
      }
    }

    // Запрещаем bfcache для HTML-страниц — решает проблему сломанного state при кнопке "Назад"
    const response = NextResponse.next();
    if (!pathname.startsWith("/api/") && !pathname.startsWith("/_next")) {
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    }
    return response;
  } catch {
    // Невалидный или просроченный токен
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Невалидная сессия" },
        { status: 401 }
      );
    }

    // Удаляем невалидный cookie и редиректим на логин
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set("session", "", { maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Применяем middleware ко всем маршрутам, кроме:
     * - _next/static (статические файлы)
     * - _next/image (оптимизация изображений)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
