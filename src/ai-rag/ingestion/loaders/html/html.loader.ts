import fs from "node:fs/promises";
import { load } from "cheerio";

import type {
  DocumentLoader,
  DocumentSource,
  ExtractedDocument,
} from "../../core/ingestion.types.js";

import { createExtractedDocument } from "../loader.utils.js";

export class HtmlLoader implements DocumentLoader {
  async load(source: DocumentSource): Promise<ExtractedDocument> {
    const html = await fs.readFile(
      source.filePath,
      "utf-8"
    );

    const $ = load(html);

    $("script, style, noscript, iframe, svg").remove();

    const title = $("title").text().trim();

    const content = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (!content) {
      throw new Error(`No readable HTML content: ${source.fileName}`);
    }

    return createExtractedDocument(
      source,
      content,
      {
        documentType: "html",
        title,
        extractionMethod: "cheerio",
      }
    );
  }
}