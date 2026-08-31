export interface SignupForm {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Validates the sign-up form. Returns a user-readable error, or null when the
 * form is valid.
 */
export function validateSignup(form: SignupForm): string | null {
  if (!form.firstName.trim()) return "Enter your first name.";
  if (!form.lastName.trim()) return "Enter your last name.";

  const username = form.username.trim().toLowerCase();
  if (username.length < 3 || username.length > 20) {
    return "Username must be 3–20 characters.";
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return "Usernames can only use letters, numbers, and underscores.";
  }

  const email = form.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }

  if (form.password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (form.password !== form.confirmPassword) {
    return "Passwords don't match.";
  }

  return null;
}
