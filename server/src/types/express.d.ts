// Gan danh tinh da xac thuc vao request; requireAuth/optionalAuth la noi duy nhat set.
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string; role: "CUSTOMER" | "ADMIN" };
    }
  }
}

export {};
