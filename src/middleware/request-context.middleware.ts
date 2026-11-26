import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestContextMiddleware: RequestHandler = (
  _request,
  response,
  next
) => {
  response.setHeader("X-Request-Id", randomUUID());
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  next();
};
