// Báo cáo doanh thu cho quản trị + xuất Excel bằng write-excel-file.

import writeExcelFile from "write-excel-file/node";
import { prisma } from "../../lib/prisma.js";
import { businessTimeParts, BUSINESS_UTC_OFFSET } from "../../lib/businessTime.js";

export interface ReportRange {
  from: Date;
  to: Date;
}

/** from/to: ưu tiên ISO datetime, fallback cho "YYYY-MM-DD" (00:00 / 23:59:59). */
export const parseRange = (fromRaw?: string, toRaw?: string): ReportRange => {
  const now = new Date();
  const from = fromRaw ? parseDate(fromRaw) : new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const to = toRaw ? parseDate(toRaw, true) : now;
  return { from, to };
};

const parseDate = (raw: string, endOfDay = false): Date => {
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  // Ngày trần "YYYY-MM-DD" hiểu là nửa đầu/cuối ngày theo giờ VN — báo cáo phục vụ khách Việt,
  // không theo TZ máy chủ (CI/docker chạy UTC).
  const d = new Date(endOfDay ? `${raw}T23:59:59.999${BUSINESS_UTC_OFFSET}` : `${raw}T00:00:00${BUSINESS_UTC_OFFSET}`);
  if (Number.isNaN(d.getTime())) throw new Error("Khoảng ngày không hợp lệ");
  return d;
};

const loadOrders = async ({ from, to }: ReportRange) => {
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: {
      items: { include: { food: true } },
      user: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return orders;
};

export const summary = async (range: ReportRange) => {
  const orders = await loadOrders(range);
  const active = orders.filter((o) => o.status !== "CANCELLED");
  const revenue = active.reduce((sum, o) => sum + Number(o.total), 0);
  const completed = orders.filter((o) => o.status === "COMPLETED").length;
  const avgOrder = active.length === 0 ? 0 : Math.round((revenue / active.length) * 100) / 100;
  const customerCount = new Set(active.map((o) => o.userId)).size;
  const promotionDiscount = active.reduce((sum, o) => sum + Number(o.discountTotal ?? 0), 0);
  return {
    revenue,
    orderCount: active.length,
    completedCount: completed,
    avgOrder,
    customerCount,
    promotionDiscount,
  };
};

export const revenueByDay = async (range: ReportRange) => {
  const orders = await loadOrders(range);
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    // Doanh thu theo ngày bucket theo ngày lịch VN, không theo ngày UTC.
    const day = businessTimeParts(o.createdAt).dayKey;
    const entry = byDay.get(day) ?? { revenue: 0, orders: 0 };
    entry.revenue += Number(o.total);
    entry.orders += 1;
    byDay.set(day, entry);
  }
  return [...byDay.entries()]
    .map(([date, v]) => ({ date, revenue: v.revenue, orders: v.orders }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const topFoods = async (range: ReportRange, limit: number) => {
  const orders = await loadOrders(range);
  const qty = new Map<string, number>();
  const rev = new Map<string, number>();
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    for (const item of o.items) {
      if (!item.food) continue;
      const name = item.food.name;
      qty.set(name, (qty.get(name) ?? 0) + item.quantity);
      // Doanh thu sau giảm giá của cả dòng.
      const net = Number(item.price) * item.quantity - Number(item.discountAmount ?? 0);
      rev.set(name, (rev.get(name) ?? 0) + net);
    }
  }
  return [...qty.entries()]
    .map(([name, quantity]) => ({ name, quantity, revenue: rev.get(name) ?? 0 }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
};

/** Xuất Excel 4 sheet: Tổng quan, Doanh thu, Top món, Đơn hàng. */
export const exportExcel = async (range: ReportRange): Promise<Buffer> => {
  const orders = await loadOrders(range);
  const s = await summary(range);
  const byDay = await revenueByDay(range);
  const top = await topFoods(range, 20);

  const sheets = [
    {
      sheet: "Tong quan",
      data: [
        ["Chỉ số", "Giá trị"],
        ["Doanh thu", s.revenue],
        ["Số đơn", s.orderCount],
        ["Đơn hoàn thành", s.completedCount],
        ["Giá trị đơn TB", s.avgOrder],
        ["Khách hàng", s.customerCount],
        ["Tổng giảm khuyến mãi", s.promotionDiscount],
      ],
      columns: [{ width: 28 }, { width: 28 }],
    },
    {
      sheet: "Doanh thu",
      data: [
        ["Ngày", "Doanh thu", "Số đơn"],
        ...byDay.map((p) => [p.date, p.revenue, p.orders]),
      ],
      columns: [{ width: 18 }, { width: 18 }, { width: 18 }],
    },
    {
      sheet: "Top mon",
      data: [
        ["Món", "Số lượng", "Doanh thu"],
        ...top.map((t) => [t.name, t.quantity, t.revenue]),
      ],
      columns: [{ width: 30 }, { width: 30 }, { width: 30 }],
    },
    {
      sheet: "Don hang",
      data: [
        ["Mã đơn", "Ngày", "Trạng thái", "Tổng tiền", "Giảm giá", "Khách"],
        ...orders.map((o) => [
          o.id,
          o.createdAt.toISOString(),
          o.status,
          Number(o.total),
          Number(o.discountTotal ?? 0),
          o.user?.email ?? "",
        ]),
      ],
      columns: [{ width: 24 }, { width: 24 }, { width: 24 }, { width: 24 }, { width: 24 }, { width: 24 }],
    },
  ];

  return writeExcelFile(sheets).toBuffer();
};
