import { prisma } from "../../lib/prisma.js";
import { forbidden, notFound } from "../../lib/errors.js";
import { toNotificationJson } from "../../lib/serializers.js";

export const listNotifications = async (email: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return items.map(toNotificationJson);
};

export const markAllRead = async (email: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
};

export const deleteRead = async (email: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.notification.deleteMany({ where: { userId: user.id, read: true } });
};

/** Chỉ chủ sở hữu mới đọc hoặc xoá được thông báo; 404 khi không tồn tại, 403 khi của người khác. */
const ownNotification = async (email: string, id: number) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw notFound("Không tìm thấy thông báo");
  if (notification.userId !== user.id) {
    throw forbidden("Bạn không có quyền thao tác trên thông báo này");
  }
  return notification;
};

export const markRead = async (email: string, id: number) => {
  await prisma.notification.update({
    where: { id: (await ownNotification(email, id)).id },
    data: { read: true },
  });
};

export const deleteOne = async (email: string, id: number) => {
  await prisma.notification.delete({ where: { id: (await ownNotification(email, id)).id } });
};
