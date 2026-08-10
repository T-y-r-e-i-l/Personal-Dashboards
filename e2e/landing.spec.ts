import { test, expect } from "@playwright/test";

test("landing page shows brand and CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Your day, one calm surface",
  );
  await expect(page.getByRole("link", { name: "Start free" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
});

test("auth pages render", async ({ page }) => {
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});

test("weather API returns demo payload without key", async ({ request }) => {
  const res = await request.get("/api/weather?q=Spokane");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.location).toContain("Spokane");
  expect(typeof body.temp).toBe("number");
});
