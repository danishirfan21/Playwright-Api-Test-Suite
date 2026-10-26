import { defineConfig } from '@playwright/test';
import { env } from './utils/env';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: env.isCI,
  retries: env.isCI ? 2 : 0,
  workers: env.isCI ? 4 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: env.baseUrl,
    extraHTTPHeaders: { Accept: 'application/json' },
  },
  // No browser projects: every test uses the `request` APIRequestContext only.
  projects: [{ name: 'api' }],
});
