import type { Review, User } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
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

const toReviewJson = (r: Review & { user: Pick<User, "fullName"> }, currentUserId?: number) => ({
  id: r.id,
  userName: r.user.fullName,
  rating: r.rating,
  comment: r.comment,
  createdAt: r.createdAt.toISOString(),
  // mine chỉ là gợi ý hiển thị nút Sửa/Xóa; quyền thật vẫn được kiểm ở server mỗi request.
  mine: currentUserId !== undefined && r.userId === currentUserId,
});

export async function listByFood(foodId: number, currentUserId?: number) {
  const reviews = await prisma.review.findMany({
    where: { foodId },
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return reviews.map((r) => toReviewJson(r, currentUserId));
}

export async function create(userId: number, req: CreateReviewRequest) {
  // Chỉ món trong đơn hoàn thành của chính mình mới được đánh giá ("đánh giá sau khi dùng").
  const ordered = await prisma.order.findFirst({
    where: { userId, status: "COMPLETED", items: { some: { foodId: req.foodId } } },
    select: { id: true },
  });
  if (!ordered) {
    throw forbidden("Bạn chỉ có thể đánh giá món đã dùng trong đơn hàng hoàn thành");
  }
  const food = await prisma.food.findUnique({ where: { id: req.foodId }, select: { id: true } });
  if (!food) throw notFound("Không tìm thấy món ăn");
  const review = await prisma.review.create({
    data: {
      userId,
      foodId: req.foodId,
      rating: req.rating,
      comment: normalizeComment(req.comment),
    },
    include: { user: { select: { fullName: true } } },
  });
  return toReviewJson(review, userId);
}

export async function update(userId: number, id: number, req: UpdateReviewRequest) {
  const review = await ownReview(userId, id);
  const saved = await prisma.review.update({
    where: { id: review.id },
    data: { rating: req.rating, comment: normalizeComment(req.comment) },
    include: { user: { select: { fullName: true } } },
  });
  return toReviewJson(saved, userId);
}

export async function remove(userId: number, id: number) {
  await prisma.review.delete({ where: { id: (await ownReview(userId, id)).id } });
}

/** Sửa/xóa chỉ áp dụng cho đánh giá của chính người đang đăng nhập. */
async function ownReview(userId: number, id: number) {
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw notFound("Không tìm thấy đánh giá");
  if (review.userId !== userId) {
    throw forbidden("Bạn chỉ có thể sửa hoặc xóa đánh giá của mình");
  }
  return review;
}
