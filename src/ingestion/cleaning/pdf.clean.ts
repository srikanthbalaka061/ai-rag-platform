export function cleanPdfText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/-\n(?=\w)/g, "")
    .trim();
}