import { test, expect } from "@playwright/test";

test("app loads home page", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
});

