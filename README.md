# CENT

**Full-stack mobile finance application — portfolio review for Alan Mashensky**

I designed and wrote all of the code in this repository: the React Native (Expo) mobile app, the NestJS API, and the integration layer with Supabase and third-party services. This is a sanitized version prepared for review — credentials, customer data, production secrets, and operational artifacts have been removed.

---

## What this is

CENT is a personal finance platform for mobile. Users can manage balances, move money, invest, set savings goals, split expenses with friends, buy insurance, and interact with POS and payment flows. The codebase reflects end-to-end ownership: product flows in the app, business logic in the API, and persistence through Supabase (PostgreSQL).

## Tech stack

| Layer | Technology |
|-------|------------|
| Mobile app | React Native, Expo Router, TypeScript |
| Backend API | NestJS, TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | JWT, PIN verification, Twilio OTP |
| Payments | OpenPay, MT Center integrations |
| Notifications | Expo push notifications |

## Project structure

```
cent2025-main/
├── app/                 # Expo mobile app (screens, components, services)
│   ├── (tabs)/          # Main tab navigation (dashboard, goals, investments, etc.)
│   ├── auth/            # Login, signup wizard, password recovery
│   ├── components/      # Shared UI components
│   ├── contexts/        # React context (auth, data)
│   └── services/        # API client layer
├── backend/
│   └── src/
│       ├── auth/        # Authentication & OTP
│       ├── balance/     # Balance calculations & ledger
│       ├── transactions/# Deposits, transfers, payments
│       ├── investments/ # Term investments & domiciliation
│       ├── goals/       # Savings goals
│       ├── insurance/   # Insurance plans & contracts
│       ├── split-requests/ # Bill splitting between users
│       ├── pos/         # Point-of-sale operations
│       ├── admin/       # Admin panel API
│       ├── payments/    # OpenPay & payment OTP
│       └── supabase/    # Database access layer
├── .env.example         # Frontend environment template
└── backend/env.example  # Backend environment template
```

## Features (high level)

- **Authentication** — Phone-based signup/login, OTP via Twilio, JWT sessions, PIN for sensitive operations
- **Dashboard & balance** — Available vs. total balance, recent activity, financial summary
- **Transactions** — Internal transfers, external SPEI-style transfers, deposits
- **Investments** — Fixed-term investments with configurable rates
- **Goals** — Savings goals with progress tracking and funding
- **Insurance** — Plan catalog and contract management
- **Split requests** — Create and settle shared expenses between app users
- **Referrals** — Referral codes and commission tracking
- **POS & payments** — POS deposits, OpenPay card top-ups, MT Center bill pay
- **Admin API** — Customer management, reports, insurance approval workflows
- **Push notifications** — Transactional alerts via Expo

## Getting started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npx expo`)
- A Supabase project (URL + anon key + service role key)
- Twilio account (for OTP in auth flows)

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure environment

Copy the example files and fill in your own values:

```bash
cp .env.example .env
cp backend/env.example backend/.env
```

At minimum you need:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `TWILIO_*` variables (see `backend/env.example` for the full list)
- `EXPO_PUBLIC_API_URL` pointing to your local or deployed backend

Optional integrations (OpenPay, MT Center, Expo push) can be left unset; those features will not work until configured.

### 3. Run locally

Start both frontend and backend:

```bash
npm run dev
```

Or run them separately:

```bash
# Terminal 1 — API (port 3001)
cd backend && npm run start:dev

# Terminal 2 — mobile app
npm start
```

### 4. Build

```bash
npm run build
```

## Notes for review

- **Sanitized for sharing** — No real user data, API keys, SQL dumps, or production deployment configs are included. Placeholder values are in the `.env.example` files.
- **Requires real infrastructure** — Unlike a mock demo, the API expects a configured Supabase instance. Endpoints fail explicitly when the database is unavailable rather than returning fake data.
- **Legacy auth compatibility** — Password verification supports legacy hash formats from an earlier system migration (salted SHA-1 variants), implemented in `backend/src/auth/`.
- **Monorepo** — npm workspaces; the root `package.json` orchestrates both `app/` and `backend/`.

## What to look at

If you're reviewing architecture and code quality, these are good entry points:

| Area | Where to start |
|------|----------------|
| Auth flow | `backend/src/auth/`, `app/auth/`, `app/contexts/AuthContext.tsx` |
| API design | `backend/src/app.module.ts`, any `*.controller.ts` |
| Data layer | `backend/src/supabase/supabase.service.ts` |
| Mobile UX | `app/(tabs)/dashboard.tsx`, `app/services/` |
| Business logic | `backend/src/balance/`, `backend/src/transactions/`, `backend/src/goals/` |

---

*Prepared by Michael for Alan Mashensky's review.*
