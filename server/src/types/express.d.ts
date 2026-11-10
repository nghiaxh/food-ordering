// Gắn danh tính đã xác thực vào request; requireAuth/optionalAuth là nơi duy nhất set.
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string; role: "CUSTOMER" | "ADMIN" };
    }
  }
}

export {};
