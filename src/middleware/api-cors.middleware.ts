import type { RequestHandler } from "express";

export const apiCorsMiddleware: RequestHandler = (request, response, next) => {
  const origin = request.get("origin");
  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    response.setHeader("Access-Control-Max-Age", "600");
  }

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
};
