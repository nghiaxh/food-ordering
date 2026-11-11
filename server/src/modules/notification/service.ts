import { and, desc, eq } from "drizzle-orm";
import { db } from "../../lib/db.js";
import { notifications, users } from "../../db/schema.js";
import { forbidden, notFound, unauthorized } from "../../lib/errors.js";
import { toNotificationJson } from "../../lib/serializers.js";

const getUserOrThrow = async (email: string) => {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw unauthorized("Phiên đăng nhập không hợp lệ");
  return user;
};

export const listNotifications = async (email: string) => {
  const user = await getUserOrThrow(email);
  const items = await db.query.notifications.findMany({
    where: eq(notifications.userId, user.id),
    orderBy: [desc(notifications.createdAt)],
  });
  return items.map(toNotificationJson);
};

export const markAllRead = async (email: string) => {
  const user = await getUserOrThrow(email);
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
};

export const deleteRead = async (email: string) => {
  const user = await getUserOrThrow(email);
  await db
    .delete(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, true)));
};

/** Chỉ chủ sở hữu mới đọc hoặc xoá được thông báo; 404 khi không tồn tại, 403 khi của người khác. */
const ownNotification = async (email: string, id: number) => {
  const user = await getUserOrThrow(email);
  const notification = await db.query.notifications.findFirst({ where: eq(notifications.id, id) });
  if (!notification) throw notFound("Không tìm thấy thông báo");
  if (notification.userId !== user.id) {
    throw forbidden("Bạn không có quyền thao tác trên thông báo này");
  }
  return notification;
};

export const markRead = async (email: string, id: number) => {
  const notif = await ownNotification(email, id);
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, notif.id));
};

export const deleteOne = async (email: string, id: number) => {
  const notif = await ownNotification(email, id);
  await db.delete(notifications).where(eq(notifications.id, notif.id));
};
