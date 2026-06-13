import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role: string }).role;
  if (role !== "customer" && role !== "staff" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { orderId } = body;
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderLoads: true,
      customer: { select: { customPricePerPoundCents: true, nmgrtExempt: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.customerId !== userId && role === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.stripePaymentId) {
    return NextResponse.json(
      { error: "Order already paid" },
      { status: 400 }
    );
  }
  const payableStatuses = ["waiting_for_payment", "ready_for_delivery", "out_for_delivery", "delivered"];
  if (!payableStatuses.includes(order.status)) {
    return NextResponse.json(
      { error: "Order is not ready for payment yet" },
      { status: 400 }
    );
  }

  const [setting, grtPercent] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "price_per_pound_cents" } }),
    (await import("@/lib/settings")).getGrtPercent(),
  ]);
  const defaultPriceCents = setting ? parseInt(String(setting.value), 10) || 150 : 150;
  const { getEffectivePricing, computeOrderTotalWithTax } = await import("@/lib/order-total");
  const { pricePerPoundCents, nmgrtExempt } = getEffectivePricing(
    order,
    order.customer,
    defaultPriceCents
  );
  const { subtotalCents, taxCents, totalCents } = computeOrderTotalWithTax(
    order.orderLoads,
    pricePerPoundCents,
    grtPercent,
    nmgrtExempt
  );
  if (totalCents <= 0) {
    return NextResponse.json(
      { error: "Order total has not been set; contact support" },
      { status: 400 }
    );
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { totalCents },
  });

  const { buildWashAndBulkyStripeLineItems } = await import(
    "@/lib/checkout-line-items"
  );
  const lineItems = buildWashAndBulkyStripeLineItems(
    {
      orderNumber: order.orderNumber,
      pickupDate: order.pickupDate,
      deliveryDate: order.deliveryDate,
    },
    order.orderLoads,
    pricePerPoundCents
  );
  if (lineItems.length === 0) {
    return NextResponse.json(
      { error: "Order has no billable weight or bulky items; contact support" },
      { status: 400 }
    );
  }
  if (!nmgrtExempt && taxCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: `NMGRT (${grtPercent}%)`,
          description: "New Mexico Gross Receipts Tax",
        },
        unit_amount: taxCents,
      },
      quantity: 1,
    });
  }

  try {
    const stripe = getStripe();
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${baseUrl}/orders/${orderId}?paid=1`,
      cancel_url: `${baseUrl}/orders/${orderId}`,
      metadata: {
        orderId,
        order_number: order.orderNumber,
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Stripe checkout error:", e);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
