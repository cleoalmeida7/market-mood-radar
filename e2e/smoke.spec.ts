import { test, expect, type Page } from "@playwright/test";

/** Collect uncaught page exceptions so a route that throws fails the smoke test. */
function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.describe("pages render without crashing", () => {
  test("dashboard /", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Commodity Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Radar", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("radar /radar", async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto("/radar");
    await expect(page.getByRole("heading", { name: "Market Radar" })).toBeVisible();
    // Static card title (renders independent of live data).
    await expect(page.getByText("Market mood over time")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("about /about", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "How the radar works" })).toBeVisible();
    await expect(page.getByText("Backtested weight tuning")).toBeVisible();
  });

  test("backtest index /backtest", async ({ page }) => {
    await page.goto("/backtest");
    await expect(page.getByRole("heading", { name: "Backtests" })).toBeVisible();
    await expect(page.getByRole("link", { name: /XAU/ })).toBeVisible();
  });

  test("commodity detail /commodity/XAU", async ({ page }) => {
    await page.goto("/commodity/XAU");
    await expect(page.getByText("XAU").first()).toBeVisible();
    await expect(page.getByText("Gold").first()).toBeVisible();
  });

  test("alerts /alerts", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
  });
});

test("theme toggle switches between dark and light", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const toggle = page.getByTestId("theme-toggle");
  await expect(html).toHaveClass(/dark/); // defaultTheme

  await toggle.click();
  await expect(html).toHaveClass(/light/);

  await toggle.click();
  await expect(html).toHaveClass(/dark/);
});
