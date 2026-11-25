# Possing POS

Point-of-sale system for retail counters: catalog & stock, keyboard-first sell screen, VAT-aware checkout, thermal slip PDFs, inventory ledger, members, and reporting.

**Stack:** ASP.NET Core 10 · React 19 (Vite) · PostgreSQL 16 · Docker Compose · QuestPDF · JWT

---

## Table of contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Implementation details](#implementation-details)
4. [Requirements](#requirements)
5. [Run steps](#run-steps)
6. [Default accounts & URLs](#default-accounts--urls)
7. [Configuration](#configuration)
8. [API map](#api-map)
9. [Keyboard shortcuts (Sell)](#keyboard-shortcuts-sell)
10. [Project layout](#project-layout)

---

## Features

### Auth & roles

| Role | Access |
|------|--------|
| **Admin** | Full app: catalog, settings, receive/missing stock, product CRUD/images, reports |
| **Cashier** | Sell, view stock/receipts/members/inventory history, dashboard |

JWT bearer tokens (12h default). Passwords hashed with BCrypt.

### Sell (POS)

- Scan / type **SKU** or **sequence #**, then Enter
- Qty multiplier: `3*SKU` / `3*1001`
- Quick-pick product tiles
- Cart line select (↑↓), qty ±, Delete/Backspace remove
- Discount chips: 0 / 5 / 10 / 15%
- Cash / Card pay · one-click **CHARGE**
- Full keyboard path (see [shortcuts](#keyboard-shortcuts-sell))
- VAT from **Settings** (not edited on the sell screen)
- Print last 58mm thermal slip PDF after payment

### Catalog & stock

- Categories → subcategories → products
- Product: SKU, sequence number, price, qty, min level, image
- Inline price/qty edit on Stock (admin)
- Low-stock filter + dashboard alerts

### Inventory ledger

Append-only **stock movements** for audit / future-proof history:

| Type | Meaning |
|------|---------|
| **Received** | New stock into store (`POST /inventory/receive`, opening qty on create) |
| **Sold** | Deducted at checkout (linked to sale id) |
| **Missing** | Shrinkage / loss / damage (`POST /inventory/missing`) |
| **Adjustment** | Absolute qty change from product edit / inline stock patch |

Each row stores: qty, before → after, note, user, timestamp. Summary cards: received / sold / missing / on hand / net.

### VAT & store settings (Admin → Settings)

Persisted in `AppSettings` (seeded from `appsettings.json` `Store` section):

- Store name, address, phone
- **Currency** (e.g. `BDT`)
- **VAT %**
- **Tax mode**
  - **Exclusive** — shelf price is net; VAT added on charge  
  - **Inclusive** — shelf price already includes VAT; charge shelf total; VAT extracted for slip/display only

### Customers / members

Optional mobile (+ name) on sale. Lookup creates/updates membership code, visit count, lifetime spend.

### Reports & PDFs

- Dashboard: today/week totals, payment breakdown, 7-day chart, low stock
- Reports: daily sales, payments, categories, top products (Recharts)
- **Sale slip PDF** — 58mm continuous thermal/laser layout (QuestPDF + bundled Consolas)
- **Monthly sales PDF** — A4 table

---

## Architecture

```
┌─────────────────┐     /api + /uploads      ┌──────────────────────┐
│  React (Vite)   │ ───────────────────────► │  ASP.NET Core API    │
│  localhost:5173 │     JWT Bearer           │  Controllers         │
│  or :3000 nginx │ ◄─────────────────────── │       ↓              │
└─────────────────┘     JSON / PDF / files   │  Services            │
                                             │       ↓              │
                                             │  EF Core → Postgres  │
                                             │  QuestPDF / Files    │
                                             └──────────────────────┘
                                                        │
                                                        ▼
                                               PostgreSQL :5433
```

### Backend layering

| Layer | Responsibility |
|-------|----------------|
| **Controllers** | HTTP, auth attributes, validation → DTO in/out |
| **Services** | Business rules, transactions, PDF, images |
| **Models** | EF entities |
| **Dtos** | API contracts |
| **Data** | `AppDbContext`, migrations, `DbSeeder` |
| **Options** | Typed config (`StoreOptions`) |

### Frontend

| Piece | Role |
|-------|------|
| **React Router** | Pages under authenticated `Layout` |
| **TanStack Query** | Server state / cache invalidation |
| **Axios** | `/api` client + JWT header |
| **Vite proxy** | Dev: `/api` & `/uploads` → `http://localhost:5094` |
| **nginx** (Docker) | Serves SPA; proxies `/api` & `/uploads` → `api:8080` |
| **Recharts** | Dashboard / reports charts |
| **Tailwind v4** | UI |

### Data model (core)

```
User ──< Sale >── Customer?
         │
         └──< SaleItem >── Product >── SubCategory >── Category

Product ──< StockMovement >── User?

AppSetting (key/value store settings)
```

Migrations apply automatically on API startup (`MigrateAsync` in seeder).

---

## Implementation details

### Auth

- `POST /api/auth/login` → JWT + user
- Claims: `NameIdentifier` (user id), role
- `[Authorize]` on APIs; `[Authorize(Roles = "Admin")]` for mutations that change catalog/settings/stock intake

### Sales & stock

1. Validate items, discount, payment
2. Load store VAT + tax mode from settings
3. Decrement product qty in a DB transaction
4. Write **Sold** `StockMovement` rows (before/after, sale reference)
5. Persist sale (subtotal, discount, tax rate/amount/mode, total)

**Exclusive:** `tax = round((sub−disc) × rate/100)`, `total = sub−disc+tax`  
**Inclusive:** `total = sub−disc`, `tax = round(total × rate/(100+rate))` (display only)

### Inventory

- `InventoryService.ReceiveAsync` / `MissingAsync` — delta apply + movement
- Product create with qty > 0 → **Received** (“Opening stock”)
- Product update / PATCH stock qty change → **Adjustment**
- History: `GET /api/inventory/movements`, `GET /api/inventory/summary`

### PDFs (QuestPDF)

- Community license; fonts under `Fonts/` copied to output
- Slip: continuous page **58mm** (~164pt), monospace, VAT line, thank-you footer
- Monthly: A4 listing

### Images

- Multipart upload → `wwwroot/uploads/products/`
- Served as static files; Docker volume `possing_uploads`

### Seed data

On empty DB:

- Users: `admin` / `admin123`, `cashier` / `cashier123`
- Sample categories, products (Cola, Water, Tea, Chips)
- Store settings keys from `Store` config

---

## Requirements

| Tool | Version / notes |
|------|-----------------|
| **Docker Desktop** | Compose v2 (recommended path) |
| **.NET SDK** | **10.0** (local API / migrations) |
| **Node.js** | **20+** (local frontend) |
| **PostgreSQL** | Via Compose image `postgres:16-alpine` (port **5433** on host) |
| OS | Windows / macOS / Linux (paths below use bash-style) |

Optional for local-only API: EF tools  
`dotnet tool install --global dotnet-ef`

---

## Run steps

### A) Full stack with Docker (simplest)

```bash
# from repo root
cp .env.example .env   # optional; defaults work

docker compose up --build
```

| Service | URL |
|---------|-----|
| UI | http://localhost:3000 |
| API | http://localhost:8080 |
| Swagger | http://localhost:8080/swagger |
| Postgres | `localhost:5433` |

Stop: `docker compose down`  
Wipe DB volume: `docker compose down -v`

Rebuild after backend/frontend code changes:

```bash
docker compose up -d --build api frontend
```

### B) Local development (hot reload)

**1. Postgres only**

```bash
docker compose up postgres -d
```

**2. API** (repo root)

```bash
dotnet restore
dotnet run --launch-profile http
# listens on http://localhost:5094
```

Migrations run on startup. Swagger: http://localhost:5094/swagger

**3. Frontend**

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173  → proxies /api and /uploads to :5094
```

> If the UI shows **502** on `/api/*`, the API is not running on **5094**. Start step 2.

### C) Useful commands

```bash
# New migration (when models change)
dotnet ef migrations add <Name> --output-dir Data/Migrations

# Frontend production build
cd frontend && npm run build
```

---

## Default accounts & URLs

| User | Password | Role |
|------|----------|------|
| `admin` | `admin123` | Admin |
| `cashier` | `cashier123` | Cashier |

| Mode | Frontend | API |
|------|----------|-----|
| Docker | http://localhost:3000 | http://localhost:8080 |
| Local | http://localhost:5173 | http://localhost:5094 |

---

## Configuration

### `appsettings.json` (API)

| Key | Purpose |
|-----|---------|
| `ConnectionStrings:DefaultConnection` | Postgres (local uses port **5433**) |
| `Store:*` | Seed defaults for name/address/phone/VAT/currency/tax mode |
| `Jwt:Key` | Signing secret (**change in production**, ≥32 chars) |
| `Jwt:ExpiresHours` | Token lifetime |
| `Cors:Origins` | Allowed frontends |

Runtime store settings live in DB (`AppSettings`) and override the seed after first boot; edit via **Settings** UI.

### `.env` (Docker Compose)

See `.env.example`:

```
POSTGRES_DB / USER / PASSWORD / PORT
API_PORT / FRONTEND_PORT
JWT_KEY
```

---

## API map

Base: `/api` · Auth: `Authorization: Bearer <token>` unless noted.

| Area | Methods |
|------|---------|
| **Auth** | `POST /auth/login`, `GET /auth/me` |
| **Dashboard** | `GET /dashboard/summary` |
| **Categories** | CRUD `/categories` (write: Admin) |
| **Subcategories** | CRUD `/subcategories` (write: Admin) |
| **Products** | list, by-id, `by-code/{code}`, CRUD, `PATCH /{id}/stock`, `POST /{id}/image` |
| **Sales** | list, get, `POST` checkout |
| **Customers** | list, `lookup?mobile=`, upsert |
| **Inventory** | `GET movements`, `GET summary`, `POST receive`, `POST missing` (receive/missing: Admin) |
| **Settings** | `GET /settings/store`, `PUT /settings/store` (PUT: Admin) |
| **Reports** | `GET analytics`, `GET sales/{id}/slip.pdf`, `GET monthly?year&month` |

Interactive docs: Swagger UI when `ASPNETCORE_ENVIRONMENT=Development`.

---

## Keyboard shortcuts (Sell)

| Key | Action |
|-----|--------|
| **Enter** | Add scanned code · empty field = charge |
| **`3*SKU`** | Add with quantity 3 |
| **↑ / ↓** | Select cart line |
| **+ / −** | Change qty on selected line |
| **Del / Backspace** | Remove line (when scan box empty) |
| **F2 / F3** | Charge Cash / Card |
| **F6 / F7** | Select Cash / Card only |
| **F4** | Clear cart |
| **F5** | Print last slip |
| **F8–F11** | Discount 0 / 5 / 10 / 15% |
| **Esc** | Clear scan field |
| **Ctrl+Enter** | Charge with selected pay method |
| **F1** | Toggle shortcut help |

Scan input stays focused for register-speed use.

---

## Project layout

```
Possing/
├── Controllers/          # HTTP endpoints
├── Services/             # Business logic + PDF + inventory
├── Models/               # EF entities
├── Dtos/                 # Request/response records
├── Data/                 # DbContext, Migrations, Seeder
├── Options/              # StoreOptions
├── Fonts/                # QuestPDF TTF (Consolas, etc.)
├── wwwroot/uploads/      # Product images
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios + endpoint helpers
│   │   ├── auth/         # AuthContext
│   │   ├── components/   # Layout, ProtectedRoute
│   │   ├── pages/        # Sell, Stock, Inventory, Settings, …
│   │   └── types/
│   ├── nginx.conf        # Docker SPA + API proxy
│   └── Dockerfile
├── Dockerfile            # API image
├── docker-compose.yml
├── appsettings.json
├── .env.example
└── README.md
```

### UI routes

| Path | Page |
|------|------|
| `/` | Register (dashboard) |
| `/pos` | Sell |
| `/products` | Stock |
| `/inventory` | Inventory history |
| `/customers` | Members |
| `/categories` | Catalog (Admin) |
| `/settings` | Store / VAT (Admin) |
| `/sales` | Receipts |
| `/reports` | Reports |
| `/login` | Sign in |

---

## Production notes

- Rotate `Jwt:Key` and Postgres password; do not ship `.env` with secrets.
- Set `ASPNETCORE_ENVIRONMENT=Production` and disable Swagger if exposed publicly.
- Put TLS in front of nginx / API (Compose currently exposes HTTP for local use).
- Persist `possing_pgdata` and `possing_uploads` volumes (already defined in Compose).

---

## License / PDF

QuestPDF is used under the **Community** license configured in `ReportService`.
