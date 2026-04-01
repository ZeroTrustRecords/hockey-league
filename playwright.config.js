const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    channel: 'msedge',
  },
  webServer: {
    command: 'npm start',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    cwd: __dirname,
    timeout: 120_000,
  },
});
