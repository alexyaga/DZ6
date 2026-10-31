import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:8001",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1100 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: '".venv\\Scripts\\python.exe" -m backend.e2e_server',
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    url: "http://127.0.0.1:8001/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
