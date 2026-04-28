/** Parse comma- or newline-separated crop/region tags from the editor. */
export function parseAdvisoryListInput(raw: string): string[] {
  const parts = raw.split(/[\n,]+/).map((s) => s.trim())
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    if (!p || seen.has(p.toLowerCase())) continue
    seen.add(p.toLowerCase())
    out.push(p)
  }
  return out
}

export function formatAdvisoryListInput(items: string[]): string {
  return items.join(", ")
}
