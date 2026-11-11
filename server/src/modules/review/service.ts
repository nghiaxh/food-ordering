import { and, desc, eq } from "drizzle-orm";
import { db } from "../../lib/db.js";
import { foods, orderItems, orders, reviews, users, type Review } from "../../db/schema.js";
import { forbidden, notFound } from "../../lib/errors.js";
import type { createReviewSchema, updateReviewSchema } from "./schema.js";
import type { z } from "zod";

type CreateReviewRequest = z.infer<typeof createReviewSchema>;
type UpdateReviewRequest = z.infer<typeof updateReviewSchema>;

/** Nhận xét không bắt buộc: chuỗi rỗng hoặc chỉ khoảng trắng được lưu thành null. */
const normalizeComment = (comment?: string | null): string | null => {
  const trimmed = comment?.trim();
  return trimmed ? trimmed : null;
};

const toReviewJson = (
  r: Review & { user?: { fullName: string | null } | null },
  currentUserId?: number,
) => ({
  id: r.id,
  userName: r.user?.fullName ?? null,
  rating: r.rating,
  comment: r.comment,
  createdAt: r.createdAt.toISOString(),
  // mine chỉ là gợi ý hiển thị nút Sửa/Xóa; quyền thật vẫn được kiểm ở server mỗi request.
  mine: currentUserId !== undefined && r.userId === currentUserId,
});

export async function listByFood(foodId: number, currentUserId?: number) {
  const list = await db.query.reviews.findMany({
    where: eq(reviews.foodId, foodId),
    with: { user: { columns: { fullName: true } } },
    orderBy: [desc(reviews.createdAt)],
  });
  return list.map((r) => toReviewJson(r, currentUserId));
}

export async function create(userId: number, req: CreateReviewRequest) {
  // Chỉ món trong đơn hoàn thành của chính mình mới được đánh giá ("đánh giá sau khi dùng").
  const [ordered] = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.status, "COMPLETED"),
        eq(orderItems.foodId, req.foodId),
      ),
    )
    .limit(1);

  if (!ordered) {
    throw forbidden("Bạn chỉ có thể đánh giá món đã dùng trong đơn hàng hoàn thành");
  }

  const food = await db.query.foods.findFirst({
    where: eq(foods.id, req.foodId),
    columns: { id: true },
  });
  if (!food) throw notFound("Không tìm thấy món ăn");

  const [review] = await db
    .insert(reviews)
    .values({
      userId,
      foodId: req.foodId,
      rating: req.rating,
      comment: normalizeComment(req.comment),
    })
    .returning();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { fullName: true },
  });

  return toReviewJson({ ...review!, user: { fullName: user?.fullName ?? null } }, userId);
}

export async function update(userId: number, id: number, req: UpdateReviewRequest) {
  const review = await ownReview(userId, id);
  const [saved] = await db
    .update(reviews)
    .set({ rating: req.rating, comment: normalizeComment(req.comment) })
    .where(eq(reviews.id, review.id))
    .returning();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { fullName: true },
  });

  return toReviewJson({ ...saved!, user: { fullName: user?.fullName ?? null } }, userId);
}

export async function remove(userId: number, id: number) {
  const review = await ownReview(userId, id);
  await db.delete(reviews).where(eq(reviews.id, review.id));
}

/** Sửa/xóa chỉ áp dụng cho đánh giá của chính người đang đăng nhập. */
async function ownReview(userId: number, id: number) {
  const review = await db.query.reviews.findFirst({ where: eq(reviews.id, id) });
  if (!review) throw notFound("Không tìm thấy đánh giá");
  if (review.userId !== userId) {
    throw forbidden("Bạn chỉ có thể sửa hoặc xóa đánh giá của mình");
  }
  return review;
}
