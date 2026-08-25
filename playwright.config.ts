import { defineConfig } from '@playwright/test';

const FIXTURE_PORT = Number(process.env.FIXTURE_PORT ?? 7610);
const DEV_PORT = Number(process.env.DEV_PORT ?? 5173);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // The fixture daemon holds shared in-memory state.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: { baseURL: `http://127.0.0.1:${DEV_PORT}`, trace: 'on-first-retry' },
  projects: [
    {
      name: 'local',
      testDir: './e2e/local',
      use: { baseURL: `http://127.0.0.1:${DEV_PORT}` },
    },
  ],
  webServer: [
    {
      command: `node e2e/local/fixtures/daemon-fixture.mjs`,
      url: `http://127.0.0.1:${FIXTURE_PORT}/healthz`,
      reuseExistingServer: !process.env.CI,
      env: { FIXTURE_PORT: String(FIXTURE_PORT), DEV_PORT: String(DEV_PORT) },
    },
    {
      command: `pnpm dev:local --host 127.0.0.1 --port ${DEV_PORT}`,
      url: `http://127.0.0.1:${DEV_PORT}/`,
      reuseExistingServer: !process.env.CI,
      env: { FIXTURE_PORT: String(FIXTURE_PORT) },
      timeout: 120_000,
    },
  ],
});
