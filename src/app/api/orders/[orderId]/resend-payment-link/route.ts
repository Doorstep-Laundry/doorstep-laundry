import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { sendOrderNotification } from "@/lib/notify";

/**
 * POST: Resend payment email and Stripe link for an order ready for payment.
 * Customer (own order) or staff/admin.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role: string }).role;
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderLoads: true,
      customer: {
        select: { email: true, phone: true, customPricePerPoundCents: true, nmgrtExempt: true },
      },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.customerId !== userId && !isStaff(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const payableStatuses = ["ready_for_delivery", "out_for_delivery", "delivered"];
  if (!payableStatuses.includes(order.status)) {
    return NextResponse.json(
      { error: "Order is not ready for payment" },
      { status: 400 }
    );
  }
  if (order.stripePaymentId) {
    return NextResponse.json(
      { error: "Order is already paid" },
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
  const premiumSurchargePerPoundCents = order.premiumSurchargePerPoundCents ?? 0;
  const { taxCents, totalCents } = computeOrderTotalWithTax(
    order.orderLoads,
    pricePerPoundCents,
    grtPercent,
    nmgrtExempt,
    premiumSurchargePerPoundCents
  );
  if (totalCents <= 0) {
    return NextResponse.json(
      { error: "Order total not set; contact support" },
      { status: 400 }
    );
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { totalCents },
  });

  const loads = order.orderLoads;
  const totalLbs = loads.reduce((sum: number, l: { weightLbs?: number | null }) => sum + (Number(l.weightLbs) || 0), 0);
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  let paymentUrl = `${baseUrl}/orders/${orderId}`;
  const { buildWashAndBulkyStripeLineItems } = await import(
    "@/lib/checkout-line-items"
  );
  const lineItems = buildWashAndBulkyStripeLineItems(
    {
      orderNumber: order.orderNumber,
      pickupDate: order.pickupDate,
      deliveryDate: order.deliveryDate,
    },
    loads,
    pricePerPoundCents,
    premiumSurchargePerPoundCents
  );
  if (lineItems.length === 0) {
    return NextResponse.json(
      { error: "Order has no billable weight or bulky items" },
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
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${baseUrl}/orders/${orderId}?paid=1`,
      cancel_url: `${baseUrl}/orders/${orderId}`,
      metadata: { orderId, order_number: order.orderNumber },
    });
    if (checkoutSession.url) paymentUrl = checkoutSession.url;
  } catch (e) {
    console.error("Stripe checkout session (resend):", e);
    return NextResponse.json(
      { error: "Failed to create payment link" },
      { status: 500 }
    );
  }

  try {
    const notifyResult = await sendOrderNotification(orderId, "ready_for_payment", {
      orderNumber: order.orderNumber,
      totalCents,
      totalLbs,
      perLoadLbs: loads.map((l: { weightLbs?: number | null }) => l.weightLbs ?? 0),
      paymentUrl,
    });
    if (!notifyResult.email) {
      console.error("[resend-payment-link] Email not sent for", order.orderNumber, "customer:", order.customer?.email);
      return NextResponse.json(
        { error: "Payment email could not be sent. Check customer email and Resend configuration." },
        { status: 502 }
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Notification failed";
    console.error("[resend-payment-link]", msg, e);
    return NextResponse.json(
      { error: msg.startsWith("Resend:") ? msg.replace(/^Resend: /, "") : "Failed to send payment email" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
