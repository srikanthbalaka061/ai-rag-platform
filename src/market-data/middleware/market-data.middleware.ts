import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  ErrorRequestHandler,
  RequestHandler,
  Response,
} from "express";
import { MarketDataError } from "../market-data.errors.js";
import { marketDataConfig } from "../market-data.config.js";

export const marketDataRequestMiddleware: RequestHandler = (
  _request,
  response,
  next
) => {
  const requestId = randomUUID();
  response.setHeader("X-Request-Id", requestId);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  next();
};

export const marketDataAuthenticationMiddleware: RequestHandler = (
  request,
  response,
  next
) => {
  const authorization = request.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match) {
    response.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "A valid bearer token is required",
      },
    });
    return;
  }

  const expected = createHash("sha256")
    .update(marketDataConfig.clientToken)
    .digest();
  const provided = createHash("sha256").update(match[1]).digest();
  if (!timingSafeEqual(expected, provided)) {
    response.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "A valid bearer token is required",
      },
    });
    return;
  }
  next();
};

function sendError(
  response: Response,
  statusCode: number,
  code: string,
  message: string
): void {
  response.status(statusCode).json({ error: { code, message } });
}

export const marketDataErrorMiddleware: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next
) => {
  if (error instanceof MarketDataError) {
    sendError(response, error.statusCode, error.code, error.message);
    return;
  }

  console.error("Market data request failed:", error);
  sendError(
    response,
    500,
    "INTERNAL_SERVER_ERROR",
    "An unexpected market data error occurred"
  );
};
