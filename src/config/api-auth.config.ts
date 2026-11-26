import "dotenv/config";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function validateSupabaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("AUTH_SUPABASE_URL must be a valid URL");
  }

  const localHttpAllowed =
    process.env.NODE_ENV !== "production" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]");
  if (url.protocol !== "https:" && !localHttpAllowed) {
    throw new Error("AUTH_SUPABASE_URL must use HTTPS");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("AUTH_SUPABASE_URL must be an origin URL without credentials or path");
  }

  return url.origin;
}

export const apiAuthConfig = {
  supabaseUrl: validateSupabaseUrl(getRequiredEnv("AUTH_SUPABASE_URL")),
  supabasePublishableKey: getRequiredEnv("AUTH_SUPABASE_PUBLISHABLE_KEY"),
};
