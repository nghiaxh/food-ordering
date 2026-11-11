import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "../../lib/db.js";
import { userAddresses, users, type UserAddress } from "../../db/schema.js";
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
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw unauthorized("Phiên đăng nhập không hợp lệ");
  return user;
};

export const listAddresses = async (email: string) => {
  const user = await currentUser(email);
  const rows = await db.query.userAddresses.findMany({
    where: eq(userAddresses.userId, user.id),
    orderBy: [desc(userAddresses.isDefault), asc(userAddresses.createdAt)],
  });
  return rows.map(toAddressJson);
};

const clearDefaults = async (userId: number) => {
  await db
    .update(userAddresses)
    .set({ isDefault: false })
    .where(and(eq(userAddresses.userId, userId), eq(userAddresses.isDefault, true)));
};

export const createAddress = async (email: string, req: AddressRequest) => {
  const user = await currentUser(email);
  const totalRows = await db
    .select({ value: count() })
    .from(userAddresses)
    .where(eq(userAddresses.userId, user.id));
  const first = (totalRows[0]?.value ?? 0) === 0;

  // Dia chi dau tien hoac dia chi duoc danh dau luon tro thanh mac dinh, cac dia chi cu bo mac dinh.
  if (req.isDefault || first) await clearDefaults(user.id);

  const [created] = await db
    .insert(userAddresses)
    .values({
      userId: user.id,
      addressLabel: req.label?.trim() ?? "",
      receiverName: req.receiverName.trim(),
      phone: req.phone,
      address: req.address.trim(),
      isDefault: req.isDefault || first,
    })
    .returning();

  return toAddressJson(created!);
};

const owned = async (email: string, id: number) => {
  const user = await currentUser(email);
  const address = await db.query.userAddresses.findFirst({ where: eq(userAddresses.id, id) });
  // Dia chi cua nguoi khac cung gia vo khong ton tai de khong lo ID dang co hieu luc.
  if (!address || address.userId !== user.id) {
    throw notFound("Địa chỉ không tồn tại");
  }
  return address;
};

export const updateAddress = async (email: string, id: number, req: AddressRequest) => {
  const address = await owned(email, id);
  if (req.isDefault) await clearDefaults(address.userId);
  const [updated] = await db
    .update(userAddresses)
    .set({
      addressLabel: req.label?.trim() ?? "",
      receiverName: req.receiverName.trim(),
      phone: req.phone,
      address: req.address.trim(),
      ...(req.isDefault ? { isDefault: true } : {}),
    })
    .where(eq(userAddresses.id, address.id))
    .returning();

  return toAddressJson(updated!);
};

export const setDefaultAddress = async (email: string, id: number) => {
  const address = await owned(email, id);
  await clearDefaults(address.userId);
  const [updated] = await db
    .update(userAddresses)
    .set({ isDefault: true })
    .where(eq(userAddresses.id, address.id))
    .returning();

  return toAddressJson(updated!);
};

export const deleteAddress = async (email: string, id: number) => {
  const address = await owned(email, id);
  await db.delete(userAddresses).where(eq(userAddresses.id, address.id));
  // Neu xoa dia chi mac dinh, nang dia chi dau tien con lai len lam mac dinh.
  if (address.isDefault) {
    const next = await db.query.userAddresses.findFirst({
      where: eq(userAddresses.userId, address.userId),
      orderBy: [asc(userAddresses.createdAt)],
    });
    if (next) {
      await clearDefaults(address.userId);
      await db
        .update(userAddresses)
        .set({ isDefault: true })
        .where(eq(userAddresses.id, next.id));
    }
  }
};
