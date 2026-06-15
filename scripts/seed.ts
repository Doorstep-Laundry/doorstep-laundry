/**
 * Seed the database with users and representative orders.
 *
 * Usage:
 *   npx tsx scripts/seed.ts --mode dev    # seeds dev DB (DATABASE_URL), wipes orders first
 *   npx tsx scripts/seed.ts --mode test   # seeds test DB (DATABASE_URL_TEST), wipes orders first
 *
 * Fixed order numbers (SEED-D### / SEED-T###) let integration tests query by orderNumber.
 * Password for all seeded users: mypass1.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import type { OrderStatus, LoadStatus, PaymentStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const modeIdx = args.indexOf("--mode");
const mode = modeIdx >= 0 && args[modeIdx + 1] ? args[modeIdx + 1] : "dev";

if (mode !== "dev" && mode !== "test") {
  console.error(`Unknown mode "${mode}". Use --mode dev or --mode test.`);
  process.exit(1);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PASSWORD = "mypass1.";

const LC_LOHMAN  = { street: "2001 E Lohman Ave", city: "Las Cruces", state: "NM", zip: "88001" };
const LC_ELPASEO = { street: "1300 El Paseo Rd",  city: "Las Cruces", state: "NM", zip: "88001" };

// ── Types ─────────────────────────────────────────────────────────────────────
type LoadSeed = {
  loadNumber: number;
  loadCode: string;
  status: LoadStatus;
  location?: string;
  weightLbs?: number;
};

type HistorySeed = { status: OrderStatus; changedById?: string };

type OrderSeed = {
  order: {
    orderNumber: string;
    customerId: string;
    pickupAddressId: string;
    deliveryAddressId: string;
    status: OrderStatus;
    pickupDate: Date;
    deliveryDate: Date;
    numberOfLoads: number;
    totalCents: number;
    paymentStatus: PaymentStatus;
    stripePaymentId?: string;
    paymentWaived?: boolean;
  };
  loads: LoadSeed[];
  history: HistorySeed[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function days(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Today as YYYYMMDD, e.g. "20260615" */
function datePrefix(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** Format as ORDER-YYYYMMDD-#### */
function orderNum(seq: number): string {
  return `ORDER-${datePrefix()}-${String(seq).padStart(4, "0")}`;
}

/** Format as ORDER-YYYYMMDD-####-L# */
function loadCode(seq: number, loadNum: number): string {
  return `${orderNum(seq)}-L${loadNum}`;
}

async function upsertUser(
  prisma: PrismaClient,
  email: string,
  name: string,
  role: "admin" | "staff" | "customer"
) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash, emailVerifiedAt: new Date() },
    create: { email, name, role, passwordHash, authProvider: "credentials", emailVerifiedAt: new Date() },
  });
}

async function ensureAddress(
  prisma: PrismaClient,
  userId: string,
  label: string,
  addr: typeof LC_LOHMAN
) {
  const existing = await prisma.address.findFirst({ where: { userId, label } });
  if (existing) return existing;
  return prisma.address.create({ data: { userId, label, ...addr, isDefault: true } });
}

