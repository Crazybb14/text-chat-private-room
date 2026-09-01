const COOKIE_NAME = "chat_device_id";
const MIRROR_KEY = "chat_device_id"; // legacy localStorage copy, still honored
const DEVICE_ID_LENGTH = 100;

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(value: string): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function generate(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const cryptoObj = typeof crypto !== "undefined" ? crypto : undefined;
  for (let i = 0; i < DEVICE_ID_LENGTH; i++) {
    if (cryptoObj?.getRandomValues) {
      const buf = new Uint32Array(1);
      cryptoObj.getRandomValues(buf);
      result += chars.charAt(buf[0] % chars.length);
    } else {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return result;
}

/**
 * A stable per-browser device ID kept in a year-long cookie (with a
 * localStorage mirror for older sessions). Moderation ties bans to it, so a
 * banned device stays banned even under freshly made accounts.
 */
export function getDeviceId(): string {
  let deviceId = readCookie();
  if (!deviceId) {
    try {
      deviceId = localStorage.getItem(MIRROR_KEY) ?? generate();
    } catch {
      deviceId = generate();
    }
    writeCookie(deviceId);
  }
  try {
    if (localStorage.getItem(MIRROR_KEY) !== deviceId) {
      localStorage.setItem(MIRROR_KEY, deviceId);
    }
  } catch {
    // storage unavailable — the cookie still carries the id
  }
  return deviceId;
}

export default getDeviceId;
