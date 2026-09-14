import { defineConfig, devices } from '@playwright/test';

// Playwright owns tests/e2e only (`*.e2e.js`); vitest matches `.test.`/`.spec.`
// so the two runners never pick up each other's files.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.js',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // The reception copy button writes to the system clipboard; Chromium gates
    // reading it behind these permissions.
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node tests/e2e/serve-site.mjs',
    url: 'http://127.0.0.1:4173/',
    timeout: 120000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
