/**
 * Normalizes a player name for fuzzy comparison:
 * decomposes Unicode to NFD, strips combining diacritics,
 * lowercases, trims, collapses whitespace.
 *
 * Examples:
 *   "Mbappé"    -> "mbappe"
 *   "Müller"    -> "muller"
 *   "Di María"  -> "di maria"
 */
export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
