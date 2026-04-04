# Архитектура решения -- Корпоративное обучение Global ERP

> Хакатон Global ERP -- Раздел 7.4 ТЗ (Архитектурное описание, 1-3 страницы)

---

## 1. Обоснование выбора технологического стека

### Next.js 16 (App Router) vs Django / Flask / Express

| Критерий | Next.js 16 | Django | Express |
|---|---|---|---|
| Диаграмма Ганта (35 баллов) | React/SVG -- интерактивный Ганта с масштабированием, тултипами, real-time прогрессом | Статичный HTML, для интерактивности все равно нужен JS-фронтенд | Нет шаблонизатора, нужен отдельный фронтенд |
| Fullstack в одном проекте | API Routes + React компоненты в одной кодовой базе | Отдельный фронтенд или DRF + SPA | Только бэкенд, фронт -- отдельно |
| Скорость разработки (48 ч) | Файловая маршрутизация, серверные компоненты, Hot Reload | Быстрый бэкенд, медленный фронтенд | Ручная настройка всего |
| Деплой | Один Docker-контейнер (node:20-alpine) | Gunicorn + Nginx + статика | PM2 + Nginx |

**Решение:** Next.js 16 с App Router. Ключевой аргумент -- диаграмма Ганта требует интерактивного SVG (масштабирование, тултипы, клик по полосе, цветовая кодировка статусов). Django отдавал бы статичный HTML, а интерактивность все равно требует JavaScript-фреймворка. Next.js объединяет фронтенд и бэкенд в одном проекте -- критично для 48 часов хакатона.

App Router дает:
- Файловая маршрутизация (`/app/api/groups/[id]/route.ts` -> `GET /api/groups/:id`)
- Server Components для первоначальной загрузки данных
- API Routes без отдельного Express-сервера
- Middleware на Edge Runtime для проверки JWT

### PostgreSQL vs SQLite / MySQL / MongoDB

| Критерий | PostgreSQL | SQLite | MongoDB |
|---|---|---|---|
| Связи | Полноценные FK, каскадное удаление | Ограниченная поддержка FK | Нет JOIN, денормализация |
| JSON-поля | Нативная поддержка `jsonb` | Как TEXT, без индексации | Нативно, но нет FK |
| Масштабируемость | Промышленный стандарт | Один файл, конкурентность ограничена | Горизонтальное масштабирование |
| Развертывание | Любой сервер, Docker, облако | Файл в проекте | Отдельный кластер |

**Решение:** PostgreSQL. Реляционная модель идеально описывает связи: Компания -> Сотрудник -> Группа -> Курс. JSON-поля (`customFields` в Company) дают гибкость без NoSQL. Заказчик может развернуть PostgreSQL на любом сервере -- нет vendor lock-in на SaaS.

### Prisma ORM vs TypeORM / Drizzle / raw SQL

| Критерий | Prisma | TypeORM | Raw SQL |
|---|---|---|---|
| Type safety | Типы генерируются из schema.prisma | Декораторы, ручная синхронизация | Нет типов |
| Миграции | `prisma migrate dev` -- версионирование | Синхронизация или ручные миграции | Ручные миграции |
| Схема | Один файл `schema.prisma` -- вся модель | Разбросана по файлам Entity | Нет единой схемы |
| Скорость разработки | Высокая -- `prisma.user.findMany()` | Средняя -- QueryBuilder | Низкая -- ручной SQL |

**Решение:** Prisma ORM. Один файл `schema.prisma` описывает все 13 моделей данных. TypeScript-типы генерируются автоматически -- IDE подсказывает поля, ловит ошибки на этапе компиляции. Миграции воспроизводимы: `prisma migrate deploy` в Docker.

### shadcn/ui + Tailwind CSS vs MUI / Ant Design / Bootstrap

| Критерий | shadcn/ui | MUI | Bootstrap |
|---|---|---|---|
| Vendor lock-in | Компоненты копируются в проект | npm-зависимость, мажорные обновления ломают | Глобальные стили, конфликты |
| Кастомизация | Полный контроль, Tailwind utility | ThemeProvider, ограниченный override | Переменные SCSS |
| Размер бандла | Только используемые компоненты | Весь пакет @mui/material | Bootstrap.css целиком |
| Бизнес-интерфейсы | Таблицы, формы, диалоги -- все из коробки | Избыточен для HR/бухгалтерии | Устаревший дизайн |

**Решение:** shadcn/ui + Tailwind CSS. Компоненты (Button, Card, Dialog, Table, Select, Badge...) копируются в `src/components/ui/` -- нет зависимости от внешнего пакета. Tailwind дает utility-first подход: быстрая кастомизация под бизнес-интерфейсы без написания CSS-файлов.

### Кастомная диаграмма Ганта (React/SVG) vs dhtmlx-gantt / frappe-gantt

