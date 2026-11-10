// Báo cáo doanh thu cho quản trị + xuất Excel bằng exceljs (thay Apache POI).

import ExcelJS from "exceljs";
import { prisma } from "../../lib/prisma.js";

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
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Khoảng ngày không hợp lệ");
  if (endOfDay) d.setHours(23, 59, 59, 999);
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
    const day = o.createdAt.toISOString().slice(0, 10);
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
  const sum = summary(range);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FoodOrdering";
  workbook.created = new Date();

  // Sheet 1 — Tổng quan
  const s0 = workbook.addWorksheet("Tong quan");
  s0.addRow(["Chỉ số", "Giá trị"]);
  const s = await sum;
  s0.addRow(["Doanh thu", s.revenue]);
  s0.addRow(["Số đơn", s.orderCount]);
  s0.addRow(["Đơn hoàn thành", s.completedCount]);
  s0.addRow(["Giá trị đơn TB", s.avgOrder]);
  s0.addRow(["Khách hàng", s.customerCount]);
  s0.addRow(["Tổng giảm khuyến mãi", s.promotionDiscount]);
  s0.columns.forEach((c) => { c.width = 28; });

  // Sheet 2 — Doanh thu theo ngày
  const s1 = workbook.addWorksheet("Doanh thu");
  s1.addRow(["Ngày", "Doanh thu", "Số đơn"]);
  for (const p of await revenueByDay(range)) s1.addRow([p.date, p.revenue, p.orders]);
  s1.columns.forEach((c) => { c.width = 18; });

  // Sheet 3 — Top món
  const s2 = workbook.addWorksheet("Top mon");
  s2.addRow(["Món", "Số lượng", "Doanh thu"]);
  for (const t of await topFoods(range, 20)) s2.addRow([t.name, t.quantity, t.revenue]);
  s2.columns.forEach((c) => { c.width = 30; });

  // Sheet 4 — Đơn hàng
  const s4 = workbook.addWorksheet("Don hang");
  s4.addRow(["Mã đơn", "Ngày", "Trạng thái", "Tổng tiền", "Giảm giá", "Khách"]);
  for (const o of orders) {
    s4.addRow([
      o.id,
      o.createdAt.toISOString(),
      o.status,
      Number(o.total),
      Number(o.discountTotal ?? 0),
      o.user?.email ?? "",
    ]);
  }
  s4.columns.forEach((c) => { c.width = 24; });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};
