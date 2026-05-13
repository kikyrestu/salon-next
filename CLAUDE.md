# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SalonNext is a multi-tenant salon management system built with Next.js 16 (App Router), MongoDB/Mongoose, and NextAuth v5. Each salon branch (cabang) has its own MongoDB database, resolved at runtime via a tenant slug in the URL.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint (next/core-web-vitals + next/typescript)
npm run test         # Run all tests (vitest)
npm run test:watch   # Vitest watch mode
npm run test:coverage # Coverage (istanbul, covers lib/** and hooks/**)

# Run a single test file
npx vitest run __tests__/lib/currency.test.ts

# Run tests matching a pattern
npx vitest run -t "should format currency"

# Migrations
npm run migrate:list
npm run migrate -- --file=<migration-file>.js
npm run migrate -- --file=<migration-file>.js --direction=down
```

## Architecture

### Multi-Tenant Database Pattern

The app uses a **database-per-tenant** strategy:

- **Master DB** (`MASTER_MONGODB_URI`) — stores `Store`, `Registration`, `AdminSettings`. Accessed via `getMasterModels()` in `lib/masterDb.ts`.
- **Tenant DBs** — each branch has its own MongoDB. The `Store` document in Master DB holds the `dbUri`. Connections are cached in `lib/tenantDb.ts` via a `Map<string, Connection>`.
- **Model registration** — `lib/initModels.ts` exports all ~40 Mongoose models and registers them on each tenant connection.
- **Resolving tenant in API routes**: read `x-store-slug` header (set by the frontend) → call `getTenantModels(slug)` → use returned models.

### URL Structure & Routing

```
/                         → Landing/register page
/admin/cabang             → Super admin branch management
/[slug]/login             → Tenant login
/[slug]/dashboard         → Tenant dashboard
/[slug]/(frontend)/*      → All tenant pages (sidebar layout)
/api/*                    → API routes (tenant resolved via x-store-slug header)
/api/admin/*              → Super admin API routes (public auth)
```

Route groups under `app/[slug]/`:
- `(auth)` — login, register, setup (no sidebar)
- `(frontend)` — all authenticated pages (wrapped in `ClientLayout` with Sidebar/Header/Footer)

### Authentication & Authorization

- **NextAuth v5** with JWT strategy, credentials provider (`auth.ts` + `auth.config.ts`).
- Middleware in `auth.config.ts` handles route protection and redirects.
- JWT token stores `tenantSlug`, `role`, `permissions`, `roleId`. Permissions refresh from DB every 5 minutes.
- **RBAC system** (`lib/rbac.ts`): `checkPermission(request, resource, action)` and `checkPermissionWithSession()` for API routes. Actions: `view`, `create`, `edit`, `delete`. View scope: `all`, `own`, `none`.
- **Client-side**: `usePermission()` hook and `<PermissionGate>` component.
- Super Admin / Owner roles bypass all permission checks.

### API Route Pattern

Every API route follows this pattern:
```typescript
import { getTenantModels } from "@/lib/tenantDb";
import { checkPermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { ModelName } = await getTenantModels(tenantSlug);

    const permissionError = await checkPermission(request, 'resource', 'view');
    if (permissionError) return permissionError;

    // ... business logic
}
```

Use `checkPermissionWithSession()` when you also need the session object (avoids double `auth()` call).

### Key Utilities

| File | Purpose |
|------|---------|
| `lib/errorHandler.ts` | `handleApiError()`, `createErrorResponse()` — sanitized error responses |
| `lib/validation.ts` | Input validation helpers |
| `lib/encryption.ts` | AES-256 encryption (requires `ENCRYPTION_KEY` env) |
| `lib/currency.ts` | Indonesian Rupiah formatting |
| `lib/dateUtils.ts` | Date utilities with timezone support |
| `lib/phone.ts` | Indonesian phone number normalization |
| `lib/fonnte.ts` | WhatsApp messaging via Fonnte API |
| `lib/splitCommission.ts` | Staff commission calculation |
| `lib/scheduler.ts` | WA automation scheduler (started in root layout) |
| `lib/invoiceNumber.ts` | Sequential invoice number generation |
| `hooks/useTenantRouter.ts` | Client-side router that auto-prepends tenant slug |
| `hooks/usePermission.ts` | Client-side RBAC permission checks |

### Testing

- **Framework**: Vitest + jsdom + React Testing Library
- **Test location**: `__tests__/` directory mirroring source structure (`api/`, `lib/`, `hooks/`)
- **Setup**: `vitest.setup.ts` — sets `ENCRYPTION_KEY`, `HASH_SALT`, stubs `NODE_ENV=test`, restores mocks after each test
- **Path alias**: `@/` maps to project root (configured in both `tsconfig.json` and `vitest.config.ts`)
- Tests mock `getTenantModels` and `checkPermission` to avoid real DB connections

### Environment Variables

Required in `.env.local`:
- `MONGODB_URI` — default tenant DB
- `MASTER_MONGODB_URI` — master/admin DB
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` — NextAuth config
- `ENCRYPTION_KEY` — 64 hex chars for AES-256
- `HASH_SALT` — for hashing
- `FONNTE_TOKEN` — WhatsApp API
- `CRON_SECRET` — cron job auth
- `ADMIN_PIN` — admin verification

## Tech Stack

- **Next.js 16** (App Router, React 19)
- **Tailwind CSS v4** (via PostCSS)
- **MongoDB + Mongoose 9**
- **NextAuth v5** (beta)
- **TypeScript 5.9**
- **Vitest 4** for testing
- **lucide-react** for icons
- **recharts** for charts
- **react-big-calendar** for scheduling
- **xlsx** for Excel export/import
