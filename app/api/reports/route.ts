import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Admin sees the full business report. Workers only see their own logged
// payments — the owner's revenue/profit numbers aren't any employee's business.
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (session?.role !== "admin") {
    const myPayments = session?.email
      ? await prisma.workerPayment.findMany({
          where: { workerEmail: session.email },
          orderBy: { paidAt: "desc" },
        })
      : [];
    const myTotalPaid = myPayments.reduce((sum, p) => sum + p.amount, 0);
    return NextResponse.json({ role: "worker", myPayments, myTotalPaid });
  }

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
    role: "admin",
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
