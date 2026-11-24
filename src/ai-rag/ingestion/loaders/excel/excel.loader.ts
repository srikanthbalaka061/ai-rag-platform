import * as XLSX from "xlsx";

import type {
  DocumentLoader,
  DocumentSource,
  ExtractedDocument,
} from "../../core/ingestion.types.js";

import { createExtractedDocument } from "../loader.utils.js";

export class ExcelLoader implements DocumentLoader {
  async load(source: DocumentSource): Promise<ExtractedDocument> {
    const workbook = XLSX.readFile(source.filePath, {
      cellDates: true,
    });

    const sheetContents: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(
        sheet,
        {
          header: 1,
          defval: "",
          raw: false,
        }
      ) as unknown[][];

      if (rows.length === 0) continue;

      const headers = rows[0].map(
        (value, index) => String(value || `Column ${index + 1}`)
      );

      const dataRows = rows.slice(1);

      const sheetText = dataRows.map((row, index) => {
        const values = headers.map(
          (header, columnIndex) =>
            `${header}: ${String(row[columnIndex] ?? "")}`
        );

        return `Row ${index + 1}\n${values.join("\n")}`;
      });

      sheetContents.push(
        `Sheet: ${sheetName}\n\n${sheetText.join("\n\n")}`
      );
    }

    const content = sheetContents.join("\n\n");

    if (!content.trim()) {
      throw new Error(
        `Excel workbook contains no data: ${source.fileName}`
      );
    }

    return createExtractedDocument(
      source,
      content,
      {
        documentType: "excel",
        sheetNames: workbook.SheetNames,
        totalSheets: workbook.SheetNames.length,
        extractionMethod: "xlsx",
      }
    );
  }
}