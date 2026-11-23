import type {
  DocumentLoader,
  DocumentSource,
} from "./ingestion.types.js";

export class IngestionRegistry {
  private loaders = new Map<string, DocumentLoader>();

  register(extension: string, loader: DocumentLoader): void {
    this.loaders.set(extension.replace(/^\./, "").toLowerCase(), loader);
  }

  supports(fileName: string): boolean {
    const extension = fileName.split(".").pop()?.toLowerCase();
    return Boolean(extension && this.loaders.has(extension));
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