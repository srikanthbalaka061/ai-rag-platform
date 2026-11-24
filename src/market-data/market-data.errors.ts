export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "MarketDataError";
  }
}
