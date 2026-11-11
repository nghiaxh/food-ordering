import { defineConfig } from "vitest/config";

// JWT_SECRET gia chi de cac module import (env validation) khong dung tien trinh test.
export default defineConfig({
  test: {
    environment: "node",
    env: {
      JWT_SECRET: "vitest-fake-secret-not-a-real-secret-0123456789",
    },
  },
});