| Критерий | Кастомный SVG | dhtmlx-gantt | frappe-gantt |
|---|---|---|---|
| Прогресс внутри полос | Полный контроль -- заполнение пропорционально % | Ограниченная кастомизация | Нет встроенного прогресса |
| Тултипы с бизнес-данными | Курс, участники, стоимость, прогресс-бар | Базовые тултипы | Только название + даты |
| Масштабирование | Неделя / месяц / квартал с кастомной логикой | Только день / неделя / месяц | Фиксированный масштаб |
| Лицензия | MIT (наш код) | Проприетарная (GPL / коммерческая) | MIT, но ограниченный API |
| Размер | ~480 строк TypeScript | ~300 KB minified | ~50 KB |

**Решение:** Кастомная реализация на React/SVG (компонент `GanttChart.tsx`, 483 строки). Полный контроль над:
- Отображением прогресса внутри каждой временной полосы
- Тултипами с бизнес-данными (стоимость, кол-во участников)
- Масштабированием (неделя/месяц/квартал) с кастомной логикой шкалы
- Цветовой кодировкой по статусам (PLANNED, IN_PROGRESS, COMPLETED, CANCELLED)
- Нет зависимости от проприетарных библиотек -- критично для передачи заказчику

### JWT (jsonwebtoken + jose) vs NextAuth / Sessions

