import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";

import type {
  DocumentLoader,
  DocumentSource,
  ExtractedDocument,
} from "../../core/ingestion.types.js";

import { createExtractedDocument } from "../loader.utils.js";

export class CsvLoader implements DocumentLoader {
  async load(source: DocumentSource): Promise<ExtractedDocument> {
    const raw = await fs.readFile(source.filePath, "utf-8");

    const rows = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];

    if (rows.length === 0) {
      throw new Error(`CSV contains no data: ${source.fileName}`);
    }

    const headers = Object.keys(rows[0]);

    const content = rows
      .map((row, index) => {
        const values = headers.map(
          (header) => `${header}: ${row[header] ?? ""}`
        );

        return `Row ${index + 1}\n${values.join("\n")}`;
      })
      .join("\n\n");

    return createExtractedDocument(
      source,
      content,
      {
        documentType: "csv",
        totalRows: rows.length,
        columns: headers,
        extractionMethod: "csv-parse",
      }
    );
  }
}