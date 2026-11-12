import { eq, sql } from "drizzle-orm";
import type { Food, Promotion } from "../../db/schema.js";
import { foods, promotions } from "../../db/schema.js";
import { db } from "../../lib/db.js";
import { badRequest } from "../../lib/errors.js";
import {
  bestFor,
  computeRandomPicks,
  discountAmount,
  isValid,
  minOrderReached,
  toQuoteLine,
  type DiscountRule,
  type FoodLike,
  type PricingInputItem,
} from "./engine.js";

// Lop truy van + dieu phoi: goi engine de tinh, doc khuyen mai tu DB,
// va cung cap cac ham dung chung cho cart/order (priceOrder, quote, decorate).
export type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClient = typeof db | DrizzleTransaction;

export interface PricedLine {
  food: FoodLike & { name: string; imageUrl: string | null; category?: { id: number } | null };
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  discountLabel: string | null;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  appliedPromotions: Promotion[];
}

/** Doc khuyen mai active tu DB roi loc bang isValid; pure logic nam o engine. */
export async function activePromotions(now: Date, client: DbClient = db): Promise<Promotion[]> {
  const all = await client.query.promotions.findMany({ where: eq(promotions.active, true) });
  return all.filter((p) => isValid(p, now));
}

/** Dung rule set dung chung cho moi lan tinh trong mot request. */
async function buildRules(now: Date, client: DbClient, subtotal = 0): Promise<DiscountRule> {
  // Khuyen mai co han muc toi thieu chi ap khi tong don dat han; subtotal = 0 (hien thi
  // trong thuc don) thi loai het nhom khuyen mai do.
  const auto = (await activePromotions(now, client)).filter((p) => minOrderReached(p, subtotal));
  const needsPicks = auto.some((p) => p.randomCount > 0);
  if (!needsPicks) {
    return { now, auto, randomPicks: new Map(), availableFoodIds: [] };
  }
  const available = await client.query.foods.findMany({
    where: eq(foods.available, true),
    columns: { id: true },
  });
  const availableFoodIds = available.map((f) => f.id);
  return { now, auto, randomPicks: computeRandomPicks(auto, availableFoodIds, now), availableFoodIds };
}

export async function priceOrder(
  items: PricingInputItem[],
  client: DbClient = db,
  now: Date = new Date(),
): Promise<PricedCart> {
  // Vong 1 lay gia mon va tinh tong don; vong 2 moi chon khuyen mai theo tong don
  // vi khuyen mai co han muc toi thieu chi ap khi tong don dat han.
  const prepared: Array<{ input: PricingInputItem; food: PricedLine["food"]; unitPrice: number }> = [];
  let subtotal = 0;
  for (const input of items) {
    if (input.quantity <= 0) throw badRequest("Số lượng món phải lớn hơn 0");
    if (input.foodId == null) throw badRequest("Dòng hàng phải có món");
    const food = await client.query.foods.findFirst({
      where: eq(foods.id, input.foodId),
      with: { category: true },
    });
    if (!food) throw badRequest("Món không tồn tại");
    const unitPrice = Number(food.price);
    prepared.push({ input, food, unitPrice });
    subtotal += unitPrice * input.quantity;
  }

  const rules = await buildRules(now, client, subtotal);
  const lines: PricedLine[] = [];
  const applied = new Map<number, Promotion>();

  for (const { input, food, unitPrice } of prepared) {
    const auto = bestFor(unitPrice, food, rules);
    let lineDiscount = 0;
    let label: string | null = null;
    if (auto) {
      lineDiscount = discountAmount(unitPrice, auto) * input.quantity;
      label = auto.name;
      applied.set(auto.id, auto);
    }

    lines.push({
      food,
      quantity: input.quantity,
      unitPrice,
      lineDiscount,
      discountLabel: label,
    });
  }

  const total = lines.reduce((sum, l) => sum + (l.unitPrice * l.quantity - l.lineDiscount), 0);
  return {
    lines,
    subtotal,
    discountTotal: subtotal - total,
    total,
    appliedPromotions: [...applied.values()],
  };
}

export const toQuote = (priced: PricedCart) => ({
  lines: priced.lines.map((l) =>
    toQuoteLine({
      foodId: l.food.id,
      name: l.food.name,
      imageUrl: l.food.imageUrl,
      unitPrice: l.unitPrice,
      lineDiscount: l.lineDiscount,
      quantity: l.quantity,
      discountLabel: l.discountLabel,
    }),
  ),
  subtotal: priced.subtotal,
  discountTotal: priced.discountTotal,
  total: priced.total,
});

export type DecoratedFood<TFood extends FoodLike & { name: string; imageUrl: string | null }> = TFood & {
  discountedPrice: number;
  discountAmount: number;
  discountPercent: number | null;
  discountLabel: string | null;
};

/** Dien gia sau khuyen mai cho ca danh sach; tinh rules mot lan cho ca danh sach. */
export async function decorateFoods<TFood extends FoodLike & { name: string; imageUrl: string | null; price: number | string }>(
  foodList: TFood[],
  client: DbClient = db,
): Promise<Array<DecoratedFood<TFood>>> {
  if (foodList.length === 0) return [];
  const rules = await buildRules(new Date(), client);
  return foodList.map((food) => {
    const unitPrice = Number(food.price);
    const best = bestFor(unitPrice, food, rules);
    const amount = best ? discountAmount(unitPrice, best) : 0;
    return {
      ...food,
      discountedPrice: unitPrice - amount,
      discountAmount: amount,
      discountPercent: best?.discountType === "PERCENT" ? Number(best.discountValue) : null,
      discountLabel: best?.name ?? null,
    };
  });
}

/** Ghi nhan luot dung cua cac KM da ap; goi trong cung transaction voi tao don. */
export async function markUsed(applied: Promotion[], tx: DbClient) {
  for (const p of applied) {
    await tx
      .update(promotions)
      .set({ usedCount: sql`${promotions.usedCount} + 1` })
      .where(eq(promotions.id, p.id));
  }
}

/** Giam luot dung khi don bi sua mon: KM cu khong con duoc ap nen so da dem phai duoc trai lai. */
export async function unmarkUsed(applied: Promotion[], tx: DbClient) {
  for (const p of applied) {
    await tx
      .update(promotions)
      .set({ usedCount: sql`greatest(${promotions.usedCount} - 1, 0)` })
      .where(eq(promotions.id, p.id));
  }
}
