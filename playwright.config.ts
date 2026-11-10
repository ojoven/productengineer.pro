import { defineConfig, devices } from '@playwright/test';

// One visual snapshot of the map, against the production build (run `npm run build` first).
export default defineConfig({
  testDir: 'tests/visual',
  snapshotPathTemplate: '{testDir}/__snapshots__/{arg}{ext}',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4321', colorScheme: 'light' },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  webServer: {
    command: 'npx astro preview --port 4321 --host 127.0.0.1',
    url: 'http://127.0.0.1:4321/',
    reuseExistingServer: true,
  },
});