// ── Dev order set ─────────────────────────────────────────────────────────────
// 9 orders — one per status, plus two in_progress variants to show different load stages.
function buildDevOrders(
  adminId: string,
  c1Id: string, c1Addr: string,
  c2Id: string, c2Addr: string
): OrderSeed[] {
  const h = (...statuses: OrderStatus[]): HistorySeed[] =>
    statuses.map((status) => ({ status, changedById: adminId }));

  // Dev sequences start at 9001 — safely above any real order sequence for the day.
  return [
    // 1 ── scheduled
    {
      order: { orderNumber: orderNum(9001), customerId: c1Id, pickupAddressId: c1Addr, deliveryAddressId: c1Addr, status: "scheduled", pickupDate: days(2), deliveryDate: days(4), numberOfLoads: 1, totalCents: 0, paymentStatus: "pending" },
      loads: [{ loadNumber: 1, loadCode: loadCode(9001, 1), status: "scheduled" }],
      history: h("scheduled"),
    },
    // 2 ── picked_up
    {
      order: { orderNumber: orderNum(9002), customerId: c1Id, pickupAddressId: c1Addr, deliveryAddressId: c1Addr, status: "picked_up", pickupDate: days(0), deliveryDate: days(2), numberOfLoads: 2, totalCents: 0, paymentStatus: "pending" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9002, 1), status: "picked_up" },
        { loadNumber: 2, loadCode: loadCode(9002, 2), status: "picked_up" },
      ],
      history: h("scheduled", "picked_up"),
    },
    // 3 ── ready_for_wash (loads assigned to shelf locations)
    {
      order: { orderNumber: orderNum(9003), customerId: c2Id, pickupAddressId: c2Addr, deliveryAddressId: c2Addr, status: "ready_for_wash", pickupDate: days(-1), deliveryDate: days(1), numberOfLoads: 2, totalCents: 0, paymentStatus: "pending" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9003, 1), status: "ready_for_wash", location: "Shelf In 1" },
        { loadNumber: 2, loadCode: loadCode(9003, 2), status: "ready_for_wash", location: "Shelf In 1" },
      ],
      history: h("scheduled", "picked_up", "ready_for_wash"),
    },
    // 4 ── in_progress (loads actively in wash cycle)
    {
      order: { orderNumber: orderNum(9004), customerId: c2Id, pickupAddressId: c2Addr, deliveryAddressId: c2Addr, status: "in_progress", pickupDate: days(-2), deliveryDate: days(0), numberOfLoads: 3, totalCents: 0, paymentStatus: "pending" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9004, 1), status: "washing", location: "Washer 1" },
        { loadNumber: 2, loadCode: loadCode(9004, 2), status: "drying",  location: "Dryer 1" },
        { loadNumber: 3, loadCode: loadCode(9004, 3), status: "folding",  location: "Table 1" },
      ],
      history: h("scheduled", "picked_up", "ready_for_wash", "in_progress"),
    },
    // 5 ── in_progress (late stage — one load cleaned awaiting weigh-in, one already ready_for_delivery)
    {
      order: { orderNumber: orderNum(9005), customerId: c1Id, pickupAddressId: c1Addr, deliveryAddressId: c1Addr, status: "in_progress", pickupDate: days(-3), deliveryDate: days(0), numberOfLoads: 2, totalCents: 0, paymentStatus: "pending" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9005, 1), status: "cleaned",            location: "Table 1" },
        { loadNumber: 2, loadCode: loadCode(9005, 2), status: "ready_for_delivery", location: "Shelf out 1", weightLbs: 10 },
      ],
      history: h("scheduled", "picked_up", "ready_for_wash", "in_progress"),
    },
    // 6 ── ready_for_delivery (all loads weighed, payment due — 20 lbs × $1.50)
    {
      order: { orderNumber: orderNum(9006), customerId: c2Id, pickupAddressId: c2Addr, deliveryAddressId: c2Addr, status: "ready_for_delivery", pickupDate: days(-4), deliveryDate: days(-1), numberOfLoads: 2, totalCents: 3000, paymentStatus: "ready_for_payment" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9006, 1), status: "ready_for_delivery", location: "Shelf out 1", weightLbs: 8  },
        { loadNumber: 2, loadCode: loadCode(9006, 2), status: "ready_for_delivery", location: "Shelf out 1", weightLbs: 12 },
      ],
      history: h("scheduled", "picked_up", "ready_for_wash", "in_progress", "ready_for_delivery"),
    },
    // 7 ── out_for_delivery (16 lbs × $1.50)
    {
      order: { orderNumber: orderNum(9007), customerId: c1Id, pickupAddressId: c1Addr, deliveryAddressId: c1Addr, status: "out_for_delivery", pickupDate: days(-5), deliveryDate: days(0), numberOfLoads: 2, totalCents: 2400, paymentStatus: "ready_for_payment" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9007, 1), status: "out_for_delivery", location: "Shelf out 1", weightLbs: 7 },
        { loadNumber: 2, loadCode: loadCode(9007, 2), status: "out_for_delivery", location: "Shelf out 1", weightLbs: 9 },
      ],
      history: h("scheduled", "picked_up", "ready_for_wash", "in_progress", "ready_for_delivery", "out_for_delivery"),
    },
    // 8 ── delivered, paid via Stripe (16 lbs × $1.50)
    {
      order: { orderNumber: orderNum(9008), customerId: c2Id, pickupAddressId: c2Addr, deliveryAddressId: c2Addr, status: "delivered", pickupDate: days(-7), deliveryDate: days(-3), numberOfLoads: 2, totalCents: 2400, paymentStatus: "paid", stripePaymentId: "pi_seed_delivered_001" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9008, 1), status: "delivered", location: "Shelf out 1", weightLbs: 10 },
        { loadNumber: 2, loadCode: loadCode(9008, 2), status: "delivered", location: "Shelf out 1", weightLbs: 6  },
      ],
      history: h("scheduled", "picked_up", "ready_for_wash", "in_progress", "ready_for_delivery", "out_for_delivery", "delivered"),
    },
    // 9 ── cancelled before pickup
    {
      order: { orderNumber: orderNum(9009), customerId: c1Id, pickupAddressId: c1Addr, deliveryAddressId: c1Addr, status: "cancelled", pickupDate: days(-1), deliveryDate: days(2), numberOfLoads: 1, totalCents: 0, paymentStatus: "pending" },
      loads: [{ loadNumber: 1, loadCode: loadCode(9009, 1), status: "scheduled" }],
      history: h("scheduled", "cancelled"),
    },
  ];
}

