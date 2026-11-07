/** Reads a pasted paper menu: one dish per line, a name, then the price if there is one. */
export function parseMenuLines(lines: string): { name: string; price: number | null }[] {
  return lines.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = /^(.*?)[\s,·:\-–]*(?:₩\s*)?(\d{1,3}(?:,\d{3})+|\d{3,7})\s*(?:원|won)?$/i.exec(line);
    return match && match[1].trim()
      ? { name: match[1].trim(), price: Number(match[2].replaceAll(",", "")) }
      : { name: line, price: null };
  });
}
