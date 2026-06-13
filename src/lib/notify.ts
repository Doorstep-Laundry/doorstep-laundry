import { prisma } from "./db";
import Twilio from "twilio";
import { Resend } from "resend";
import { getGrtPercent, getCompanyInfo, getPricePerPoundCents } from "./settings";
import { toE164 } from "./phone";
import { generateReceiptPdf } from "./receipt-pdf";
import type { PastDueOrder } from "./past-due";

export type NotifyEvent =
  | "order_created"
  | "pickup_scheduled"
  | "out_for_pickup"
  | "picked_up"
  | "in_progress"
  | "out_for_delivery"
  | "delivery_update"
  | "delivered"
  | "payment_received"
  | "ready_for_payment";

export type DeliveryUpdatePayload = {
  stopsAway?: number;
  etaMinutes?: number;
};

export type ReadyForPaymentPayload = {
  orderNumber: string;
  totalCents: number;
  totalLbs: number;
  perLoadLbs: number[];
  paymentUrl: string;
};

const eventMessages: Record<
  NotifyEvent,
  { sms: string; subject: string; body: string }
> = {
  order_created: {
    sms: "Your laundry order was created. We'll confirm pickup and delivery times.",
    subject: "Order created – Doorstep Laundry",
    body: "Your laundry order was created. We'll confirm pickup and delivery times.",
  },
  pickup_scheduled: {
    sms: "Your laundry pickup has been scheduled.",
    subject: "Pickup scheduled – Doorstep Laundry",
    body: "Your laundry pickup has been scheduled.",
  },
  out_for_pickup: {
    sms: "Our driver is on the way to pick up your laundry.",
    subject: "Out for pickup – Doorstep Laundry",
    body: "Our driver is on the way to pick up your laundry.",
  },
  picked_up: {
    sms: "Your laundry has been picked up and is on its way to our facility.",
    subject: "Laundry picked up – Doorstep Laundry",
    body: "Your laundry has been picked up and is on its way to our facility.",
  },
  in_progress: {
    sms: "Your laundry is being washed and folded.",
    subject: "In progress – Doorstep Laundry",
    body: "Your laundry is being washed and folded.",
  },
  out_for_delivery: {
    sms: "Your laundry is out for delivery.",
    subject: "Out for delivery – Doorstep Laundry",
    body: "Your laundry is out for delivery.",
  },
  delivery_update: {
    sms: "Driver is {{stopsAway}} stops away. Approx arrival in {{etaMinutes}} min.",
    subject: "Delivery update – Doorstep Laundry",
    body: "Driver is {{stopsAway}} stops away. Approx arrival in {{etaMinutes}} min.",
  },
  delivered: {
    sms: "Your laundry has been delivered. Thank you!",
    subject: "Delivered – Doorstep Laundry",
    body: "Your laundry has been delivered. Thank you for using Doorstep Laundry!",
  },
  payment_received: {
    sms: "We've received your payment. Your order is confirmed.",
    subject: "Payment received – Order confirmed",
    body: "We've received your payment. Your order is confirmed.",
  },
  ready_for_payment: {
    sms: "Your laundry is ready! Total {{total}} ({{totalLbs}} lbs). Check your email for the payment link. Ref: {{orderNumber}}",
    subject: "Your laundry is ready – one step to complete",
    body: "Your laundry is ready! Total: {{total}} ({{totalLbs}} lbs). Pay now: {{paymentUrl}} Transaction #{{orderNumber}}",
  },
};

function interpolate(
  template: string,
  payload: DeliveryUpdatePayload | undefined
): string {
  if (!payload) return template;
  let out = template;
  if (typeof payload.stopsAway === "number") {
    out = out.replace(
      "{{stopsAway}}",
      payload.stopsAway === 0 ? "your next stop" : String(payload.stopsAway)
    );
    if (payload.stopsAway === 0) {
      out = out.replace(" stops away", ""); // "Driver is your next stop. Approx..."
    }
  }
  if (typeof payload.etaMinutes === "number") {
    out = out.replace("{{etaMinutes}}", String(payload.etaMinutes));
  }
  return out;
}

