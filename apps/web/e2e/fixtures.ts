import { expect, test as base, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

export const ADMIN_URL = "http://localhost:3000";
export const SALES_URL = "http://localhost:8081";

export const ADMIN = { email: "admin@fieldops.local", password: "Admin123!", name: "Aarav Mehta" };
export const PRIYA = { email: "priya@fieldops.local", password: "Sales123!", name: "Priya Sharma" };
export const RAHUL = { email: "rahul@fieldops.local", password: "Sales123!", name: "Rahul Verma" };

/** A fixed GPS fix near the seeded Aurora Traders client (Bengaluru). */
export const BENGALURU = { latitude: 12.9757, longitude: 77.6069, accuracy: 12 };

interface Guard {
  errors: string[];
  realBackendRequests: string[];
  dialogs: string[];
  allowed: RegExp[];
}

/**
 * Fails the test on any uncaught page error or console error, and aborts (and fails on) any request
 * to a real Firebase/Google backend so the suite can never touch a live project.
 */
function attachGuard(page: Page, guard: Guard) {
  page.on("pageerror", (error) => guard.errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") guard.errors.push(`console.error: ${message.text()}`);
  });
  // Browser confirm()/alert() are used by the sales site on web; accept them and keep the text for assertions.
  page.on("dialog", (dialog) => {
    guard.dialogs.push(dialog.message());
    void dialog.accept();
  });
}

async function attachContextGuard(context: BrowserContext, guard: Guard) {
  // Matched on the host: emulator URLs carry "identitytoolkit.googleapis.com" in their path, which is fine.
  const realBackend = (url: URL) => /(^|\.)(googleapis\.com|firebaseio\.com|firebaseapp\.com|cloudfunctions\.net)$/.test(url.hostname);
  await context.route(realBackend, async (route) => {
    guard.realBackendRequests.push(route.request().url());
    await route.abort();
  });
  context.on("page", (page) => attachGuard(page, guard));
}

function check(guard: Guard) {
  expect(guard.realBackendRequests, "requests to a real Firebase backend").toEqual([]);
  const unexpected = guard.errors.filter((text) => !guard.allowed.some((pattern) => pattern.test(text)));
  expect(unexpected, "uncaught page errors / console errors").toEqual([]);
}

interface Fixtures {
  guard: Guard;
  /** Allow console errors matching these patterns (for deliberately triggered failures). */
  allowErrors: (...patterns: RegExp[]) => void;
  /** Open a second, fully guarded browser context (e.g. the other role on the other site). */
  newGuardedPage: (options?: Parameters<Browser["newContext"]>[0]) => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  guard: async ({}, provide) => {
    await provide({ errors: [], realBackendRequests: [], dialogs: [], allowed: [] });
  },
  context: async ({ context, guard }, provide) => {
    await attachContextGuard(context, guard);
    await provide(context);
  },
  page: async ({ page, guard }, provide) => {
    // The default page is created from the guarded context above, so its listeners are already attached.
    await provide(page);
    check(guard);
  },
  allowErrors: async ({ guard }, provide) => {
    await provide((...patterns) => guard.allowed.push(...patterns));
  },
  newGuardedPage: async ({ browser, guard }, provide) => {
    const contexts: BrowserContext[] = [];
    await provide(async (options) => {
      const context = await browser.newContext(options);
      contexts.push(context);
      await attachContextGuard(context, guard);
      return context.newPage();
    });
    for (const context of contexts) await context.close();
    check(guard);
  },
});

export { expect };

// ---------- Admin site helpers ----------

export async function adminSignIn(page: Page, account: { email: string; password: string } = ADMIN) {
  await page.goto(`${ADMIN_URL}/login`);
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening), / })).toBeVisible();
}

export async function adminSignOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/**
 * The control inside an admin-site <Field> by its exact label text. getByLabel() is too loose there:
 * a wrapping <label> also contains the <option> texts (e.g. "Choose a salesperson first…").
 */
