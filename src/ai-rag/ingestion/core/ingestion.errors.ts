export class DuplicateDocumentError extends Error {
  constructor(readonly documentId: string) {
    super(`Document ${documentId} already exists`);
    this.name = "DuplicateDocumentError";
  }
}

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
