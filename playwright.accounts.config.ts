import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/accounts",
  outputDir: "account-test-results/artifacts",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5175",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npm run dev -- --port 5175 --strictPort",
    env: {
      VITE_SUPABASE_URL: "https://may-test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "public-test-browser-key-for-contract-tests",
    },
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
  },
  reporter: [["list"], ["json", { outputFile: "account-test-results/accounts.json" }]],
});
