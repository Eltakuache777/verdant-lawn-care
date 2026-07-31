import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Admin-only (see middleware.ts). A completed booking can bundle multiple
// services under one amountPaid (e.g. "Mowing + Bin Cleaning" paid as $65
// total) — there's no itemized per-service payment, so each service's share
// of that booking's revenue is allocated proportionally to its current base
// price relative to the other services in the same booking.
export async function GET() {
  const [completed, services, workerPayments] = await Promise.all([
    prisma.booking.findMany({ where: { status: "completed", amountPaid: { not: null } } }),
    prisma.service.findMany(),
    prisma.workerPayment.findMany({ orderBy: { paidAt: "desc" } }),
  ]);

  const basePriceByName = new Map(services.map((s) => [s.name, s.basePrice]));
  const perService = new Map<string, { count: number; revenue: number }>();

  for (const b of completed) {
    const paid = b.amountPaid ?? 0;
    const weights = b.services.map((name) => basePriceByName.get(name) ?? 1);
    const totalWeight = weights.reduce((a, c) => a + c, 0) || 1;
    b.services.forEach((name, i) => {
      const share = paid * (weights[i] / totalWeight);
      const entry = perService.get(name) ?? { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += share;
      perService.set(name, entry);
    });
  }

  const totalRevenue = completed.reduce((sum, b) => sum + (b.amountPaid ?? 0), 0);
  const totalPaidToWorkers = workerPayments.reduce((sum, p) => sum + p.amount, 0);

  return NextResponse.json({
    perService: Array.from(perService.entries()).map(([name, v]) => ({
      name,
      count: v.count,
      revenue: Math.round(v.revenue * 100) / 100,
    })),
    totalRevenue,
    totalPaidToWorkers,
    net: totalRevenue - totalPaidToWorkers,
    workerPayments,
  });
}