| Критерий | JWT (jsonwebtoken + jose) | NextAuth | Server Sessions |
|---|---|---|---|
| Сложность | Минимальная -- 120 строк `auth.ts` | Сложная конфигурация провайдеров | Redis / БД для хранения |
| Edge Runtime | `jose` для middleware (Edge), `jsonwebtoken` для API (Node.js) | Частичная поддержка Edge | Не работает в Edge |
| Зависимости | 2 пакета | next-auth + @auth/* + провайдеры | express-session + connect-redis |
| httpOnly cookie | Реализовано вручную -- полный контроль | Автоматически | Автоматически |

**Решение:** JWT на основе `jsonwebtoken` (Node.js runtime, API routes) + `jose` (Edge Runtime, middleware). Простая реализация без внешних зависимостей. httpOnly cookies -- безопасное хранение токенов, недоступных из JavaScript. Токен содержит: `id`, `email`, `name`, `role`, `companyId`, `mustChangePassword`, `impersonatedBy`.

### xml2js vs fast-xml-parser

**Решение:** `xml2js` -- стандартная библиотека для парсинга и генерации XML. Поддерживает `parseStringPromise` (асинхронный парсинг) и `Builder` (генерация XML). Совместима с форматом Global ERP (`Edu_Participant`, `Edu_Course`). Включена опция `explicitArray: false` для удобной работы с одиночными элементами.

### recharts vs Chart.js / D3.js

| Критерий | recharts | Chart.js | D3.js |
|---|---|---|---|
| API | React-компоненты | Императивный Canvas API | Низкоуровневый SVG API |
| Рендеринг | SVG (печатается в PDF) | Canvas (растр) | SVG |
| Интеграция с React | Нативная | Обертка react-chartjs-2 | Конфликтует с Virtual DOM |
| Кривая обучения | Низкая | Средняя | Высокая |

**Решение:** recharts. React-нативная библиотека: `<BarChart>`, `<PieChart>`, `<LineChart>` -- компоненты, не императивный API. SVG-рендеринг корректно печатается в PDF. Используется для 3 типов дашбордов: финансовый, аналитический, управленческий.

### Resend vs SendGrid / Nodemailer / SMTP

**Решение:** Resend. Минимальная настройка: один npm-пакет (`resend`) + API-ключ. 100 писем/день бесплатно -- достаточно для демо хакатона. Не нужен SMTP-сервер. Используется для: инвайт-ссылки, уведомления о начале обучения, уведомления о завершении.

---

## 2. Модель данных

### ER-диаграмма (13 моделей)

```
                    ┌──────────────┐
                    │   Company    │
                    │──────────────│
                    │ id, code     │
                    │ name, erpId  │
                    │ inn, kpp     │
                    │ ogrn, address│
                    │ customFields │◄── JSON: произвольные реквизиты
                    └──┬───┬───┬───┘
                       │   │   │
            ┌──────────┘   │   └──────────┐
            ▼              ▼              ▼
    ┌──────────────┐ ┌──────────┐ ┌──────────────┐
    │   Employee   │ │   User   │ │ Specification│
    │──────────────│ │──────────│ │──────────────│
    │ id, erpId    │ │ id, email│ │ id, number   │
    │ lastName     │ │ password │ │ date, status │
    │ firstName    │ │ name     │ │ companyId    │
    │ middleName   │ │ role     │ └──────┬───────┘
    │ fullName     │ │ companyId│        │
    │ email, phone │ │ employee │        │ 1:N
    │ companyId    │ │ Id       │        ▼
    └──────┬───────┘ └────┬─────┘ ┌──────────────────┐
           │              │       │  TrainingGroup    │
           │   optional   │       │──────────────────│
           │     1:1      │       │ id, name         │
           └──────────────┘       │ courseId          │
           │                      │ startDate, endDate│
           │                      │ pricePerPerson   │
           │ N:M (через            │ status           │
           │  GroupMember)         │ specificationId  │
           │                      │ discountPercent  │
           ▼                      │ promoCodeId      │
    ┌──────────────┐              └──┬──────┬────┬───┘
    │ GroupMember   │                 │      │    │
    │──────────────│◄────────────────┘      │    │
    │ id           │                        │    │
    │ groupId      │               N:1      │    │ N:1
    │ employeeId   │                ▼       │    ▼
    │ progressPct  │         ┌──────────┐   │ ┌───────────┐
    │ (0-100)      │         │  Course  │   │ │ PromoCode │
    └──────────────┘         │──────────│   │ │───────────│
                             │ id, erpId│   │ │ id, code  │
                             │ name     │   │ │ discount% │
                             │ duration │   │ │ maxUses   │
                             │ price    │   │ │ validFrom │
                             └──┬───┬───┘   │ │ validTo   │
                                │   │       │ └───────────┘
                         1:N    │   │ 1:N   │
                    ┌───────────┘   └───┐   │
                    ▼                   ▼   │
            ┌──────────────┐  ┌──────────────┐
            │ CourseModule  │  │ PriceHistory │
            │──────────────│  │──────────────│
            │ id, courseId  │  │ id, courseId │
            │ title, type  │  │ pricePerPsn  │
            │ durationHours│  │ validFrom    │
            │ orderIndex   │  │ validTo      │
            └──────────────┘  └──────────────┘

    ┌──────────────┐         ┌──────────────┐
    │ InviteLink   │         │IntegrationLog│
    │──────────────│         │──────────────│
    │ id, token    │         │ id, action   │
    │ role         │         │ entityType   │
    │ maxUses      │         │ fileName     │
    │ usedCount    │         │ created/upd  │
    │ expiresAt    │         │ errored      │
    │ usedById     │         │ details      │
    └──────────────┘         │ userId       │
                             └──────────────┘

    ┌──────────────┐
    │ DeletedItem  │◄── Корзина (soft delete)
    │──────────────│
    │ id           │
    │ entityType   │
    │ entityId     │
    │ entityData   │◄── JSON-снимок данных
    │ deletedBy    │
    │ reason       │
    │ restoredAt   │
    └──────────────┘
```

### Описание моделей

| # | Модель | Назначение | Ключевые поля |
|---|---|---|---|
| 1 | **Company** | Компания-заказчик обучения | `code` (уникальный, auto-generated), `name`, `erpId`, `inn`, `kpp`, `ogrn`, `customFields` (JSON) |
| 2 | **Employee** | Сотрудник / участник обучения | `erpId`, `lastName`, `firstName`, `middleName`, `fullName`, `companyId` |
| 3 | **Course** | Курс обучения (образовательная программа) | `erpId`, `name`, `durationDays`, `pricePerPerson` |
| 4 | **CourseModule** | Модуль внутри курса (лекция, практика, тест, задание) | `courseId`, `title`, `type` (enum), `durationHours`, `orderIndex` |
| 5 | **PriceHistory** | История изменения цен курса | `courseId`, `pricePerPerson`, `validFrom`, `validTo` |
| 6 | **TrainingGroup** | Учебная группа (Aggregate Root) | `courseId`, `startDate`, `endDate`, `pricePerPerson`, `status`, `specificationId`, `discountPercent`, `promoCodeId` |
| 7 | **GroupMember** | Участник группы (связь Employee + Group) | `groupId`, `employeeId`, `progressPercent` (0-100). Уникальный constraint: `@@unique([groupId, employeeId])` |
| 8 | **Specification** | Юридический документ (спецификация на оплату) | `number` (unique), `date`, `companyId`, `status` (enum: FORMED, ISSUED, PENDING, PAID, ARCHIVED) |
| 9 | **User** | Аккаунт пользователя системы | `email`, `passwordHash`, `role` (enum), `mustChangePassword`, `employeeId` (optional 1:1), `companyId` |
| 10 | **InviteLink** | Ссылка для регистрации пользователя | `token`, `role`, `maxUses`, `usedCount`, `expiresAt`, `usedById` |
| 11 | **PromoCode** | Промокод на скидку | `code`, `discountPercent`, `maxUses`, `usedCount`, `isActive`, `validFrom`, `validTo` |
| 12 | **IntegrationLog** | Лог XML импорта/экспорта | `action`, `entityType`, `fileName`, `recordsCreated`, `recordsUpdated`, `recordsErrored`, `details` (JSON) |
| 13 | **DeletedItem** | Корзина удалений (soft delete) | `entityType`, `entityId`, `entityData` (JSON-снимок), `deletedBy`, `restoredAt` |

### Ключевые связи

```
Company (1) ---< (N) Employee        -- сотрудники компании
Company (1) ---< (N) Specification   -- спецификации компании
Company (1) ---< (N) User            -- пользователи, привязанные к компании

Course  (1) ---< (N) TrainingGroup   -- группы обучения по курсу
Course  (1) ---< (N) CourseModule    -- модули курса
Course  (1) ---< (N) PriceHistory    -- история цен

TrainingGroup (1) ---< (N) GroupMember     -- участники группы
TrainingGroup (N) >--- (1) Specification   -- привязка к спецификации
TrainingGroup (N) >--- (1) PromoCode       -- скидка по промокоду

GroupMember = Employee + TrainingGroup + progressPercent

User (1) ---< (0..1) Employee   -- optional 1:1 (User ≠ Employee)
User (1) ---< (0..1) InviteLink -- регистрация по инвайту
```

---

## 3. Архитектура ролей и безопасности

### Матрица ролей

| Возможность | SUPER_ADMIN | ADMIN | USER |
|---|:---:|:---:|:---:|
| Просмотр всех компаний | + | - (только свою) | - (только свою) |
| Управление компаниями (CRUD) | + | + | - |
| Управление сотрудниками | + | + (своей компании) | - |
| Управление курсами (CRUD) | + | + | - |
| Создание учебных групп | + | + | - |
| Просмотр учебных групп | Все | Своей компании | Только свои |
| Управление пользователями | + | - | - |
| Создание инвайт-ссылок | + | + (роль USER) | - |
| XML импорт/экспорт | + | + | - |
| Промокоды (CRUD) | + | + | - |
| Валидация промокодов | + | + | + |
| Дашборд (3 вкладки) | + | + | - |
| Личный кабинет | - | - | + |
| Диаграмма Ганта | Все группы, кликабельна | Группы своей компании | Только свои, readOnly |
| Имперсонация | + | - | - |
| Корзина удалений | + | - | - |
| Спецификации | + | + | - |
| Отчеты CSV/JSON | + | + | - |
| Лог интеграции | + | + | - |

### JWT-поток аутентификации

```
1. POST /api/auth/login { email, password }
   │
   ├─ Поиск пользователя в БД по email
   ├─ Проверка isActive (деактивированные отклоняются)
   ├─ bcrypt.compare(password, passwordHash)
   ├─ Формирование SessionUser:
   │   { id, email, name, role, mustChangePassword, companyId }
   ├─ jwt.sign(sessionUser, SECRET, { expiresIn: "7d" })
   └─ Set-Cookie: session=<JWT>; httpOnly; Secure; SameSite=Lax; Path=/; MaxAge=7d

2. Каждый запрос проходит через middleware.ts (Edge Runtime):
   │
   ├─ Проверка PUBLIC_PATHS (login, register, seed)
   ├─ Чтение cookie "session"
   ├─ jose.jwtVerify(token, SECRET) -- Edge-совместимая верификация
   ├─ Если mustChangePassword === true:
   │   └─ Редирект на /change-password (кроме whitelist-маршрутов)
   └─ NextResponse.next() с заголовками Cache-Control: no-store

3. API-уровневая проверка (внутри route handlers):
   │
   ├─ getSession()  -- чтение JWT из cookie (jsonwebtoken, Node.js runtime)
   ├─ requireAuth() -- бросает 401 если нет сессии
   ├─ requireAdmin() -- бросает 403 если роль не ADMIN и не SUPER_ADMIN
   └─ requireSuperAdmin() -- бросает 403 если роль не SUPER_ADMIN

4. Фильтрация данных по роли (на уровне Prisma where-clause):
   │
   ├─ SUPER_ADMIN: whereClause = {} (все данные)
   ├─ ADMIN: whereClause = { members.some.employee.companyId === session.companyId }
   └─ USER: whereClause = { members.some.employeeId === user.employeeId }
```

### Двойная библиотека JWT

- **jose** (`jwtVerify`) -- используется в `middleware.ts`, который работает в Edge Runtime (V8 Isolates). Edge Runtime не поддерживает Node.js `crypto` модуль, который нужен `jsonwebtoken`.
- **jsonwebtoken** (`jwt.sign`, `jwt.verify`) -- используется в API Route handlers, которые работают в Node.js runtime. Более привычный API, поддержка всех алгоритмов.

Оба используют один и тот же секрет (`NEXTAUTH_SECRET`), формат токенов совместим.

---

## 4. Ключевые формулы и бизнес-логика

### Стоимость обучения группы

```
totalCost = pricePerPerson * memberCount
```

- `pricePerPerson` -- зафиксированная цена на момент создания группы (не текущая цена курса!)
- `memberCount` -- количество участников (`group.members.length`)
- Фиксация цены защищает от ретроактивных изменений: если курс подорожал, ранее созданные группы сохраняют старую цену

### Стоимость со скидкой

```
discountedPrice = pricePerPerson * (1 - discountPercent / 100)
totalCost = discountedPrice * memberCount
```

- Скидка может быть ручной (от админа) или по промокоду
- `discountPercent` хранится в `TrainingGroup` (0-100)
- Промокод привязывается через `promoCodeId`

### Средний прогресс группы

```
avgProgress = SUM(member.progressPercent) / memberCount
```

- `progressPercent` -- целое число 0-100 для каждого участника
- Если участников нет (`memberCount === 0`), прогресс = 0
- Результат округляется: `Math.round(...)`

### Спецификация (юридический документ)

```
subtotal = SUM(group.pricePerPerson * group.members.length)   -- для каждой группы в спецификации
vat      = subtotal * 0.22                                      -- НДС 22%
total    = subtotal + vat                                        -- итого с НДС
```

- Ставка НДС 22% -- согласно ТЗ хакатона для образовательных услуг
- Округление до 2 знаков: `Math.round(value * 100) / 100`
- Вычисляемые поля (не хранятся в БД) -- пересчитываются при каждом запросе

### Автоматическое обновление статусов (lazy update)

```
if (status === "PLANNED" && startDate <= now)     --> status = "IN_PROGRESS"
if (status === "IN_PROGRESS" && endDate < now)    --> status = "COMPLETED"
```

- Выполняется при каждом запросе `GET /api/groups` -- "ленивое обновление"
- Статус CANCELLED не участвует в автоматике (только ручная отмена)
- Обновления батчатся через `Promise.all(statusUpdates)` для производительности

### Генерация кода компании (транслитерация)

```
1. Убрать ООО/АО/ПАО/ЗАО/ОАО/ИП и кавычки
2. Взять первые 3 буквы
3. Транслитерировать: "Тех" -> "TEH"
4. Найти максимальный номер для PREFIX-*
5. Результат: PREFIX-{maxNum+1, padStart 3}

Пример: ООО "ТехноПром" -> TEH-001
        ООО "ТехноПром-Сервис" -> TEH-002
```

### Обнаружение конфликтов расписания

```
Два интервала пересекаются, если:
  A.startDate <= B.endDate  AND  B.startDate <= A.endDate
```

Два типа конфликтов:
1. **employee_overlap** -- сотрудник записан на два курса в пересекающиеся даты
2. **course_overlap** -- две группы по одному курсу пересекаются по датам

---

## 5. Диаграмма Ганта -- архитектурные решения

### Потоки данных

```
[Prisma DB] --> GET /api/groups --> [GanttPage] --> [GanttChart (SVG)]
                                        │
                   ┌────────────────────┘
                   │
            Роль USER?
            ├─ Да: GET /api/auth/my-profile (только свои группы)
            │       readOnly = true
            └─ Нет: GET /api/groups (все группы для ADMIN/SUPER_ADMIN)
                    readOnly = false
```

### Компонентная архитектура

```
GanttPage (data loading, role-based fetch)
  └── GanttChart (pure SVG rendering)
        ├── Scale selector: Неделя / Месяц / Квартал
        ├── Left panel: список групп (300px)
        ├── SVG area:
        │     ├── Time header (months/weeks/days)
        │     ├── Row backgrounds (alternating)
        │     ├── Group bars (colored by status)
        │     │     └── Progress fill (opacity 0.7)
        │     └── "Today" line (red dashed)
        ├── Tooltip (HTML overlay, follows mouse)
        └── Summary footer (total groups, budget, avg progress)
```

### Масштабирование

| Режим | Верхний уровень | Нижний уровень | dayWidth | Пример |
|---|---|---|---|---|
| **Неделя** | Месяцы | Дни | 40px | Для 1-2 недельных курсов |
| **Месяц** | Месяцы | Номера недель | 24px | Основной режим |
| **Квартал** | Месяцы (только) | -- | 8px | Стратегический обзор |

### Цветовая кодировка

| Статус | Фон полосы | Прогресс | Текст |
|---|---|---|---|
| PLANNED | `#E2E8F0` (серый) | `#94A3B8` | `#475569` |
| IN_PROGRESS | `#DBEAFE` (голубой) | `#3B82F6` | `#1E40AF` |
| COMPLETED | `#D1FAE5` (зеленый) | `#10B981` | `#065F46` |
| CANCELLED | `#FEE2E2` (красный) | `#EF4444` | `#991B1B` |

### Тултип

При наведении на полосу показывается HTML-оверлей с:
- Название группы
- Курс
- Даты (dd.MM.yyyy -- dd.MM.yyyy)
- Количество участников
- Прогресс-бар (CSS + цвет статуса)
- Процент прогресса

Умное позиционирование: тултип смещается, если не помещается в видимую область (проверка `scrollRef.current?.clientWidth`).

### Линия "Сегодня"

Вертикальная красная пунктирная линия (`#EF4444`, `strokeDasharray: "6 3"`) с меткой "Сегодня". Отображается только если текущая дата попадает в видимый диапазон диаграммы.

### readOnly режим

Для роли USER: клики по полосам и по списку групп отключены, курсор не меняется. Пользователь видит только свои группы, без возможности перехода к карточке группы.

---

## 6. XML-интеграция с Global ERP

### Поток импорта

```
[Файл .xml] --> FormData upload --> POST /api/xml/import
                                         │
                      ┌──────────────────┘
                      │
               parseStringPromise(xml, { explicitArray: false })
                      │
               validateParsedXml() -- проверка корневого элемента и обязательных полей
                      │
                ┌─────┴──────┐
                │            │
        Edu_Participant   Edu_Course
                │            │
         upsert по erpId    upsert по erpId
         (create or update)  + PriceHistory
                │            │
                └─────┬──────┘
                      │
              IntegrationLog.create()
                      │
              Response: { results[], totalCreated, totalUpdated, totalErrors }
```

### Поток экспорта

```
GET /api/xml/export/[type]/[id]
         │
    ┌────┴─────┬──────────┐
    │          │          │
 employee    course     group
    │          │          │
 Prisma      Prisma    Prisma + members
 findUnique  findUnique findUnique(include)
    │          │          │
 Builder()   Builder()  Builder()
    │          │          │
 XML Edu_    XML Edu_   XML Edu_
 Participant Course     TrainingGroup
    │          │          │
    └────┬─────┴──────────┘
         │
  IntegrationLog.create()
         │
  Response: Content-Type: application/xml
            Content-Disposition: attachment
```

### Маппинг полей (особенность ERP!)

В XML Global ERP поля именуются нестандартно -- имя и отчество перепутаны:

| Наша система | XML Global ERP | Комментарий |
|---|---|---|
| `lastName` (Фамилия) | `sLastName` | Совпадает |
| `firstName` (Имя) | `sMiddleName` | ПЕРЕПУТАНО в ERP! |
| `middleName` (Отчество) | `sFirstName` | ПЕРЕПУТАНО в ERP! |
| `fullName` (ФИО) | `sFIO` | Совпадает |
| `companyId` | `idOrganization` | Поиск Company по erpId |

Этот маппинг документирован в `xml-utils.ts` и аккуратно обрабатывается при импорте и экспорте.

### Батч-импорт

- Поддерживается загрузка нескольких файлов через drag & drop (`XmlImportDialog.tsx`)
- Файлы передаются через FormData (поля `file` / `files`)
- Каждый файл обрабатывается независимо -- ошибка в одном не блокирует остальные
- Для каждого файла создается отдельная запись `IntegrationLog`

### Правила валидации

1. XML должен быть well-formed (парсинг через xml2js)
2. Корневой элемент: `Edu_Participant` / `Edu_Participants` / `Edu_Course` / `Edu_Courses`
3. Обязательные поля: `id` + `sFIO` (для участников), `id` + `sCourseHL` (для курсов)
4. Числовые поля (`id`, `idOrganization`, `nDurationInDays`, `nPricePerPerson`) парсятся через `parseInt` / `parseFloat`

---

## 7. Структура API

### Аутентификация

| Метод | Маршрут | Доступ | Описание |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Авторизация (email + пароль -> JWT cookie) |
| POST | `/api/auth/register` | Public (с invite token) | Регистрация по инвайт-ссылке |
| POST | `/api/auth/logout` | Auth | Выход (удаление cookie) |
| GET | `/api/auth/me` | Auth | Текущий пользователь из JWT |
| POST | `/api/auth/change-password` | Auth | Смена пароля |
| GET | `/api/auth/my-profile` | Auth (USER) | Личный кабинет: курсы, прогресс |
| POST | `/api/auth/seed` | Public | Инициализация суперадмина |

### Управление пользователями

| Метод | Маршрут | Доступ | Описание |
|---|---|---|---|
| GET | `/api/auth/users` | SUPER_ADMIN | Список пользователей |
| PUT | `/api/auth/users/[id]` | SUPER_ADMIN | Редактирование пользователя |
| DELETE | `/api/auth/users/[id]` | SUPER_ADMIN | Деактивация пользователя |
| GET | `/api/auth/invites` | ADMIN+ | Список инвайт-ссылок |
| POST | `/api/auth/invites` | ADMIN+ | Создание инвайт-ссылки |
| DELETE | `/api/auth/invites/[id]` | ADMIN+ | Деактивация инвайта |
| POST | `/api/auth/send-invite-email` | ADMIN+ | Отправка инвайта на email |
| POST | `/api/auth/impersonate` | SUPER_ADMIN | Вход под другим пользователем |
| POST | `/api/auth/stop-impersonate` | Auth | Выход из имперсонации |

### Компании

| Метод | Маршрут | Доступ | Описание |
|---|---|---|---|
| GET | `/api/companies` | Auth | Список компаний (фильтр по роли) |
| POST | `/api/companies` | ADMIN+ | Создание компании (авто-код) |
| GET | `/api/companies/[id]` | Auth | Детали компании |
| PUT | `/api/companies/[id]` | ADMIN+ | Редактирование компании |
| DELETE | `/api/companies/[id]` | SUPER_ADMIN | Удаление компании (soft delete) |

### Сотрудники

| Метод | Маршрут | Доступ | Описание |
|---|---|---|---|
| GET | `/api/employees` | Auth | Список сотрудников (фильтр по роли) |
| POST | `/api/employees` | ADMIN+ | Создание сотрудника |
| GET | `/api/employees/[id]` | Auth | Детали сотрудника |
| PUT | `/api/employees/[id]` | ADMIN+ | Редактирование сотрудника |
| DELETE | `/api/employees/[id]` | ADMIN+ | Удаление сотрудника (soft delete) |

### Курсы

| Метод | Маршрут | Доступ | Описание |
|---|---|---|---|
| GET | `/api/courses` | Auth | Список курсов |
| POST | `/api/courses` | ADMIN+ | Создание курса |
| GET | `/api/courses/[id]` | Auth | Детали курса |
| PUT | `/api/courses/[id]` | ADMIN+ | Редактирование курса |
| DELETE | `/api/courses/[id]` | ADMIN+ | Удаление курса (soft delete) |
| GET | `/api/courses/[id]/modules` | Auth | Модули курса |
| POST | `/api/courses/[id]/modules` | ADMIN+ | Создание модуля |
| PUT | `/api/courses/[id]/modules/[moduleId]` | ADMIN+ | Редактирование модуля |
| DELETE | `/api/courses/[id]/modules/[moduleId]` | ADMIN+ | Удаление модуля |

### Учебные группы

| Метод | Маршрут | Доступ | Описание |
|---|---|---|---|
| GET | `/api/groups` | Auth | Список групп (фильтр по роли + auto-status) |
| POST | `/api/groups` | ADMIN+ | Создание группы (+ memberIds) |
| GET | `/api/groups/[id]` | Auth | Детали группы |
| PUT | `/api/groups/[id]` | ADMIN+ | Редактирование группы |
| DELETE | `/api/groups/[id]` | ADMIN+ | Удаление группы (soft delete) |
| GET | `/api/groups/[id]/members` | Auth | Участники группы |
| POST | `/api/groups/[id]/members` | ADMIN+ | Добавление участника |
| PUT | `/api/groups/[id]/members/[memberId]` | ADMIN+ | Обновление прогресса |
| DELETE | `/api/groups/[id]/members/[memberId]` | ADMIN+ | Удаление участника |

### Спецификации

| Метод | Маршрут | Доступ | Описание |
|---|---|---|---|
| GET | `/api/specifications` | Auth | Список с вычисленными subtotal/vat/total |
| POST | `/api/specifications` | ADMIN+ | Создание + привязка groupIds |
| GET | `/api/specifications/[id]` | Auth | Детали спецификации |
| PUT | `/api/specifications/[id]` | ADMIN+ | Редактирование |
| DELETE | `/api/specifications/[id]` | ADMIN+ | Удаление |

### Промокоды

| Метод | Маршрут | Доступ | Описание |
|---|---|---|---|
| GET | `/api/promo-codes` | ADMIN+ | Список промокодов |
| POST | `/api/promo-codes` | ADMIN+ | Создание промокода |
| PUT | `/api/promo-codes/[id]` | ADMIN+ | Редактирование |
| DELETE | `/api/promo-codes/[id]` | ADMIN+ | Удаление |
| POST | `/api/promo-codes/validate` | Auth | Валидация промокода (любой авторизованный) |

### XML-интеграция

| Метод | Маршрут | Доступ | Описание |
|---|---|---|---|
| POST | `/api/xml/import` | ADMIN+ | Батч-импорт XML (Edu_Participant, Edu_Course) |
| GET | `/api/xml/export/[type]/[id]` | Auth | Экспорт в XML (employee, course, group) |

### Аналитика и отчеты

| Метод | Маршрут | Доступ | Описание |
|---|---|---|---|
| GET | `/api/dashboard` | Auth | Данные для 3 дашбордов (financial, analytical, operational) |
| GET | `/api/conflicts` | Auth | Проверка конфликтов расписания |
| GET | `/api/reports?from=&to=&format=` | Auth | Отчет по обучению (JSON или CSV) |
| GET | `/api/integration-log` | ADMIN+ | Лог XML операций |

---

## 8. Дополнительный функционал (сверх ТЗ)

Система реализует все 6 сущностей по ТЗ (Компания, Сотрудник, Курс, Учебная группа, Участник группы, Спецификация) + диаграмму Ганта + XML-интеграцию. Дополнительно реализовано:

| # | Функциональность | Описание | Ценность для заказчика |
|---|---|---|---|
| 1 | **Система аутентификации (3 роли)** | SUPER_ADMIN, ADMIN, USER с JWT и middleware | Разграничение доступа, мультитенантность |
| 2 | **Инвайт-ссылки с email** | Админ создает ссылку, отправляет по email через Resend | Безопасная регистрация сотрудников |
| 3 | **Промокоды и скидки** | Промокод с валидацией (активность, срок, лимит), скидка на группу | Маркетинговый инструмент |
| 4 | **3 типа дашбордов** | Финансовый (оборот, прибыль), аналитический (прогресс, популярность), управленческий (статусы, конфликты) | Принятие решений на разных уровнях |
| 5 | **Личный кабинет пользователя** | Роль USER видит свои курсы, прогресс, диаграмму Ганта | Самообслуживание сотрудников |
| 6 | **Модули курса** | Типы: лекция, практика, тест, задание. Порядок, длительность | Детализация учебного плана |
| 7 | **Soft delete с корзиной** | При удалении JSON-снимок сохраняется в `DeletedItem`, SUPER_ADMIN может восстановить | Защита от ошибок администратора |
| 8 | **Лог интеграции** | Каждый XML импорт/экспорт записывается: файл, кол-во created/updated/errored | Аудит и отладка интеграции |
| 9 | **JSON customFields** | Произвольные поля компании в формате JSON | Гибкость без миграций БД |
| 10 | **Автогенерация кода компании** | Транслитерация + auto-increment: "ТехноПром" -> TEH-001 | Единообразие кодов |
| 11 | **Обнаружение конфликтов расписания** | Пересечение дат: сотрудник на двух курсах / группы по одному курсу | Предотвращение ошибок планирования |
| 12 | **CSV-экспорт отчетов** | BOM + разделитель ";" для корректного отображения кириллицы в Excel | Выгрузка в привычный формат |
| 13 | **Имперсонация** | SUPER_ADMIN входит от имени любого пользователя | Отладка и техподдержка |
| 14 | **История цен курса** | `PriceHistory` с `validFrom`/`validTo` | Анализ динамики цен |
| 15 | **Принудительная смена пароля** | `mustChangePassword` + middleware-редирект | Безопасность при первом входе |
| 16 | **Батч-импорт XML** | Drag & drop нескольких файлов, независимая обработка | Массовая загрузка данных |
| 17 | **Docker-контейнеризация** | `Dockerfile` + `docker-compose.yml` (PostgreSQL + App) | Одна команда для запуска |
| 18 | **Автообновление статусов** | Lazy update: PLANNED -> IN_PROGRESS -> COMPLETED по датам | Актуальность данных без cron |
| 19 | **Email-уведомления** | Начало обучения, завершение обучения | Информирование участников |
| 20 | **Фиксация цены группы** | `pricePerPerson` копируется из курса при создании группы | Защита от ретроактивных изменений |

---

## Архитектурная диаграмма (верхний уровень)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Браузер                                 │
│  ┌────────────┐  ┌─────────────┐  ┌───────────────────────┐    │
│  │   Login    │  │  Dashboard  │  │  GanttChart (SVG)     │    │
│  │   Page     │  │  (recharts) │  │  + Tooltip (HTML)     │    │
│  └─────┬──────┘  └──────┬──────┘  └───────────┬───────────┘    │
│        │                │                     │                 │
│        └────────────────┼─────────────────────┘                 │
│                         │ fetch() + window.location.href        │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│  Next.js 16             │                                       │
│  ┌──────────────────────┼──────────────────────────────────┐    │
│  │  Edge Middleware      │                                  │    │
│  │  (jose JWT verify)   │                                  │    │
│  │  + Cache-Control     │                                  │    │
│  └──────────────────────┼──────────────────────────────────┘    │
│                         │                                       │
│  ┌──────────────────────┴──────────────────────────────────┐    │
│  │  API Routes (Node.js Runtime)                           │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │    │
│  │  │ /auth/*  │ │/groups/* │ │ /xml/*   │ │/dashboard │  │    │
│  │  │ JWT+bcrypt│ │ CRUD    │ │ xml2js   │ │ recharts  │  │    │
│  │  │ Resend   │ │ auto-   │ │ import/  │ │ data      │  │    │
│  │  │ invite   │ │ status  │ │ export   │ │ 3 tabs    │  │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                         │                                       │
│  ┌──────────────────────┴──────────────────────────────────┐    │
│  │  Prisma ORM (Type-safe queries)                         │    │
│  └──────────────────────┬──────────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│  PostgreSQL             │                                       │
│  ┌──────────────────────┴──────────────────────────────────┐    │
│  │  13 таблиц: Company, Employee, Course, CourseModule,    │    │
│  │  PriceHistory, TrainingGroup, GroupMember, Specification,│    │
│  │  User, InviteLink, PromoCode, IntegrationLog, DeletedItem│   │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

*Документ подготовлен для жюри хакатона Global ERP. Все решения обоснованы контекстом задачи: 48 часов, команда 1-3 человека, ТЗ на корпоративное обучение с диаграммой Ганта и XML-интеграцией.*
