import type { Page } from "@playwright/test";
import { ADMIN, BENGALURU, PRIYA, SALES_URL, cardWith, expect, salesSignIn, salesTab, shown, test, uniqueSuffix } from "./fixtures";

/** The client card on the Clients tab. */
const clientCard = (page: Page, name: string) => cardWith(page, name, "Check in now");

const PRIYA_CLIENTS = ["Aurora Traders", "BrightMart Stores", "Delta Distributors", "FreshLeaf Organics"];
const OTHER_CLIENTS = ["Chennai Hardware Hub", "Everest Kirana", "Granite & Co.", "Harbor Cafe Supplies"];

test.describe("sales site: access", () => {
  test("wrong password and admin accounts are rejected clearly", async ({ page, allowErrors }) => {
    allowErrors(/Failed to load resource: the server responded with a status of 400/);
    await page.goto(`${SALES_URL}/login`);
    await page.getByPlaceholder("you@company.com").fill(PRIYA.email);
    await page.getByPlaceholder("Enter your password").fill("WrongPass1!");
    await shown(page, "Sign in").click();
    await expect(shown(page, /^Incorrect (email or )?password/)).toBeVisible();

    await page.getByPlaceholder("Enter your password").fill(ADMIN.password);
    await page.getByPlaceholder("you@company.com").fill(ADMIN.email);
    await shown(page, "Sign in").click();
    await expect(shown(page, "Administrator accounts use the web dashboard.")).toBeVisible();
    await expect(shown(page, /^Hello, /)).toHaveCount(0);
  });

  test("salesperson sees only assigned clients and cannot open another rep's client or visit by URL", async ({ page }) => {
    await salesSignIn(page, PRIYA);
    await expect(shown(page, "Assigned clients")).toBeVisible();

    await salesTab(page, "Clients").click();
    for (const name of PRIYA_CLIENTS) await expect(shown(page, name)).toBeVisible();
    for (const name of OTHER_CLIENTS) await expect(shown(page, name)).toHaveCount(0);

    // Assigned client detail works.
    await shown(page, "Aurora Traders").click();
    await expect(shown(page, "Contact & address")).toBeVisible();
    await expect(shown(page, "Nikhil Rao")).toBeVisible();

    // Rahul's client and visit, opened directly by URL.
    await page.goto(`${SALES_URL}/client/client-chennai`);
    await expect(shown(page, "Client unavailable")).toBeVisible();
    await expect(shown(page, "This client is not assigned to your account or is no longer available.")).toBeVisible();
    await expect(shown(page, "Suresh Kumar")).toHaveCount(0);

    await page.goto(`${SALES_URL}/visit/demo-visit-2`);
    await expect(shown(page, "Visit unavailable")).toBeVisible();
    await expect(shown(page, "Visit not found or you do not have access.")).toBeVisible();
    await expect(shown(page, /evaluation error|insufficient permissions/i)).toHaveCount(0);
  });

  test("sign out ends the session and protects every screen", async ({ page }) => {
    await salesSignIn(page, PRIYA);
    await salesTab(page, "Profile").click();
    await shown(page, "Sign out").click();
    await expect(page.getByPlaceholder("you@company.com")).toBeVisible();
    for (const path of ["/home", "/clients", "/visits", "/followups", "/profile", "/visit/demo-visit-1", "/schedule"]) {
      await page.goto(`${SALES_URL}${path}`);
      await expect(page.getByPlaceholder("you@company.com"), `${path} should require sign-in`).toBeVisible();
    }
  });
});

