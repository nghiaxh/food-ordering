import type { UserAddress } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { notFound, unauthorized } from "../../lib/errors.js";
import type { addressRequestSchema } from "./schema.js";
import type { z } from "zod";

type AddressRequest = z.infer<typeof addressRequestSchema>;

export const toAddressJson = (a: UserAddress) => ({
  id: a.id,
  label: a.addressLabel ?? "",
  receiverName: a.receiverName,
  phone: a.phone,
  address: a.address,
  isDefault: a.isDefault,
  createdAt: a.createdAt.toISOString(),
});

const currentUser = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw unauthorized("Phiên đăng nhập không hợp lệ");
  return user;
};

export const listAddresses = async (email: string) => {
  const user = await currentUser(email);
  const rows = await prisma.userAddress.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return rows.map(toAddressJson);
};

const clearDefaults = async (userId: number) => {
  await prisma.userAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
};

export const createAddress = async (email: string, req: AddressRequest) => {
  const user = await currentUser(email);
  const first = (await prisma.userAddress.count({ where: { userId: user.id } })) === 0;
  // Địa chỉ đầu tiên hoặc địa chỉ được đánh dấu luôn trở thành mặc định, các địa chỉ cũ bỏ mặc định.
  if (req.isDefault || first) await clearDefaults(user.id);
  const created = await prisma.userAddress.create({
    data: {
      userId: user.id,
      addressLabel: req.label?.trim() ?? "",
      receiverName: req.receiverName.trim(),
      phone: req.phone,
      address: req.address.trim(),
      isDefault: req.isDefault || first,
    },
  });
  return toAddressJson(created);
};

const owned = async (email: string, id: number) => {
  const user = await currentUser(email);
  const address = await prisma.userAddress.findUnique({ where: { id } });
  // Địa chỉ của người khác cũng giả vờ không tồn tại để không lộ ID đang có hiệu lực.
  if (!address || address.userId !== user.id) {
    throw notFound("Địa chỉ không tồn tại");
  }
  return address;
};

export const updateAddress = async (email: string, id: number, req: AddressRequest) => {
  const address = await owned(email, id);
  if (req.isDefault) await clearDefaults(address.userId);
  const updated = await prisma.userAddress.update({
    where: { id: address.id },
    data: {
      addressLabel: req.label?.trim() ?? "",
      receiverName: req.receiverName.trim(),
      phone: req.phone,
      address: req.address.trim(),
      ...(req.isDefault ? { isDefault: true } : {}),
    },
  });
  return toAddressJson(updated);
};

export const setDefaultAddress = async (email: string, id: number) => {
  const address = await owned(email, id);
  await clearDefaults(address.userId);
  const updated = await prisma.userAddress.update({ where: { id: address.id }, data: { isDefault: true } });
  return toAddressJson(updated);
};

export const deleteAddress = async (email: string, id: number) => {
  const address = await owned(email, id);
  await prisma.userAddress.delete({ where: { id: address.id } });
  // Nếu xóa địa chỉ mặc định, nâng địa chỉ đầu tiên còn lại lên làm mặc định.
  if (address.isDefault) {
    const next = await prisma.userAddress.findFirst({
      where: { userId: address.userId },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await clearDefaults(address.userId);
      await prisma.userAddress.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
};
