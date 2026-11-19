import type { Page } from "@playwright/test";
import {
  ADMIN_URL,
  BENGALURU,
  PRIYA,
  adminCreateAssignedClient,
  adminSignIn,
  cardWith,
  expect,
  field,
  localDateTime,
  makeJpeg,
  modal,
  salesSignIn,
  salesTab,
  shown,
  test,
  uniqueSuffix,
} from "./fixtures";

const salesContext = { geolocation: BENGALURU, permissions: ["geolocation"] };

/** The pressable wrapping a sales-site button label. */
const pressable = (page: Page, label: string) => shown(page, label).locator("xpath=ancestor::*[@tabindex][1]");

async function addPhoto(page: Page, button: "Choose from library" | "Take photo", color: string, label: string) {
  const jpeg = await makeJpeg(page, color, label);
  const chooser = page.waitForEvent("filechooser");
  await shown(page, button).click();
  await (await chooser).setFiles(jpeg);
}

async function openAdminVisit(admin: Page, clientName: string, status: string) {
  await admin.goto(`${ADMIN_URL}/visits`);
  await admin.getByPlaceholder("Search client, city or salesperson").fill(clientName);
  const row = admin.getByRole("row", { name: new RegExp(clientName) });
  await expect(row).toContainText(status);
  await row.getByRole("button", { name: "Review" }).click();
  const detail = modal(admin, `${clientName} — ${status}`);
  await expect(detail).toBeVisible();
  return detail;
}

test("admin provisions a salesperson who signs in on the sales site; deactivation blocks them", async ({ page, newGuardedPage, allowErrors }) => {
  // Signing in again after deactivation is refused by the rules (logged by the browser as a failed request).
  allowErrors(/Failed to load resource: the server responded with a status of 40[03]/);
  const suffix = uniqueSuffix();
  const rep = { name: `Test Rep ${suffix}`, email: `rep.${suffix}@fieldops.local`, password: "Temp1234x" };

  await adminSignIn(page);
  await page.goto(`${ADMIN_URL}/salespeople`);
  await page.getByRole("button", { name: "Create salesperson" }).click();
  const form = modal(page, "Create salesperson");
  await field(form, "Full name").fill(rep.name);
  await field(form, "Work email").fill(rep.email);
  await field(form, "Phone").fill("+919811112222");
  await field(form, "Employee code").fill(`E2E-${suffix.slice(-6)}`);
  await field(form, "Temporary password").fill(rep.password);
  await form.getByRole("button", { name: "Create salesperson" }).click();
  const created = modal(page, "Account created");
  await expect(created).toContainText(rep.email);
  await expect(created).toContainText(rep.password);
  await created.getByRole("button", { name: "Done" }).click();
  // The admin is still signed in as themselves (account created through the secondary app).
  await expect(page.getByText("Administrator", { exact: true })).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(rep.name) });
  await expect(row).toContainText("ACTIVE");

  const sales = await newGuardedPage(salesContext);
  await salesSignIn(sales, rep);
  await expect(shown(sales, `Hello, Test`)).toBeVisible();
  await salesTab(sales, "Clients").click();
  await expect(shown(sales, "No clients assigned")).toBeVisible();

  // Deactivate while the salesperson is signed in.
  await row.getByRole("button", { name: "Manage" }).click();
  await modal(page, rep.name).getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByRole("row", { name: new RegExp(rep.name) })).toContainText("INACTIVE");

  // Next server round trip signs them out with a clear reason.
  await sales.reload();
  await expect(sales.getByPlaceholder("you@company.com")).toBeVisible();
  await expect(shown(sales, /deactivated|not provisioned/)).toBeVisible();

  // And they cannot sign back in.
  await sales.getByPlaceholder("you@company.com").fill(rep.email);
  await sales.getByPlaceholder("Enter your password").fill(rep.password);
  await shown(sales, "Sign in").click();
  await expect(shown(sales, /deactivated|not provisioned/)).toBeVisible();
  await expect(shown(sales, /^Hello, /)).toHaveCount(0);
});

test("admin schedules a visit; the salesperson sees it and checks in with GPS", async ({ page, newGuardedPage }) => {
  const client = `E2E Scheduled ${uniqueSuffix()}`;
  await adminSignIn(page);
  await adminCreateAssignedClient(page, client, PRIYA.name);
  await page.goto(`${ADMIN_URL}/visits`);
  await page.getByRole("button", { name: "Schedule visit" }).click();
  const form = modal(page, "Schedule a visit");
  await field(form, "Salesperson").selectOption({ label: PRIYA.name });
  await field(form, "Client").selectOption({ label: `${client} — Bengaluru` });
  await field(form, "Date and time").fill(localDateTime(1, 10));
  await form.getByRole("button", { name: "Schedule visit" }).click();
  await expect(modal(page, `${client} — Scheduled`)).toBeVisible();

  const sales = await newGuardedPage(salesContext);
  await salesSignIn(sales, PRIYA);
  await salesTab(sales, "Visits").click();
  await shown(sales, client).click();
  await expect(shown(sales, "Scheduled")).toBeVisible();
  await shown(sales, "Check in").click();
  await expect(shown(sales, "In progress")).toBeVisible();

  // The admin sees the GPS check-in.
  const detail = await openAdminVisit(page, client, "In progress");
  await expect(detail).toContainText(`${BENGALURU.latitude.toFixed(4)}, ${BENGALURU.longitude.toFixed(4)}`);
});

