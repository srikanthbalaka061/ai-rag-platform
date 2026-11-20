import type {
  DocumentLoader,
  DocumentSource,
} from "./ingestion.types.js";

export class IngestionRegistry {
  private loaders = new Map<string, DocumentLoader>();

  register(extension: string, loader: DocumentLoader): void {
    this.loaders.set(extension.toLowerCase(), loader);
  }

  getLoader(source: DocumentSource): DocumentLoader {
    const extension = source.fileName
      .split(".")
      .pop()
      ?.toLowerCase();

    if (!extension) {
      throw new Error("Unable to detect document extension");
    }

    const loader = this.loaders.get(extension);

    if (!loader) {
      throw new Error(`Unsupported document format: ${extension}`);
    }

    return loader;
  }
}