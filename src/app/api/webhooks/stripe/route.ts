import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { sendOrderNotification } from "@/lib/notify";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }
  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    console.error("Stripe webhook signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    return NextResponse.json({ received: true });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });
  if (!order) {
    return NextResponse.json({ received: true });
  }
  if (order.stripePaymentId) {
    return NextResponse.json({ received: true });
  }

  const paymentId = String(session.payment_intent ?? session.id);

  // If still waiting for payment, advance to ready_for_delivery.
  // If delivery already proceeded (ready_for_delivery, out_for_delivery, delivered), just record payment.
  if (order.status === "waiting_for_payment") {
    await prisma.order.update({
      where: { id: orderId },
      data: { stripePaymentId: paymentId, status: "ready_for_delivery" },
    });
    await prisma.orderLoad.updateMany({
      where: { orderId },
      data: { status: "ready_for_delivery" },
    });
    await prisma.orderStatusHistory.create({
      data: { orderId, status: "ready_for_delivery", note: "Payment received; ready for delivery" },
    });
  } else {
    await prisma.order.update({
      where: { id: orderId },
      data: { stripePaymentId: paymentId },
    });
  }

  await sendOrderNotification(orderId, "payment_received").catch((e) =>
    console.error("Notify payment_received:", e)
  );

  return NextResponse.json({ received: true });
}