// ── Test order set ────────────────────────────────────────────────────────────
// 8 orders — one per status, predictable weights and totals for assertions.
function buildTestOrders(
  adminId: string,
  c1Id: string, c1Addr: string,
  c2Id: string, c2Addr: string
): OrderSeed[] {
  const h = (...statuses: OrderStatus[]): HistorySeed[] =>
    statuses.map((status) => ({ status, changedById: adminId }));

  // Test sequences start at 9001 — safely above any real order sequence for the day.
  return [
    {
      order: { orderNumber: orderNum(9001), customerId: c1Id, pickupAddressId: c1Addr, deliveryAddressId: c1Addr, status: "scheduled", pickupDate: days(1), deliveryDate: days(3), numberOfLoads: 1, totalCents: 0, paymentStatus: "pending" },
      loads: [{ loadNumber: 1, loadCode: loadCode(9001, 1), status: "scheduled" }],
      history: h("scheduled"),
    },
    {
      order: { orderNumber: orderNum(9002), customerId: c1Id, pickupAddressId: c1Addr, deliveryAddressId: c1Addr, status: "picked_up", pickupDate: days(0), deliveryDate: days(2), numberOfLoads: 2, totalCents: 0, paymentStatus: "pending" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9002, 1), status: "picked_up" },
        { loadNumber: 2, loadCode: loadCode(9002, 2), status: "picked_up" },
      ],
      history: h("scheduled", "picked_up"),
    },
    {
      order: { orderNumber: orderNum(9003), customerId: c2Id, pickupAddressId: c2Addr, deliveryAddressId: c2Addr, status: "ready_for_wash", pickupDate: days(-1), deliveryDate: days(1), numberOfLoads: 2, totalCents: 0, paymentStatus: "pending" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9003, 1), status: "ready_for_wash", location: "Shelf In 1" },
        { loadNumber: 2, loadCode: loadCode(9003, 2), status: "ready_for_wash", location: "Shelf In 1" },
      ],
      history: h("scheduled", "picked_up", "ready_for_wash"),
    },
    {
      order: { orderNumber: orderNum(9004), customerId: c1Id, pickupAddressId: c1Addr, deliveryAddressId: c1Addr, status: "in_progress", pickupDate: days(-2), deliveryDate: days(1), numberOfLoads: 3, totalCents: 0, paymentStatus: "pending" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9004, 1), status: "washing", location: "Washer 1" },
        { loadNumber: 2, loadCode: loadCode(9004, 2), status: "drying",  location: "Dryer 1" },
        { loadNumber: 3, loadCode: loadCode(9004, 3), status: "folding",  location: "Table 1" },
      ],
      history: h("scheduled", "picked_up", "ready_for_wash", "in_progress"),
    },
    {
      order: { orderNumber: orderNum(9005), customerId: c2Id, pickupAddressId: c2Addr, deliveryAddressId: c2Addr, status: "ready_for_delivery", pickupDate: days(-3), deliveryDate: days(0), numberOfLoads: 2, totalCents: 3000, paymentStatus: "ready_for_payment" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9005, 1), status: "ready_for_delivery", location: "Shelf out 1", weightLbs: 8  },
        { loadNumber: 2, loadCode: loadCode(9005, 2), status: "ready_for_delivery", location: "Shelf out 1", weightLbs: 12 },
      ],
      history: h("scheduled", "picked_up", "ready_for_wash", "in_progress", "ready_for_delivery"),
    },
    {
      order: { orderNumber: orderNum(9006), customerId: c1Id, pickupAddressId: c1Addr, deliveryAddressId: c1Addr, status: "out_for_delivery", pickupDate: days(-4), deliveryDate: days(0), numberOfLoads: 2, totalCents: 2400, paymentStatus: "ready_for_payment" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9006, 1), status: "out_for_delivery", location: "Shelf out 1", weightLbs: 7 },
        { loadNumber: 2, loadCode: loadCode(9006, 2), status: "out_for_delivery", location: "Shelf out 1", weightLbs: 9 },
      ],
      history: h("scheduled", "picked_up", "ready_for_wash", "in_progress", "ready_for_delivery", "out_for_delivery"),
    },
    {
      order: { orderNumber: orderNum(9007), customerId: c2Id, pickupAddressId: c2Addr, deliveryAddressId: c2Addr, status: "delivered", pickupDate: days(-5), deliveryDate: days(-2), numberOfLoads: 2, totalCents: 2400, paymentStatus: "paid", stripePaymentId: "pi_seed_test_delivered_001" },
      loads: [
        { loadNumber: 1, loadCode: loadCode(9007, 1), status: "delivered", location: "Shelf out 1", weightLbs: 10 },
        { loadNumber: 2, loadCode: loadCode(9007, 2), status: "delivered", location: "Shelf out 1", weightLbs: 6  },
      ],
      history: h("scheduled", "picked_up", "ready_for_wash", "in_progress", "ready_for_delivery", "out_for_delivery", "delivered"),
    },
    {
      order: { orderNumber: orderNum(9008), customerId: c1Id, pickupAddressId: c1Addr, deliveryAddressId: c1Addr, status: "cancelled", pickupDate: days(-1), deliveryDate: days(2), numberOfLoads: 1, totalCents: 0, paymentStatus: "pending" },
      loads: [{ loadNumber: 1, loadCode: loadCode(9008, 1), status: "scheduled" }],
      history: h("scheduled", "cancelled"),
    },
  ];
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (mode === "test") {
    const testUrl = process.env.DATABASE_URL_TEST;
    if (!testUrl) {
      console.error("DATABASE_URL_TEST is not set. Add it to your .env file.");
      process.exit(1);
    }
    process.env.DATABASE_URL = testUrl;
    console.log("Target: DATABASE_URL_TEST");
  } else {
    console.log("Target: DATABASE_URL (dev)");
  }

  const prisma = new PrismaClient();

  try {
    console.log(`\n=== Seed (${mode}) ===\n`);

    // Wipe order data
    console.log("Clearing order data...");
    await prisma.orderStatusHistory.deleteMany({});
    await prisma.orderLoad.deleteMany({});
    await prisma.order.deleteMany({});

    // Upsert users
    console.log("Upserting users...");
    const admin = await upsertUser(prisma, "ricky@doorsteplaundrylc.com",         "Ricky (Admin)",     "admin");
                  await upsertUser(prisma, "ricky+staff1@doorsteplaundrylc.com",   "Ricky Staff 1",     "staff");
                  await upsertUser(prisma, "ricky+staff2@doorsteplaundrylc.com",   "Ricky Staff 2",     "staff");
    const c1    = await upsertUser(prisma, "ricky+1@doorsteplaundrylc.com",        "Ricky Customer 1",  "customer");
    const c2    = await upsertUser(prisma, "ricky+2@doorsteplaundrylc.com",        "Ricky Customer 2",  "customer");

    // Ensure addresses (idempotent — skipped if label already exists for that user)
    console.log("Ensuring addresses...");
    const c1Addr = await ensureAddress(prisma, c1.id, "Home", LC_LOHMAN);
    const c2Addr = await ensureAddress(prisma, c2.id, "Home", LC_ELPASEO);

    // Seed default price setting
    await prisma.setting.upsert({
      where: { key: "price_per_pound_cents" },
      update: {},
      create: { key: "price_per_pound_cents", value: "150" },
    });

    // Seed load locations (upsert so re-runs are safe)
    const LOCATIONS = [
      { name: "Shelf In 1",  sortOrder: 1 },
      { name: "Shelf out 1", sortOrder: 2 },
      { name: "Table 1",     sortOrder: 3 },
      { name: "Washer 1",    sortOrder: 4 },
      { name: "Dryer 1",     sortOrder: 5 },
    ];
    for (const loc of LOCATIONS) {
      await prisma.loadLocation.upsert({
        where: { name: loc.name },
        update: { sortOrder: loc.sortOrder },
        create: loc,
      });
    }

    // Create orders
    const orderSeeds = mode === "dev"
      ? buildDevOrders(admin.id, c1.id, c1Addr.id, c2.id, c2Addr.id)
      : buildTestOrders(admin.id, c1.id, c1Addr.id, c2.id, c2Addr.id);

    console.log(`Creating ${orderSeeds.length} orders...\n`);
    for (const { order, loads, history } of orderSeeds) {
      process.stdout.write(`  ${order.orderNumber}  ${order.status.padEnd(22)}`);
      const created = await prisma.order.create({
        data: { ...order, orderLoads: { create: loads } },
      });
      await prisma.orderStatusHistory.createMany({
        data: history.map((h) => ({ ...h, orderId: created.id })),
      });
      console.log(`✓  (${loads.length} load${loads.length !== 1 ? "s" : ""})`);
    }

    console.log(`
Users  (password: ${PASSWORD})
  admin:      ricky@doorsteplaundrylc.com
  staff:      ricky+staff1@doorsteplaundrylc.com
              ricky+staff2@doorsteplaundrylc.com
  customers:  ricky+1@doorsteplaundrylc.com
              ricky+2@doorsteplaundrylc.com
`);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
