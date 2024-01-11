// @ts-check
const { test, expect } = require('@playwright/test');

const baseurl = 'https://ssw.com.au/rules';

test('should have history.json', async ({ request }) => {
  const response = await request.get(`${baseurl}/history.json`);
  expect(response.status()).toBe(200);
});

test('should have megadata', async ({ page }) => {
  await page.goto('https://ssw.com.au/rules/latest-rules/?size=50');

  let randomNum = Math.floor(Math.random() * 50);

  const ruleLink = await page
    .locator('.cat-grid-container')
    .getByRole('link')
    .nth(randomNum);

  await ruleLink.click();

  const locator = page.locator('.history');
  await expect(locator).toContainText('See history');
});
