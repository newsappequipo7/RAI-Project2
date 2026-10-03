import { defineConfig } from '@playwright/test';

const PORTAL_PORT = 5199;

// Runs against the Firebase emulators (Auth + Firestore), started by `firebase emulators:exec`.
// The Worker is never called for real: the test intercepts its URL, and AI stays in mock mode.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORTAL_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `pnpm -F admin exec vite dev --host 127.0.0.1 --port ${PORTAL_PORT} --strictPort`,
    cwd: '..',
    url: `http://127.0.0.1:${PORTAL_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_FIRESTORE_EMULATOR: 'true',
      VITE_AUTH_EMULATOR: 'true',
      VITE_API_URL: 'http://127.0.0.1:8787',
    },
  },
});
