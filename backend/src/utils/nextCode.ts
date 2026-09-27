/**
 * Suggests the next free numeric code.
 * - Starts from the most recently updated numeric code + 1 (keeps following the user
 *   if they deliberately jumped to a new number range), skipping non-numeric codes.
 * - Compares numerically, so "07" and "7" count as the same occupied code.
 * - Returns the code zero-padded to `width`, ready for the frontend to use as-is.
 *
 * @param codesByRecency existing codes, most recently updated first
 */
export function suggestNextCode(codesByRecency: string[], width: number): string {
  const numeric = codesByRecency.filter(c => /^\d+$/.test(c)).map(Number)
  const occupied = new Set(numeric)
  let candidate = (numeric[0] ?? 0) + 1
  while (occupied.has(candidate)) candidate++
  return String(candidate).padStart(width, '0')
}
