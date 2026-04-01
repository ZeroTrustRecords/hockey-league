const { test, expect } = require('@playwright/test');

test('admin smoke flow reaches setup state after login', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /connexion administrateur/i }).click();
  await page.getByPlaceholder('admin').fill('admin');
  await page.locator('input[type="password"]').fill('password123');
  await page.getByRole('button', { name: /se connecter/i }).click();

  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
  await expect(page.getByText(/configuration initiale requise/i)).toBeVisible();
  await expect(page.getByText(/importer le roster/i).first()).toBeVisible();
});
