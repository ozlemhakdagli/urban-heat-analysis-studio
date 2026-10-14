// Turkish number formats: decimal comma, thousands dot.
const nf = (digits) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
export const fmt = (value, digits = 1) => (value === null || value === undefined || Number.isNaN(value) ? '–' : nf(digits).format(value))
export const signed = (value, digits = 1) => {
  if (value === null || value === undefined) return '–'
  const zero = Number(Math.abs(value).toFixed(digits)) === 0 // -0.001 is shown as 0,00 without a sign
  return `${zero ? '' : value > 0 ? '+' : '−'}${nf(digits).format(Math.abs(value))}`
}
export const pct = (share, digits = 1) => `%${fmt(share * 100, digits)}`
// one point of green share is 1% of the built-up area; that area is urban_km2 x 100 ha
export const pointsToHa = (points, urbanKm2) => points * urbanKm2
export const collator = new Intl.Collator('tr')

// A number typed by hand: accepts "1.500,5", "1500,5", "1500.5", "10.000" and the "−" the UI itself prints
export function parseAmount(text) {
  if (typeof text !== 'string') return NaN
  let t = text.trim().replace(/\s/g, '').replace(/−/g, '-') // U+2212 is the minus sign the UI prints
  if (t === '' || t === '-') return NaN
  if (t.includes(',')) {
    // Turkish style: the dot groups thousands, the comma is the decimal mark; a dot that is not a
    // three-digit group makes the whole input invalid (better a warning than a silent 10x error)
    if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(t)) return NaN
    t = t.replace(/\./g, '').replace(',', '.')
  } else if (/^[+-]?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) {
    // no comma and groups of exactly three digits: "10.000" means ten thousand, but "0.500" is a decimal fraction
    t = t.replace(/\./g, '')
  }
  return Number(t)
}

// Yellow -> orange -> red -> dark red for a risk score between 0 and 100
const STOPS = [[255, 255, 178], [254, 204, 92], [253, 141, 60], [240, 59, 32], [150, 0, 38]]
export function riskColor(score) {
  if (score === null || score === undefined) return '#d9d9d9'
  const x = Math.min(Math.max(score, 0), 100) / 100 * (STOPS.length - 1)
  const i = Math.min(Math.floor(x), STOPS.length - 2)
  const f = x - i
  const rgb = STOPS[i].map((c, k) => Math.round(c + (STOPS[i + 1][k] - c) * f))
  return `rgb(${rgb.join(',')})`
}