test.describe("sales site: field work", () => {
  test.use({ geolocation: BENGALURU, permissions: ["geolocation"] });

  test("check-in with location permission denied shows a clear error and creates nothing", async ({ page, context }) => {
    await context.clearPermissions();
    await salesSignIn(page, PRIYA);
    await salesTab(page, "Visits").click();
    await expect(shown(page, "Aurora Traders").first()).toBeVisible();
    const visitsBefore = await shown(page, /^(Scheduled|Ad hoc) /).count();

    await salesTab(page, "Clients").click();
    await clientCard(page, "BrightMart Stores").getByText("Check in now", { exact: true }).click();
    await expect(shown(page, "Location permission is required to check in and check out of visits.")).toBeVisible();

    await salesTab(page, "Visits").click();
    await expect(shown(page, /^(Scheduled|Ad hoc) /)).toHaveCount(visitsBefore);
  });

  test("check-in when the device cannot get a GPS fix shows a clear error", async ({ page }) => {
    // Simulate a browser that has permission but no position (GPS off / no signal): POSITION_UNAVAILABLE.
    await page.addInitScript(() => {
      const unavailable = { code: 2, message: "Position unavailable", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
      navigator.geolocation.getCurrentPosition = (_success, failure) => failure?.(unavailable as GeolocationPositionError);
    });
    await salesSignIn(page, PRIYA);
    await salesTab(page, "Clients").click();
    await clientCard(page, "BrightMart Stores").getByText("Check in now", { exact: true }).click();
    await expect(shown(page, /Could not get your location\. Turn on device location \(GPS\)/)).toBeVisible();
  });

  test("schedule an own visit, then check in on site with GPS", async ({ page }) => {
    await salesSignIn(page, PRIYA);
    await salesTab(page, "Clients").click();
    await clientCard(page, "Delta Distributors").getByText("Schedule", { exact: true }).click();
    await expect(shown(page, "Schedule a visit")).toBeVisible();
    await expect(page.getByLabel("Visit date and time")).not.toHaveValue("");
    // The stack header is also titled "Schedule visit"; click the button, not the heading.
    await shown(page, "Schedule visit").and(page.locator(":not([role=heading])")).click();

    // Lands on the new visit.
    await expect(shown(page, "Delta Distributors")).toBeVisible();
    await expect(shown(page, "Scheduled")).toBeVisible();
    await shown(page, "Check in").click();
    await expect(shown(page, "Checked in. Complete the visit report when you are ready.")).toBeVisible();
    await expect(shown(page, "In progress")).toBeVisible();
    await expect(shown(page, /^Photos \(0\/2\)$/)).toBeVisible();
    await expect(page.getByLabel("Visit summary")).toBeVisible();
  });

  test("create a follow-up and complete it", async ({ page, guard }) => {
    const title = `Send samples ${uniqueSuffix()}`;
    await salesSignIn(page, PRIYA);
    await salesTab(page, "Follow-ups").click();
    await shown(page, "Create follow-up").click();
    await expect(page.getByRole("heading", { name: "New follow-up" })).toBeVisible();
    await page.getByRole("radio", { name: /BrightMart Stores/ }).click();
    await page.getByLabel("Follow-up title").fill(title);
    await page.getByLabel("Follow-up description").fill("Two sample boxes for the store manager");
    await shown(page, "Create follow-up").click();
    await expect.poll(() => guard.dialogs.join("\n")).toContain("Follow-up created");

    await expect(shown(page, title)).toBeVisible();
    await cardWith(page, title, "Mark complete").getByText("Mark complete", { exact: true }).click();
    await expect.poll(() => guard.dialogs.join("\n")).toContain("Complete follow-up");
    await expect(shown(page, title)).toHaveCount(0);
    await shown(page, "Done").click();
    await expect(shown(page, title)).toBeVisible();
  });

  test("edit own profile", async ({ page, guard }) => {
    const phone = `+9198${Date.now().toString().slice(-8)}`;
    await salesSignIn(page, PRIYA);
    await salesTab(page, "Profile").click();
    await expect(shown(page, PRIYA.email)).toBeVisible();
    await page.getByLabel("Phone").fill(phone);
    await shown(page, "Save changes").click();
    await expect.poll(() => guard.dialogs.join("\n")).toContain("Profile updated");
    await page.reload();
    await expect(page.getByLabel("Phone")).toHaveValue(phone);
  });
});

test.describe("sales site: phone viewport", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, geolocation: BENGALURU, permissions: ["geolocation"] });

  test("every tab is usable at 390x844 without horizontal scrolling", async ({ page }) => {
    await salesSignIn(page, PRIYA);
    const noHorizontalScroll = async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    };
    await noHorizontalScroll();
    for (const [tab, heading] of [
      ["Clients", "Clients"],
      ["Visits", "Visits"],
      ["Follow-ups", "Follow-ups"],
      ["Profile", "Profile"],
    ] as const) {
      await salesTab(page, tab).tap();
      await expect(shown(page, heading).and(page.locator(":not([role=tab] *)")).first()).toBeVisible();
      await expect(salesTab(page, tab)).toBeInViewport();
      await noHorizontalScroll();
    }
    // A visit screen with its photo and report controls fits the phone too.
    await salesTab(page, "Visits").tap();
    await shown(page, "Aurora Traders").first().tap();
    await expect(shown(page, "Check in")).toBeInViewport();
    await noHorizontalScroll();
  });
});
