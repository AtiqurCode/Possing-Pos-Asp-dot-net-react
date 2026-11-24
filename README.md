# Possing POS

ASP.NET Core 10 + React (Vite) + PostgreSQL point-of-sale system.

## Features

- JWT auth (`Admin` / `Cashier`)
- Categories, subcategories, products (SKU + sequence number)
- POS checkout by SKU / sequence / quick-pick grid
- `%` or fixed BDT discounts (with quick % buttons)
- Optional customer name + mobile (auto membership profile)
- In-app charts: daily trend, payment pie, category pie, top products
- Sales history + receipt / monthly PDF export
- Dashboard low-stock alerts

## Quick start (Docker)

```bash
docker compose up --build
```

| Service   | URL / Port              |
|-----------|-------------------------|
| Frontend  | http://localhost:3000   |
| API       | http://localhost:8080   |
| Postgres  | localhost:**5433**      |
| Swagger   | http://localhost:8080/swagger |

Default users:

- `admin` / `admin123`
- `cashier` / `cashier123`

## Local development

```bash
# 1) Postgres only
docker compose up postgres -d

# 2) API
dotnet run

# 3) Frontend
cd frontend
npm install
npm run dev
```

- API: http://localhost:5094  
- Frontend: http://localhost:5173 (proxies `/api` → API)

## Structure

```
Controllers/ Services/ Models/ Dtos/ Data/   # ASP.NET API
frontend/                                   # React + Vite + Tailwind
docker-compose.yml                          # postgres + api + frontend
```

Connection string (local): `Host=localhost;Port=5433;Database=possing;Username=possing;Password=possing_secret`
