import {
  ADMIN,
  ADMIN_URL,
  PRIYA,
  adminSignIn,
  adminSignOut,
  expect,
  expectNoLoadError,
  field,
  localDateTime,
  modal,
  test,
  uniqueSuffix,
} from "./fixtures";

/** Sidebar link name; the Notifications link also carries the unread badge count ("Notifications 2", "9+"). */
const navName = (label: string) => new RegExp(`^${label}( \\d+\\+?)?$`);

test.describe("admin site: access", () => {
  test("protected routes redirect to login when signed out", async ({ page }) => {
    for (const path of ["/", "/dashboard", "/clients", "/salespeople", "/visits", "/followups", "/settings", "/audit"]) {
      await page.goto(`${ADMIN_URL}${path}`);
      await expect(page, `${path} should redirect`).toHaveURL(/\/login$/);
    }
  });

  test("wrong password is rejected with a clear message", async ({ page, allowErrors }) => {
    // The Auth emulator answers the bad sign-in with HTTP 400, which the browser logs.
    allowErrors(/Failed to load resource: the server responded with a status of 400/);
    await page.goto(`${ADMIN_URL}/login`);
    await page.locator("#email").fill(ADMIN.email);
    await page.locator("#password").fill("WrongPass1!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("admin signs in and out; the session really ends", async ({ page }) => {
    await adminSignIn(page);
    await adminSignOut(page);
    await page.goto(`${ADMIN_URL}/clients`);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("every admin page loads without errors", async ({ page }) => {
    await adminSignIn(page);
    const pages: [string, RegExp][] = [
      ["Clients", /^Clients$/],
      ["Salespeople", /^Salespeople$/],
      ["Visits", /^Visits$/],
      ["Follow-ups", /^Follow-ups$/],
      ["Calendar", /^Calendar$/],
      ["Reports", /^Reports$/],
      ["Audit log", /^Audit trail$/],
      ["Notifications", /^Notifications$/],
      ["Settings", /^Settings$/],
      ["Dashboard", /^Good (morning|afternoon|evening), Aarav$/],
    ];
    for (const [link, heading] of pages) {
      // The Notifications link also carries the unread badge count.
      await page.getByRole("navigation").getByRole("link", { name: navName(link) }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByText(/^Loading .*…$/)).toHaveCount(0, { timeout: 20_000 });
      await expectNoLoadError(page);
    }
    // Seeded data shows up where it should.
    await page.goto(`${ADMIN_URL}/clients`);
    await expect(page.getByRole("button", { name: /Aurora Traders/ })).toBeVisible();
    await page.goto(`${ADMIN_URL}/audit`);
    await expect(page.getByText(/^Loading .*…$/)).toHaveCount(0, { timeout: 20_000 });
    await expectNoLoadError(page);
  });

  test("salesperson on the admin site gets a reduced nav and cannot reach admin pages", async ({ page }) => {
    await adminSignIn(page, PRIYA);
    const nav = page.getByRole("navigation");
    for (const allowed of ["Dashboard", "Clients", "Visits", "Follow-ups", "Calendar", "Notifications"]) {
      await expect(nav.getByRole("link", { name: navName(allowed) })).toBeVisible();
    }
    for (const blocked of ["Salespeople", "Reports", "Audit log", "Settings"]) {
      await expect(nav.getByRole("link", { name: blocked, exact: true })).toHaveCount(0);
    }
    await expect(page.getByText("Salesperson", { exact: true })).toBeVisible();
    await expectNoLoadError(page);

    for (const path of ["/salespeople", "/settings", "/audit", "/reports"]) {
      await page.goto(`${ADMIN_URL}${path}`);
      await expect(page.getByText("This page is only available to administrators.")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
    }

    // Allowed pages work and only show this salesperson's own data.
    for (const [path, heading] of [
      ["/clients", "Clients"],
      ["/visits", "Visits"],
      ["/followups", "Follow-ups"],
      ["/calendar", "Calendar"],
      ["/notifications", "Notifications"],
    ] as const) {
      await page.goto(`${ADMIN_URL}${path}`);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByText(/^Loading .*…$/)).toHaveCount(0, { timeout: 20_000 });
      await expectNoLoadError(page);
    }
    await page.goto(`${ADMIN_URL}/clients`);
    await expect(page.getByRole("button", { name: /Aurora Traders/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Chennai Hardware Hub/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add client" })).toHaveCount(0);
    await adminSignOut(page);
  });
});

test.describe("admin site: management", () => {
  test("settings: save organization with max 2 photos per visit, reject 3, update own profile", async ({ page }) => {
    await adminSignIn(page);
    await page.goto(`${ADMIN_URL}/settings`);
    const photos = page.getByLabel("Max photos per visit");
    await expect(photos).toHaveValue("2");

    // 3 is above the allowed maximum: the form must not save.
    await photos.fill("3");
    await page.getByRole("button", { name: "Save organization" }).click();
    await expect(page.getByText("Organization settings saved.")).toHaveCount(0);
    expect(await photos.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);

    await photos.fill("2");
    await page.getByLabel("GPS accuracy threshold (m)").fill("150");
    await page.getByRole("button", { name: "Save organization" }).click();
    await expect(page.getByText("Organization settings saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Max photos per visit")).toHaveValue("2");
    await expect(page.getByLabel("GPS accuracy threshold (m)")).toHaveValue("150");

    const card = page.locator("section", { hasText: "My profile" });
    await card.getByLabel("Phone").fill("+919810000099");
    await card.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile updated.")).toBeVisible();
  });

  test("create and edit a client, then assign a salesperson", async ({ page }) => {
    const name = `E2E Client ${uniqueSuffix()}`;
    await adminSignIn(page);
    await page.goto(`${ADMIN_URL}/clients`);
    await page.getByRole("button", { name: "Add client" }).click();
    const form = modal(page, "Add client");
    await field(form, "Client / business name").fill(name);
    await field(form, "Contact person").fill("Ritu Das");
    await field(form, "Phone").fill("+919830000001");
    await field(form, "Category").fill("Retail");
    await field(form, "Address line 1").fill("1 Park Street");
    await field(form, "City").fill("Kolkata");
    await field(form, "State").fill("West Bengal");
    await field(form, "Postal code").fill("700016");
    await field(form, "Latitude").fill("22.5533");
    await field(form, "Longitude").fill("88.3520");
    await form.getByRole("button", { name: "Create client" }).click();
    await expect(form).toHaveCount(0);

    await page.getByPlaceholder("Search by client, contact, city or phone").fill(name);
    await page.getByRole("button", { name: new RegExp(name) }).click();
    let detail = modal(page, name);
    await expect(detail.getByText("No active assignments.")).toBeVisible();

    // Edit
    await detail.getByRole("button", { name: "Edit client" }).click();
    const edit = modal(page, "Edit client");
    await field(edit, "City").fill("Howrah");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(edit).toHaveCount(0);
    await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("Howrah");

    // Assign Priya
    await page.getByRole("button", { name: new RegExp(name) }).click();
    detail = modal(page, name);
    await detail.getByRole("combobox").selectOption({ label: PRIYA.name });
    await detail.getByRole("button", { name: "Assign" }).click();
    await expect(detail.getByRole("listitem").filter({ hasText: PRIYA.name })).toBeVisible();
    await detail.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText(PRIYA.name);
  });

  test("schedule a visit for a salesperson", async ({ page }) => {
    await adminSignIn(page);
    await page.goto(`${ADMIN_URL}/visits`);
    await page.getByRole("button", { name: "Schedule visit" }).click();
    const form = modal(page, "Schedule a visit");
    await field(form, "Salesperson").selectOption({ label: PRIYA.name });
    await field(form, "Client").selectOption({ label: "BrightMart Stores — Bengaluru" });
    await field(form, "Date and time").fill(localDateTime(3, 11));
    await form.getByRole("button", { name: "Schedule visit" }).click();
    const detail = modal(page, "BrightMart Stores — Scheduled");
    await expect(detail).toBeVisible();
    await expect(detail.getByRole("button", { name: "Cancel visit" })).toBeVisible();
  });

  test("follow-ups: create, complete and cancel", async ({ page }) => {
    const suffix = uniqueSuffix();
    await adminSignIn(page);
    await page.goto(`${ADMIN_URL}/followups`);

    async function create(title: string) {
      await page.getByRole("button", { name: "New follow-up" }).click();
      const form = modal(page, "New follow-up");
      await field(form, "Salesperson").selectOption({ label: PRIYA.name });
      await field(form, "Client").selectOption({ label: "Aurora Traders" });
      await field(form, "Title").fill(title);
      await field(form, "Due date").fill(localDateTime(2, 9).slice(0, 10));
      await field(form, "Notes").fill("Created by the e2e suite");
      await form.getByRole("button", { name: "Create follow-up" }).click();
      await expect(form).toHaveCount(0);
      await expect(page.getByRole("listitem").filter({ hasText: title })).toContainText("Open");
    }

    const done = `Send quote ${suffix}`;
    const dropped = `Call back ${suffix}`;
    await create(done);
    await create(dropped);

    await page.getByRole("listitem").filter({ hasText: done }).getByRole("button", { name: "Complete" }).click();
    let dialog = modal(page, done);
    await field(dialog, "Completion note").fill("Quote sent by email");
    await dialog.getByRole("button", { name: "Mark complete" }).click();
    await expect(dialog).toHaveCount(0);
    // The list defaults to open follow-ups, so the completed one leaves it.
    await expect(page.getByRole("listitem").filter({ hasText: done })).toHaveCount(0);

    await page.getByRole("button", { name: new RegExp(dropped) }).click();
    dialog = modal(page, dropped);
    await dialog.getByRole("button", { name: "Cancel follow-up" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("listitem").filter({ hasText: dropped })).toHaveCount(0);

    const statusFilter = page.getByRole("combobox").filter({ has: page.locator("option", { hasText: "Overdue" }) });
    await statusFilter.selectOption("DONE");
    await expect(page.getByRole("listitem").filter({ hasText: done })).toContainText("Done");
    await statusFilter.selectOption("CANCELLED");
    await expect(page.getByRole("listitem").filter({ hasText: dropped })).toContainText("Cancelled");
  });
});