export function field(scope: Locator, label: string) {
  return scope
    .locator("label")
    .filter({ has: scope.page().locator("span", { hasText: new RegExp(`^${label.replace(/[()]/g, "\\$&")}$`) }) })
    .locator("input, select, textarea");
}

export function modal(page: Page, title: string | RegExp) {
  return page.getByRole("dialog", { name: title });
}

// ---------- Sales site helpers ----------

export async function salesSignIn(page: Page, account: { email: string; password: string; name?: string }) {
  await page.goto(`${SALES_URL}/login`);
  await page.getByPlaceholder("you@company.com").fill(account.email);
  await page.getByPlaceholder("Enter your password").fill(account.password);
  await page.getByText("Sign in", { exact: true }).click();
  await expect(page.getByText(/^Hello, /)).toBeVisible();
}

/**
 * Text on the sales site's active screen. React Native Web keeps visited tab/stack screens mounted
 * underneath (marked `inert`), so lookups must skip anything inside an inert subtree.
 */
export function shown(page: Page, text: string | RegExp) {
  return page
    .getByText(text, typeof text === "string" ? { exact: true } : undefined)
    .and(page.locator(":not([inert] *)"));
}

/** A card-like container on the active sales screen holding all the given texts (the innermost match). */
export function cardWith(page: Page, ...texts: (string | RegExp)[]) {
  let locator = page.locator("div:not([inert] *)");
  for (const text of texts) {
    locator = locator.filter({ has: page.getByText(text, typeof text === "string" ? { exact: true } : undefined) });
  }
  return locator.last();
}

/** Bottom tab of the sales site. */
export function salesTab(page: Page, name: "Today" | "Clients" | "Visits" | "Follow-ups" | "Profile") {
  // Tab labels are prefixed with icon glyphs, so match the label at the end.
  return page.getByRole("tab", { name: new RegExp(`${name}$`) });
}

/** Generates a small real JPEG (via canvas in the page) for photo uploads. */
export async function makeJpeg(page: Page, color: string, label: string): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const base64 = await page.evaluate(
    ([fill, text]) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, 320, 240);
      ctx.fillStyle = "#fff";
      ctx.font = "32px sans-serif";
      ctx.fillText(text, 20, 130);
      return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
    },
    [color, label] as const,
  );
  return { name: `${label}.jpg`, mimeType: "image/jpeg", buffer: Buffer.from(base64, "base64") };
}

export function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

/** Asserts the page shows no "Could not …" failure message. */
export async function expectNoLoadError(page: Page) {
  await expect(page.getByText(/^(Could not|Missing or insufficient permissions)/)).toHaveCount(0);
}

/** A datetime-local value (YYYY-MM-DDTHH:MM) `days` from today at `hour`:00 local time. */
export function localDateTime(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;
}

/** Creates an active client through the admin UI and assigns it to the given salesperson. */
export async function adminCreateAssignedClient(page: Page, name: string, salesperson: string, city = "Bengaluru") {
  await page.goto(`${ADMIN_URL}/clients`);
  await page.getByRole("button", { name: "Add client" }).click();
  const form = modal(page, "Add client");
  await field(form, "Client / business name").fill(name);
  await field(form, "Contact person").fill("Test Contact");
  await field(form, "Phone").fill("+919830000002");
  await field(form, "Address line 1").fill("10 Test Road");
  await field(form, "City").fill(city);
  await field(form, "State").fill("Karnataka");
  await field(form, "Postal code").fill("560001");
  await form.getByRole("button", { name: "Create client" }).click();
  await expect(form).toHaveCount(0);
  await page.getByPlaceholder("Search by client, contact, city or phone").fill(name);
  await page.getByRole("button", { name: new RegExp(name) }).click();
  const detail = modal(page, name);
  await detail.getByRole("combobox").selectOption({ label: salesperson });
  await detail.getByRole("button", { name: "Assign" }).click();
  await expect(detail.getByRole("listitem").filter({ hasText: salesperson })).toBeVisible();
  await detail.getByRole("button", { name: "Close" }).click();
}
