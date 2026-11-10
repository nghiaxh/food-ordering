import { defineConfig } from "vitest/config";

// JWT_SECRET giả chỉ để các module import (env validation) không dừng tiến trình test.
export default defineConfig({
  test: {
    environment: "node",
    env: {
      JWT_SECRET: "vitest-fake-secret-not-a-real-secret-0123456789",
    },
  },
});
