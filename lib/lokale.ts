/** Lokale (units): category vocabulary + matrix-label suggestion.
 *  DB type stays 'apartment'; `unit_category` and `matrix_label` come from
 *  migration 024. */

import type { UnitCategory } from "@/lib/types/db"

/** Mirrors the CHECK on locations.matrix_label (migration 024). */
export const MAX_MATRIX_LABEL_LENGTH = 8

export const UNIT_CATEGORIES: UnitCategory[] = [
  "residential",
  "commercial",
  "storage",
  "technical",
]

export const CATEGORY_LABELS: Record<UnitCategory, string> = {
  residential: "Mieszkalny",
  commercial: "Usługowy",
  storage: "Komórka lokatorska",
  technical: "Techniczny",
}

/** Matrix-label prefix per category: M12 / U3 / K.L.5 / T2 */
export const CATEGORY_PREFIXES: Record<UnitCategory, string> = {
  residential: "M",
  commercial: "U",
  storage: "K.L.",
  technical: "T",
}

/** Known technical rooms — a name hit wins over the "T" + number fallback. */
export const TECHNICAL_ABBREVIATIONS: Record<string, string> = {
  "Węzeł cieplny": "WĘZ",
  "Rozdzielnia elektryczna": "RE",
  "Przyłącze wody": "PW",
  Kotłownia: "KOT",
  Wentylatorownia: "WEN",
  Hydrofornia: "HYD",
  Śmietnik: "ŚM",
  Rowerownia: "ROW",
  Wózkownia: "WÓZ",
  "Pomieszczenie gospodarcze": "PG",
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("pl")
}

/** Dictionary lookup: exact name first, then "name contains a known room"
 *  (so "Węzeł cieplny WC-1" still resolves to WĘZ). */
export function technicalAbbreviation(name: string): string | null {
  const needle = normalize(name)
  if (!needle) return null

  for (const [room, abbrev] of Object.entries(TECHNICAL_ABBREVIATIONS)) {
    if (normalize(room) === needle) return abbrev
  }
  for (const [room, abbrev] of Object.entries(TECHNICAL_ABBREVIATIONS)) {
    if (needle.includes(normalize(room))) return abbrev
  }
  return null
}

/** Suggests a free matrix label for a unit on one floor.
 *  Technical rooms resolve through the abbreviation dictionary; everything
 *  else (and unknown technical rooms) gets the category prefix plus the
 *  lowest number not already used on that floor. Comparison is
 *  case-insensitive, matching the form's uniqueness warning. */
export function suggestMatrixLabel(
  category: UnitCategory,
  name: string,
  existingLabelsOnFloor: string[]
): string {
  const taken = new Set(
    existingLabelsOnFloor.map((label) => normalize(label)).filter(Boolean)
  )

  if (category === "technical") {
    const abbrev = technicalAbbreviation(name)
    if (abbrev) {
      if (!taken.has(normalize(abbrev))) return abbrev
      // Dictionary hit already used on this floor: WĘZ, WĘZ2, WĘZ3, ...
      for (let n = 2; n < 1000; n++) {
        const candidate = `${abbrev}${n}`
        if (
          candidate.length <= MAX_MATRIX_LABEL_LENGTH &&
          !taken.has(normalize(candidate))
        ) {
          return candidate
        }
      }
      return abbrev
    }
  }

  const prefix = CATEGORY_PREFIXES[category]
  for (let n = 1; n < 1000; n++) {
    const candidate = `${prefix}${n}`
    if (
      candidate.length <= MAX_MATRIX_LABEL_LENGTH &&
      !taken.has(normalize(candidate))
    ) {
      return candidate
    }
  }
  return prefix
}
