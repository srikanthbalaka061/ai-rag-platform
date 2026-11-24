import assert from "node:assert/strict";
import test from "node:test";
import { ingestionRegistry } from "../loaders/index.js";

test("registry recognizes every registered upload format case-insensitively", () => {
  for (const fileName of [
    "policy.PDF",
    "manual.docx",
    "notes.txt",
    "guide.md",
    "guide.markdown",
    "records.csv",
    "workbook.xls",
    "workbook.xlsx",
    "data.json",
    "page.html",
    "page.htm",
  ]) {
    assert.equal(ingestionRegistry.supports(fileName), true, fileName);
  }

  assert.equal(ingestionRegistry.supports("presentation.pptx"), false);
});
