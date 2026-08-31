import { describe, expect, it } from "vitest";
import { validateSignup, type SignupForm } from "./signupValidation";

const validForm: SignupForm = {
  firstName: "Beckett",
  lastName: "Blacker",
  username: "beckett_b",
  email: "beckett@example.com",
  password: "supersecret1",
  confirmPassword: "supersecret1",
};

// @kliv-spec-derived — from user intent: "they have to sign up with name, last
// name, username, password and email" — every field is required and enforced.
describe("validateSignup", () => {
  it("accepts a complete form with first name, last name, username, email and password", () => {
    expect(validateSignup(validForm)).toBeNull();
  });

  it("rejects a missing first name", () => {
    expect(validateSignup({ ...validForm, firstName: "  " })).toContain("first name");
  });

  it("rejects a missing last name", () => {
    expect(validateSignup({ ...validForm, lastName: "" })).toContain("last name");
  });

  it("rejects a username that is too short", () => {
    expect(validateSignup({ ...validForm, username: "ab" })).toContain("Username");
  });

  it("rejects a username with spaces or symbols", () => {
    expect(validateSignup({ ...validForm, username: "bad name!" })).toContain("letters, numbers");
  });

  it("rejects an invalid email", () => {
    expect(validateSignup({ ...validForm, email: "not-an-email" })).toContain("email");
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(validateSignup({ ...validForm, password: "short", confirmPassword: "short" })).toContain(
      "8 characters"
    );
  });

  it("rejects passwords that don't match", () => {
    expect(validateSignup({ ...validForm, confirmPassword: "different1" })).toContain("match");
  });
});
