import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGrtPercent, getCompanyInfo, getPricePerPoundCents } from "@/lib/settings";
import { generateReceiptPdf } from "@/lib/receipt-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { orderId } = await params;
  const role = (session.user as { role: string }).role;
  const userId = (session.user as { id: string }).id;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        select: { name: true, email: true, phone: true, customPricePerPoundCents: true, nmgrtExempt: true },
      },
      pickupAddress: true,
      deliveryAddress: true,
      orderLoads: { orderBy: { loadNumber: "asc" } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (role === "customer" && order.customerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!order.stripePaymentId) {
    return NextResponse.json(
      { error: "Receipt is only available for paid orders" },
      { status: 400 }
    );
  }

  try {
    const [defaultPriceCents, grtPercent, company] = await Promise.all([
      getPricePerPoundCents(),
      getGrtPercent(),
      getCompanyInfo(),
    ]);
    const { getEffectivePricing } = await import("@/lib/order-total");
    const { pricePerPoundCents, nmgrtExempt } = getEffectivePricing(
      order,
      order.customer,
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
        name: order.customer?.name ?? null,
        email: order.customer?.email ?? "",
        phone: order.customer?.phone ?? null,
      },
      pickupAddress: order.pickupAddress,
      deliveryAddress: order.deliveryAddress,
      orderLoads: order.orderLoads.map((l) => ({
        loadNumber: l.loadNumber,
        weightLbs: l.weightLbs,
        bulkyItems: l.bulkyItems ?? null,
        creditedLoad: l.creditedLoad,
        hotWater: l.hotWater,
        bleach: l.bleach,
        hypoallergenic: l.hypoallergenic,
        delicateCycle: l.delicateCycle,
        scentFree: l.scentFree,
        coldWaterOnly: l.coldWaterOnly,
      })),
    };
    const pdfBuffer = await generateReceiptPdf(receiptOrder, {
      pricePerPoundCents,
      grtPercent,
      nmgrtExempt,
      company,
    });
    const filename = `receipt-${order.orderNumber}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (e) {
    console.error("[receipt] PDF generation failed:", e);
    return NextResponse.json(
      { error: "Failed to generate receipt" },
      { status: 500 }
    );
  }
}
