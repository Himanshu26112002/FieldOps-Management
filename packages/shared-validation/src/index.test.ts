import { describe, expect, it } from "vitest";
import { canTransition } from "@fieldops/shared-types";
import { envFlag, firebaseWebConfigSchema, membershipSchema, orgIdSchema } from "./index";

describe("membershipSchema", () => {
  it("accepts a valid membership", () => {
    expect(membershipSchema.safeParse({ orgId: "main", role: "ADMIN", status: "ACTIVE" }).success).toBe(true);
  });

  it("rejects roles outside ADMIN/USER", () => {
    expect(membershipSchema.safeParse({ orgId: "main", role: "MANAGER", status: "ACTIVE" }).success).toBe(false);
  });
});

describe("orgIdSchema", () => {
  it("rejects path separators", () => {
    expect(orgIdSchema.safeParse("main/other").success).toBe(false);
  });
});

describe("firebaseWebConfigSchema", () => {
  it("reports the missing variable by name", () => {
    const result = firebaseWebConfigSchema.safeParse({
      apiKey: "",
      authDomain: "x",
      projectId: "x",
      appId: "x",
      messagingSenderId: "x",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("NEXT_PUBLIC_FIREBASE_API_KEY");
  });
});

describe("envFlag", () => {
  it("is true only for the literal 'true'", () => {
    expect(envFlag("true")).toBe(true);
    expect(envFlag("TRUE")).toBe(false);
    expect(envFlag(undefined)).toBe(false);
  });
});

describe("canTransition", () => {
  it("allows the documented lifecycle", () => {
    expect(canTransition("SCHEDULED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("SUBMITTED", "RETURNED")).toBe(true);
    expect(canTransition("RETURNED", "SUBMITTED")).toBe(true);
  });

  it("rejects transitions out of final states and skipped steps", () => {
    expect(canTransition("APPROVED", "SUBMITTED")).toBe(false);
    expect(canTransition("CANCELLED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("IN_PROGRESS", "APPROVED")).toBe(false);
  });
});
