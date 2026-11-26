import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RequestHandler, Response } from "express";
import { apiAuthConfig } from "../config/api-auth.config.js";

export interface AuthenticatedPrincipal {
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedPrincipal;
      authSupabase?: SupabaseClient;
    }
  }
}

function unauthorized(response: Response, message: string): void {
  response.setHeader("WWW-Authenticate", "Bearer");
  response.status(401).json({
    error: { code: "UNAUTHORIZED", message },
  });
}

function authServiceUnavailable(response: Response): void {
  response.status(503).json({
    error: {
      code: "AUTH_PROVIDER_UNAVAILABLE",
      message: "Authentication could not be verified right now. Please try again.",
    },
  });
}

function isAuthProviderUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("status" in error)) return true;
  const status = error.status;
  return typeof status !== "number" || status === 429 || status >= 500;
}

export const apiAuthenticationMiddleware: RequestHandler = async (
  request,
  response,
  next
) => {
  const authorization = request.get("authorization") ?? "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (!match) {
    unauthorized(response, "A valid Supabase access token is required");
    return;
  }

  const supabase = createClient(
    apiAuthConfig.supabaseUrl,
    apiAuthConfig.supabasePublishableKey,
    {
      global: { headers: { Authorization: `Bearer ${match[1]}` } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );

  let userId: string;
  try {
    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error) {
      if (isAuthProviderUnavailable(error)) {
        authServiceUnavailable(response);
      } else {
        unauthorized(response, "The Supabase access token is invalid or expired");
      }
      return;
    }

    if (!data.user) {
      unauthorized(response, "The Supabase access token is invalid or expired");
      return;
    }
    userId = data.user.id;
  } catch {
    authServiceUnavailable(response);
    return;
  }

  request.auth = { userId };
  request.authSupabase = supabase;
  next();
};
