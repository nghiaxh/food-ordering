import type { Picked } from "./plan.js";
import type { Constraints } from "./constraints.js";

const vnd = (amount: number): string =>
  `${Math.round(amount).toLocaleString("vi-VN").replace(/,/g, ".")}đ`;

function describeConstraints(c: Constraints): string {
  const parts: string[] = [];
  if (c.chay) parts.push("chay");
  if (c.spicyMax === 0) parts.push("không cay");
  if (c.exclude.length > 0) parts.push(`không ${c.exclude.join(", ")}`);
  if (c.budgetTotal != null) parts.push(`trong ngân sách ${vnd(c.budgetTotal)}`);
  return parts.join(", ");
}

export function renderReply(plan: { picks: Picked[]; totalPrice: number }, constraints: Constraints): string {
  const dishes = plan.picks;
  if (dishes.length === 0) {
    if (constraints.budgetTotal != null) {
      return `Mình chưa tìm được món nào ${describeConstraints(constraints)}. Bạn thử nới ngân sách hoặc bỏ bớt điều kiện nhé!`;
    }
    return "Mình chỉ tư vấn được về món ăn của quán. Bạn xem thực đơn bên dưới nhé!";
  }

  const described = describeConstraints(constraints);
  let reply = `Mình tìm được ${dishes.length} món`;
  if (described) reply += ` ${described}`;

  if (constraints.budgetTotal != null) {
    reply += `, tổng ${vnd(plan.totalPrice)}.`;
  } else {
    const minPrice = Math.min(...dishes.map((p) => Number(p.food.price)));
    reply += `, giá từ ${vnd(minPrice)}.`;
  }
  reply += "\n\nBấm vào thẻ món bên dưới để xem chi tiết và đặt món nhé!";
  return reply;
}

export function renderFallback(
  dishes: Picked[],
  constraints: Constraints,
): string {
  return renderReply({ picks: dishes, totalPrice: dishes.reduce((s, p) => s + p.totalPrice, 0) }, constraints);
}