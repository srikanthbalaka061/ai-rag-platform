import { IngestionRegistry } from "../core/ingestion.registry.js";

import { PdfLoader } from "./pdf/pdf.loader.js";
import { DocxLoader } from "./docx/docx.loader.js";
import { TextLoader } from "./text/text.loader.js";
import { MarkdownLoader } from "./markdown/markdown.loader.js";
import { CsvLoader } from "./csv/csv.loader.js";
import { ExcelLoader } from "./excel/excel.loader.js";
import { JsonLoader } from "./json/json.loader.js";
import { HtmlLoader } from "./html/html.loader.js";

export const ingestionRegistry = new IngestionRegistry();

ingestionRegistry.register("pdf", new PdfLoader());
ingestionRegistry.register("docx", new DocxLoader());
ingestionRegistry.register("txt", new TextLoader());
ingestionRegistry.register("md", new MarkdownLoader());
ingestionRegistry.register("markdown", new MarkdownLoader());
ingestionRegistry.register("csv", new CsvLoader());
ingestionRegistry.register("xlsx", new ExcelLoader());
ingestionRegistry.register("xls", new ExcelLoader());
ingestionRegistry.register("json", new JsonLoader());
ingestionRegistry.register("html", new HtmlLoader());
ingestionRegistry.register("htm", new HtmlLoader());