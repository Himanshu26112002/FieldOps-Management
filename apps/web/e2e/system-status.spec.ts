import { expect, test } from "@playwright/test";

// Requires the Auth and Firestore emulators and NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true.
test("status page reaches Firestore and sees rules denying unauthenticated reads", async ({ page }) => {
  await page.goto("/");

  const firestoreRow = page.getByRole("listitem").filter({ hasText: "Firestore" });
  await expect(firestoreRow).toContainText("OK", { timeout: 15_000 });
  await expect(firestoreRow).toContainText("unauthenticated read correctly denied");

  await expect(page.getByRole("listitem").filter({ hasText: "Environment" })).toContainText("OK");
});
