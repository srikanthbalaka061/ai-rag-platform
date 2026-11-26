import type { RequestHandler } from "express";

export const requireAdmin: RequestHandler = async (request, response, next) => {
  const supabase = request.authSupabase;
  if (!request.auth || !supabase) {
    response.setHeader("WWW-Authenticate", "Bearer");
    response.status(401).json({
      error: { code: "UNAUTHORIZED", message: "A signed-in user is required" },
    });
    return;
  }

  let role: string | null;
  try {
    const result = await supabase.rpc("current_user_role");
    if (result.error) {
      response.status(503).json({
        error: {
          code: "AUTHORIZATION_PROVIDER_UNAVAILABLE",
          message: "Permissions could not be checked right now. Please try again.",
        },
      });
      return;
    }
    role = result.data;
  } catch {
    response.status(503).json({
      error: {
        code: "AUTHORIZATION_PROVIDER_UNAVAILABLE",
        message: "Permissions could not be checked right now. Please try again.",
      },
    });
    return;
  }

  if (role !== "admin") {
    response.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Administrator access is required for this operation",
      },
    });
    return;
  }

  next();
};