function interpolateReadyForPayment(
  template: string,
  payload: ReadyForPaymentPayload
): string {
  const total = `$${(Math.round(payload.totalCents) / 100).toFixed(2)}`;
  return template
    .replace(/\{\{total\}\}/g, total)
    .replace(/\{\{totalLbs\}\}/g, String(payload.totalLbs))
    .replace(/\{\{paymentUrl\}\}/g, payload.paymentUrl)
    .replace(/\{\{orderNumber\}\}/g, payload.orderNumber);
}

export function getReadyForPaymentEmailHtml(payload: ReadyForPaymentPayload): string {
  const total = `$${(Math.round(payload.totalCents) / 100).toFixed(2)}`;
  const url = payload.paymentUrl.replace(/"/g, "&quot;");
  return `
    <p style="margin:0 0 1em; font-family: sans-serif; font-size: 16px; line-height: 1.5; color: #1a1a1a;">
      Hi,
    </p>
    <p style="margin:0 0 1em; font-family: sans-serif; font-size: 16px; line-height: 1.5; color: #1a1a1a;">
      Your laundry is all set! We weighed <strong>${payload.totalLbs} lbs</strong> — your total is <strong>${total}</strong>.
    </p>
    <p style="margin:0 0 1em; font-family: sans-serif; font-size: 16px; line-height: 1.5; color: #1a1a1a;">
      <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #4a7c59; color: #fff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 16px;">Pay now</a>
    </p>
    <p style="margin:0; font-family: sans-serif; font-size: 14px; line-height: 1.5; color: #666;">
      Order reference: ${payload.orderNumber}
    </p>
  `.trim();
}

function buildPastDueReminderHtml(orders: PastDueOrder[], baseUrl: string): string {
  const rows = orders
    .map((o) => {
      const total = `$${(Math.round(o.totalCents) / 100).toFixed(2)}`;
      const url = `${baseUrl}/orders/${o.id}`.replace(/"/g, "&quot;");
      return `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-family: sans-serif; font-size: 14px; color: #1a1a1a;">${o.orderNumber}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-family: sans-serif; font-size: 14px; color: #1a1a1a;">${total}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-family: sans-serif; font-size: 14px;">
            <a href="${url}" style="display: inline-block; padding: 6px 16px; background: #4a7c59; color: #fff; text-decoration: none; font-weight: 600; border-radius: 6px; font-size: 13px;">Pay now</a>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <p style="margin: 0 0 1em; font-family: sans-serif; font-size: 16px; line-height: 1.5; color: #1a1a1a;">Hi,</p>
    <p style="margin: 0 0 1em; font-family: sans-serif; font-size: 16px; line-height: 1.5; color: #1a1a1a;">
      You have an outstanding balance on a previous laundry order. Please pay your balance before scheduling your next pickup.
    </p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5em;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 8px; border-bottom: 2px solid #d1fae5; font-family: sans-serif; font-size: 13px; color: #4a7c59;">Order</th>
          <th style="text-align: left; padding: 8px; border-bottom: 2px solid #d1fae5; font-family: sans-serif; font-size: 13px; color: #4a7c59;">Balance</th>
          <th style="padding: 8px; border-bottom: 2px solid #d1fae5;"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin: 0; font-family: sans-serif; font-size: 14px; line-height: 1.5; color: #666;">
      Questions? Reply to this email or contact us directly.
    </p>
  `.trim();
}

/**
 * Sends a past-due balance reminder email to the customer.
 * Fires when a customer attempts to schedule a new pickup with an outstanding balance.
 */
export async function sendPastDueReminderEmail(
  customerId: string,
  pastDueOrders: PastDueOrder[]
): Promise<{ email: boolean }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[notify] RESEND_API_KEY not set; skipping past-due reminder email");
    return { email: false };
  }
  if (pastDueOrders.length === 0) return { email: false };

  const customer = await prisma.user.findUnique({
    where: { id: customerId },
    select: { email: true, name: true },
  });
  if (!customer?.email?.trim()) {
    console.warn("[notify] No email for customer", customerId, "— skipping past-due reminder");
    return { email: false };
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "notifications@example.com";
  const totalOwed = `$${(pastDueOrders.reduce((s, o) => s + o.totalCents, 0) / 100).toFixed(2)}`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const sendResult = await resend.emails.send({
      from: fromEmail,
      to: customer.email.trim(),
      subject: `Outstanding balance of ${totalOwed} – Doorstep Laundry`,
      text: pastDueOrders
        .map(
          (o) =>
            `Order ${o.orderNumber}: $${(o.totalCents / 100).toFixed(2)} — pay at ${baseUrl}/orders/${o.id}`
        )
        .join("\n"),
      html: buildPastDueReminderHtml(pastDueOrders, baseUrl),
    });
    if (sendResult.error) {
      const msg =
        typeof sendResult.error === "object" && sendResult.error !== null && "message" in sendResult.error
          ? String((sendResult.error as { message: unknown }).message)
          : String(sendResult.error);
      console.error("[notify] Resend past-due reminder error:", msg, "customer:", customer.email);
      return { email: false };
    }
    return { email: true };
  } catch (e) {
    console.error("[notify] sendPastDueReminderEmail exception:", e);
    return { email: false };
  }
}

export async function sendOrderNotification(
  orderId: string,
  event: NotifyEvent,
  payload?: DeliveryUpdatePayload | ReadyForPaymentPayload
): Promise<{ sms?: boolean; email?: boolean }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        select: {
          email: true,
          name: true,
          phone: true,
          ...(event === "payment_received"
            ? { customPricePerPoundCents: true, nmgrtExempt: true }
            : {}),
        },
      },
      ...(event === "payment_received"
        ? {
            pickupAddress: true,
            deliveryAddress: true,
            orderLoads: { orderBy: { loadNumber: "asc" as const } },
          }
        : {}),
    },
  });
  if (!order) return {};
  if (!order.customer) {
    console.error("[notify] Order has no customer relation:", orderId, order.orderNumber);
    return {};
  }

  const msg = eventMessages[event];
  if (!msg) return {};

  let smsText: string;
  let emailBody: string;
  let subject: string;
  if (event === "delivery_update" && payload && "stopsAway" in payload) {
    smsText = interpolate(msg.sms, payload);
    emailBody = interpolate(msg.body, payload);
    subject = "Delivery update – Doorstep Laundry";
  } else if (event === "ready_for_payment" && payload && "orderNumber" in payload) {
    smsText = interpolateReadyForPayment(msg.sms, payload);
    emailBody = interpolateReadyForPayment(msg.body, payload);
    subject = msg.subject;
  } else {
    smsText = msg.sms;
    emailBody = msg.body;
    subject = msg.subject;
  }

  const result = { sms: false, email: false };
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "notifications@example.com";
  if (!process.env.RESEND_FROM_EMAIL && process.env.RESEND_API_KEY) {
    console.warn("[notify] RESEND_FROM_EMAIL not set; using fallback (may fail if domain not verified in Resend)");
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  const canSendSms =
    twilioSid &&
    twilioToken &&
    (twilioMessagingServiceSid || twilioFrom) &&
    order.customer.phone;
  if (canSendSms) {
    const toPhoneE164 = toE164(order.customer.phone!);
    if (!toPhoneE164) {
      console.warn("[notify] Customer phone not in valid format for SMS:", order.orderNumber);
    } else {
      try {
        const client = Twilio(twilioSid, twilioToken);
        await client.messages.create(
          twilioMessagingServiceSid
            ? {
                body: `[${order.orderNumber}] ${smsText}`,
                messagingServiceSid: twilioMessagingServiceSid,
                to: toPhoneE164,
              }
            : {
                body: `[${order.orderNumber}] ${smsText}`,
                from: twilioFrom!,
                to: toPhoneE164,
              }
        );
        result.sms = true;
      } catch (e) {
        console.error("Twilio SMS error:", e);
      }
    }
  }

  if (!order.customer.email?.trim()) {
    console.warn("[notify] Skipping email: no customer email for order", order.orderNumber);
  } else if (!process.env.RESEND_API_KEY) {
    console.warn("[notify] RESEND_API_KEY not set; skipping email for", order.orderNumber);
  } else {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const toEmail = order.customer.email.trim();
      const isPayment = event === "ready_for_payment" && payload && "orderNumber" in payload && "paymentUrl" in payload;
      const paymentPayload = isPayment ? (payload as ReadyForPaymentPayload) : null;
      const emailPayload: {
        from: string;
        to: string;
        subject: string;
        text: string;
        html?: string;
        attachments?: { filename: string; content: Buffer }[];
      } = {
        from: fromEmail,
        to: toEmail,
        subject: paymentPayload ? "Your laundry is ready – pay now" : subject,
        text: paymentPayload
          ? `Your laundry is ready. Total $${(Math.round(paymentPayload.totalCents) / 100).toFixed(2)} (${paymentPayload.totalLbs} lbs). Pay here: ${paymentPayload.paymentUrl} Ref: ${paymentPayload.orderNumber}`
          : `Order ${order.orderNumber}: ${emailBody}`,
      };
      if (paymentPayload) {
        emailPayload.html = getReadyForPaymentEmailHtml(paymentPayload);
      }
      if (event === "payment_received" && order.customer && "pickupAddress" in order && "deliveryAddress" in order && "orderLoads" in order) {
        try {
          const [defaultPriceCents, grtPercent, company] = await Promise.all([
            getPricePerPoundCents(),
            getGrtPercent(),
            getCompanyInfo(),
          ]);
          const { getEffectivePricing } = await import("./order-total");
          const customerPricing =
            order.customer && "customPricePerPoundCents" in order.customer
              ? (order.customer as { customPricePerPoundCents?: number | null; nmgrtExempt?: boolean })
              : null;
          const { pricePerPoundCents, nmgrtExempt } = getEffectivePricing(
            order,
            customerPricing,
            defaultPriceCents
          );
          const receiptOrder = {
            orderNumber: order.orderNumber,
            totalCents: order.totalCents,
            createdAt: order.createdAt,
            pickupDate: order.pickupDate,
            deliveryDate: order.deliveryDate,
            pickupTimeSlot: order.pickupTimeSlot,
            deliveryTimeSlot: order.deliveryTimeSlot,
            customer: {
              name: order.customer.name ?? null,
              email: order.customer.email ?? "",
              phone: "phone" in order.customer ? order.customer.phone ?? null : null,
            },
            pickupAddress: order.pickupAddress,
            deliveryAddress: order.deliveryAddress,
            orderLoads: order.orderLoads.map(
              (l: {
                loadNumber: number;
                weightLbs: number | null;
                bulkyItems?: unknown;
                hotWater?: boolean;
                bleach?: boolean;
                hypoallergenic?: boolean;
                delicateCycle?: boolean;
                scentFree?: boolean;
                coldWaterOnly?: boolean;
              }) => ({
                loadNumber: l.loadNumber,
                weightLbs: l.weightLbs,
                bulkyItems: l.bulkyItems ?? null,
                hotWater: l.hotWater,
                bleach: l.bleach,
                hypoallergenic: l.hypoallergenic,
                delicateCycle: l.delicateCycle,
                scentFree: l.scentFree,
                coldWaterOnly: l.coldWaterOnly,
              })
            ),
          };
          const pdfBuffer = await generateReceiptPdf(receiptOrder, {
            pricePerPoundCents,
            grtPercent,
            nmgrtExempt,
            company,
          });
          emailPayload.attachments = [{ filename: `receipt-${order.orderNumber}.pdf`, content: pdfBuffer }];
        } catch (e) {
          console.error("[notify] Failed to generate receipt PDF for payment_received:", e);
        }
      }
      const sendResult = await resend.emails.send(emailPayload);
      if (sendResult.error) {
        const msg =
          typeof sendResult.error === "object" &&
          sendResult.error !== null &&
          "message" in sendResult.error
            ? String((sendResult.error as { message: unknown }).message)
            : String(sendResult.error);
        console.error("[notify] Resend returned error:", msg, "order:", order.orderNumber, "to:", toEmail);
        throw new Error(`Resend: ${msg}`);
      }
      result.email = true;
    } catch (e) {
      console.error("[notify] Resend email exception:", e, "order:", order.orderNumber);
      throw e;
    }
  }

  return result;
}
