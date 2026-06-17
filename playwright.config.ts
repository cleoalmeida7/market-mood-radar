import { defineConfig, devices } from "@playwright/test";

const PORT = 3140;
const BASE_URL = `http://localhost:${PORT}`;

// E2E smoke tests. Builds the app and runs the production server, then drives
// it with Chromium. Set PW_NO_BUILD=1 to skip the build (reuse an existing
// `next start`). Data comes from .env.local (Next loads it automatically).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.PW_NO_BUILD
      ? `npm run start -- -p ${PORT}`
      : `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
