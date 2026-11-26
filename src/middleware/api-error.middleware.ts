import type { ErrorRequestHandler, Response } from "express";
import { MarketDataError } from "../market-data/core/market-data.errors.js";

function sendError(
  response: Response,
  statusCode: number,
  code: string,
  message: string
): void {
  response.status(statusCode).json({ error: { code, message } });
}

export const apiErrorMiddleware: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next
) => {
  if (error instanceof MarketDataError) {
    sendError(response, error.statusCode, error.code, error.message);
    return;
  }

  console.error("API request failed:", error);
  sendError(
    response,
    500,
    "INTERNAL_SERVER_ERROR",
    "An unexpected API error occurred"
  );
};