test("visit lifecycle: ad hoc check-in, 2-photo limit, submit, return, resubmit, approve", async ({ page, newGuardedPage, guard }) => {
  const client = `E2E Lifecycle ${uniqueSuffix()}`;
  const returnReason = "Please add the competitor pricing details";
  await adminSignIn(page);
  await adminCreateAssignedClient(page, client, PRIYA.name);

  // --- Salesperson: ad hoc visit with GPS check-in.
  const sales = await newGuardedPage(salesContext);
  await salesSignIn(sales, PRIYA);
  await salesTab(sales, "Clients").click();
  await cardWith(sales, client, "Check in now").getByText("Check in now", { exact: true }).click();
  await expect(shown(sales, "Ad hoc visit")).toBeVisible();
  await expect(shown(sales, "In progress")).toBeVisible();
  await expect(shown(sales, "Photos (0/2)")).toBeVisible();

  // --- Photos: two allowed, a third blocked, remove + re-add works.
  await addPhoto(sales, "Choose from library", "#1d4ed8", "one");
  await expect(shown(sales, "Photos (1/2)")).toBeVisible();
  await addPhoto(sales, "Take photo", "#047857", "two");
  await expect(shown(sales, "Photos (2/2)")).toBeVisible();
  await expect(sales.getByRole("img", { name: "Visit photo" })).toHaveCount(2);
  for (const button of ["Take photo", "Choose from library"]) {
    await expect(pressable(sales, button)).toHaveAttribute("aria-disabled", "true");
  }
  // Even a forced click must not open the picker for a 3rd photo.
  const third = sales.waitForEvent("filechooser", { timeout: 2_000 }).then(() => "opened", () => "blocked");
  await shown(sales, "Choose from library").click({ force: true });
  expect(await third).toBe("blocked");
  await expect(shown(sales, "Photos (2/2)")).toBeVisible();

  await shown(sales, "Remove").first().click();
  await expect.poll(() => guard.dialogs.join("\n")).toContain("Remove photo");
  await expect(shown(sales, "Photos (1/2)")).toBeVisible();
  await expect(pressable(sales, "Choose from library")).not.toHaveAttribute("aria-disabled", "true");
  await addPhoto(sales, "Choose from library", "#b45309", "three");
  await expect(shown(sales, "Photos (2/2)")).toBeVisible();
  await expect(sales.getByRole("img", { name: "Visit photo" })).toHaveCount(2);

  // --- Report: validation, then submit (GPS check-out).
  await sales.getByLabel("Visit summary").fill("Too short");
  await shown(sales, "Submit visit").click();
  await expect(shown(sales, "Summary must be at least 10 characters")).toBeVisible();
  await expect(shown(sales, "In progress")).toBeVisible();
  await sales.getByLabel("Visit summary").fill("Met the owner and walked through the new catalogue.");
  await shown(sales, "Interested").click();
  await sales.getByLabel("Activities").fill("Catalogue walkthrough, Price discussion");
  await sales.getByLabel("Products discussed").fill("Starter pack");
  await sales.getByLabel("Customer feedback").fill("Wants a trial order");
  await shown(sales, "Submit visit").click();
  await expect(shown(sales, "Visit submitted for review.")).toBeVisible();
  await expect(shown(sales, "Awaiting approval")).toBeVisible();
  await expect(shown(sales, "This visit is read-only.")).toBeVisible();

  // --- Admin: review and return with a reason.
  let detail = await openAdminVisit(page, client, "Awaiting approval");
  await expect(detail.getByText("Photos (2)")).toBeVisible();
  await expect(detail.getByRole("img")).toHaveCount(2);
  await expect(detail).toContainText("Met the owner and walked through the new catalogue.");
  await expect(detail).toContainText(`${BENGALURU.latitude.toFixed(4)}, ${BENGALURU.longitude.toFixed(4)}`);
  await detail.getByRole("button", { name: "Return for correction" }).click();
  await expect(detail.getByText("Add a correction reason of at least 5 characters.")).toBeVisible();
  await detail.getByRole("textbox").fill(returnReason);
  await detail.getByRole("button", { name: "Return for correction" }).click();
  detail = modal(page, `${client} — Returned for correction`);
  await expect(detail).toContainText(`Returned for correction: ${returnReason}`);

  // --- Salesperson: sees the reason, edits and resubmits.
  await sales.reload();
  await expect(shown(sales, `Corrections requested: ${returnReason}`)).toBeVisible();
  await expect(shown(sales, "Photos (2/2)")).toBeVisible();
  await sales.getByLabel("Competitor information").fill("Competitor offers 4% extra margin");
  await sales.getByLabel("Visit summary").fill("Met the owner, walked through the catalogue and noted competitor pricing.");
  await shown(sales, "Submit visit").click();
  await expect(shown(sales, "Visit submitted for review.")).toBeVisible();
  await expect(shown(sales, "Awaiting approval")).toBeVisible();

  // --- Admin: revision history is attributable; approve.
  detail = await openAdminVisit(page, client, "Awaiting approval");
  await expect(detail.getByText("Revision 1")).toBeVisible();
  await expect(detail).toContainText(returnReason);
  await expect(detail).toContainText("Competitor: Competitor offers 4% extra margin");
  await detail.getByRole("button", { name: "Approve" }).click();
  detail = modal(page, `${client} — Approved`);
  await expect(detail.getByText("No actions available for this status.")).toBeVisible();

  // --- Salesperson: approved and read-only.
  await sales.reload();
  await expect(shown(sales, "Approved")).toBeVisible();
  await expect(shown(sales, "This visit is read-only.")).toBeVisible();
  await expect(shown(sales, "Remove")).toHaveCount(0);
  await expect(sales.getByLabel("Visit summary")).toHaveCount(0);

  // The admin dashboard and reports still load after the whole lifecycle.
  await page.goto(`${ADMIN_URL}/reports`);
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  await page.goto(`${ADMIN_URL}/dashboard`);
  await expect(page.getByRole("heading", { level: 1, name: /^Good / })).toBeVisible();
});
