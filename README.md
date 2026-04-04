# Корпоративное обучение — Global ERP

Веб-приложение для централизованного учета ресурсов проведения корпоративных обучений.

> Хакатон «Экосистема СТИК» — Визуализация обучения в Global ERP: от данных к решениям

## Быстрый старт (Docker) — рекомендуемый способ

```bash
git clone <repo-url>
cd corporate-training
docker compose up --build
```

Приложение доступно на http://localhost:3000

**Вход:** `admin@training.local` / `admin123`

## Запуск без Docker

### Требования
- Node.js 18+
- PostgreSQL 16+

### Установка

```bash
# 1. Установить зависимости
npm install

# 2. Создать файл .env
cp .env.example .env
# Отредактировать DATABASE_URL если нужно

# 3. Создать БД (если ещё нет)
createdb corporate_training

# 4. Применить миграции
npx prisma migrate deploy

# 5. Загрузить начальные данные
node prisma/seed.mjs

# 6. Запустить
npm run dev
```

Приложение на http://localhost:3000

### Переменные окружения

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/corporate_training?schema=public"
NEXTAUTH_SECRET="your-secret-here"
```

## Стек технологий

| Компонент | Технология | Обоснование |
|---|---|---|
| Frontend | Next.js 16 (App Router) | SSR, файловая маршрутизация, API Routes |
| UI | shadcn/ui + Tailwind CSS | Enterprise-компоненты, кастомизация |
| Диаграмма Ганта | Кастомный React/SVG | Полный контроль: масштаб, прогресс, тултипы |
| База данных | PostgreSQL 16 + Prisma ORM | Type-safe ORM, миграции, автономный деплой |
| Авторизация | JWT (jsonwebtoken + jose) | Сессии в httpOnly cookies |
| XML интеграция | xml2js | Парсинг/генерация XML в формате Global ERP |
| Графики | recharts | Дашборды с диаграммами |

## Архитектура

### Модель данных (12 сущностей)

**Основные (из ТЗ):** Company, Employee, Course, TrainingGroup, GroupMember, Specification

**Дополнительные:** User, InviteLink, PromoCode, PriceHistory, IntegrationLog, DeletedItem

### Роли

| Роль | Доступ |
|---|---|
| SUPER_ADMIN | Полный доступ. Управление всеми компаниями, ролями, XML, промокоды |
| ADMIN | Привязан к компании. Видит только свои группы, учащихся, аналитику |
| USER | Персональный кабинет. Свои курсы и прогресс |

### Формулы расчетов

```
Стоимость группы = цена_за_человека × количество_участников
Средний прогресс = SUM(прогресс_участников) / количество_участников
Спецификация: итого = сумма_групп + НДС_22%
```

### Диаграмма Ганта

Кастомный SVG-компонент (`src/components/gantt/GanttChart.tsx`):
- Масштабирование: неделя / месяц / квартал
- Прогресс внутри полос
- Тултипы при наведении
- Линия "Сегодня"
- Цветовая кодировка статусов

### XML интеграция с Global ERP

- Импорт: `Edu_Participant`, `Edu_Course` (одиночный и пакетный)
- Экспорт: сотрудники, курсы, группы (с участниками)
- Валидация формата и обязательных полей
- Drag & Drop загрузка
- Лог всех операций

## Структура проекта

```
src/
├── app/
│   ├── api/                # REST API (40+ эндпоинтов)
│   │   ├── auth/           # Авторизация, регистрация, инвайты
│   │   ├── companies/      # CRUD компаний
│   │   ├── courses/        # CRUD курсов
│   │   ├── employees/      # CRUD учащихся
│   │   ├── groups/         # CRUD групп + участники
│   │   ├── specifications/ # CRUD спецификаций
│   │   ├── xml/            # XML импорт/экспорт
│   │   ├── promo-codes/    # Промокоды
│   │   ├── conflicts/      # Конфликты расписания
│   │   ├── reports/        # Выгрузка отчетов (CSV)
│   │   ├── dashboard/      # Статистика для дашбордов
│   │   └── integration-log/# Лог XML-операций
│   ├── (dashboard)/        # Страницы с sidebar
│   ├── login/              # Авторизация
│   ├── register/           # Регистрация по инвайту
│   └── change-password/    # Смена пароля
├── components/
│   ├── gantt/              # Диаграмма Ганта
│   ├── layout/             # Sidebar
│   ├── xml/                # XML Drag & Drop
│   └── ui/                 # shadcn/ui
├── lib/
│   ├── prisma.ts           # Подключение к БД
│   ├── auth.ts             # JWT-сессии
│   ├── auth-context.tsx    # React-контекст авторизации
│   ├── types.ts            # Типы и утилиты
│   ├── xml-utils.ts        # Парсинг/генерация XML
│   ├── trash.ts            # Корзина удалений
│   └── hooks.ts            # React-хуки
└── middleware.ts            # Защита роутов
```

## Скрипты

```bash
npm run dev        # Запуск dev-сервера
npm run build      # Production-сборка
npm start          # Запуск production
node prisma/seed.mjs  # Заполнение БД данными
npx prisma studio  # Визуальный редактор БД
```
