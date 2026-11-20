import { load } from "cheerio";

import type { ExtractedDocument } from "../../core/ingestion.types.js";

export interface WebPageSource {
  documentId: string;
  url: string;
  tenantId: string;
  uploadedBy: string;
}

export class WebLoader {
  async loadUrl(source: WebPageSource): Promise<ExtractedDocument> {
    const url = new URL(source.url);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Only HTTP and HTTPS URLs are supported");
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "EnterpriseRAGBot/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${source.url}: HTTP ${response.status}`
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html")) {
      throw new Error("URL does not return an HTML document");
    }

    const html = await response.text();
    const $ = load(html);

    $("script, style, noscript, iframe, svg, nav, footer, header").remove();

    const title = $("title").text().trim();

    const description =
      $('meta[name="description"]').attr("content") ?? "";

    const content = $("main").length
      ? $("main").text()
      : $("body").text();

    const cleanContent = content
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanContent) {
      throw new Error("No readable content found on web page");
    }

    return {
      documentId: source.documentId,
      content: cleanContent,
      metadata: {
        documentType: "web",
        sourceUrl: source.url,
        domain: url.hostname,
        title,
        description,
        tenantId: source.tenantId,
        uploadedBy: source.uploadedBy,
        extractionMethod: "fetch + cheerio",
      },
    };
  }
}