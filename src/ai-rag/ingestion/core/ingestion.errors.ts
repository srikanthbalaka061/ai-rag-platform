export class IngestionError extends Error {
  constructor(
    message: string,
    readonly documentId: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "IngestionError";
  }
}