# Doorstep Laundry Service

Next.js app for a doorstep laundry pickup and delivery service. Customers can sign up, book pickups, track orders, and pay with Stripe. Staff have a dashboard to manage the day’s loads and update order status. Notifications go out via Twilio (SMS) and Resend (email).

## Stack

- **Next.js 16** (App Router), TypeScript, Tailwind CSS
- **Auth:** NextAuth.js (credentials + optional Google), roles: customer, staff, admin
- **DB:** PostgreSQL (Supabase/Railway) with Prisma
- **Payments:** Stripe Checkout
- **Notifications:** Twilio (SMS), Resend (email)
- **Tests:** Vitest; CI with GitHub Actions

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set:

   - `DATABASE_URL` – Postgres connection string (e.g. Supabase)
   - `NEXTAUTH_SECRET` – e.g. `openssl rand -base64 32`
   - `NEXTAUTH_URL` – e.g. `http://localhost:3000`
   - Optional: Stripe, Twilio, Resend, Google OAuth (see `.env.example`)

3. **Database**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

   Seed creates a staff user: `staff@example.com` / `staff123`.

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign up as a customer or sign in as staff.

5. **Stripe webhooks (dev)**

   In a separate terminal, forward Stripe events to your local server:

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe --api-key <sk_test...>
   ```

   Copy the `whsec_...` secret it prints and set it as `STRIPE_WEBHOOK_SECRET` in your `.env`.

## Scripts

- `npm run dev` – development server
- `npm run build` – production build
- `npm run start` – run production build
- `npm run lint` – ESLint
- `npm run test` – Vitest
- `npm run db:migrate` – Prisma migrate dev
- `npm run db:seed` – seed staff user
- `npm run db:push` – Prisma db push (no migration files)

## Deployment (Vercel)

1. Push to GitHub; connect the repo in Vercel and deploy from `main`.
2. In Vercel, set env vars (see `.env.example`).
3. Run migrations against the production DB (e.g. from CI or once from local with prod `DATABASE_URL`).
4. In Stripe Dashboard, add webhook endpoint: `https://<your-vercel-domain>/api/webhooks/stripe`, event `checkout.session.completed`, and set `STRIPE_WEBHOOK_SECRET` in Vercel.

## Routes

- **Public:** `/`, `/login`, `/signup`
- **Customer:** `/dashboard`, `/book`, `/orders/[id]`, `/account`
- **Staff/Admin:** `/wash` (today’s loads, update status)
- **API:** `/api/orders`, `/api/orders/[id]`, `/api/orders/[id]/status`, `/api/checkout`, `/api/webhooks/stripe`, `/api/addresses`, `/api/account`

## Security

- All order and staff routes require auth; `/wash` and status updates require staff or admin.
- Customer data is scoped by `customer_id`; staff see only what’s needed for operations.
- No secrets in the repo; use `.env` and Vercel env vars.
