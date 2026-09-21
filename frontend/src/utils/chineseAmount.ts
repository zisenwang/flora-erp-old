const DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']

/** Convert a 0-9999 integer to Chinese financial characters (no unit suffix). */
function convertSection(num: number): string {
  const places = [
    { value: 1000, unit: '仟' },
    { value: 100,  unit: '佰' },
    { value: 10,   unit: '拾' },
    { value: 1,    unit: '' },
  ]
  let result = ''
  let needZero = false
  let remaining = num
  for (const { value, unit } of places) {
    const digit = Math.floor(remaining / value)
    remaining %= value
    if (digit) {
      if (needZero) result += '零'
      result += DIGITS[digit] + unit
      needZero = false
    } else if (result) {
      needZero = true
    }
  }
  return result
}

/**
 * Convert a numeric amount to Chinese financial uppercase string.
 * e.g. 750 → "柒佰伍拾元整", 1234.56 → "壹仟贰佰叁拾肆元伍角陆分"
 */
export function toChineseAmount(amount: number): string {
  if (amount === 0) return '零元整'

  const rounded = Math.round(Math.abs(amount) * 100) / 100
  const intNum = Math.floor(rounded)
  const decNum = Math.round((rounded - intNum) * 100)
  const jiao = Math.floor(decNum / 10)
  const fen = decNum % 10

  // ── Integer part ──
  let intResult = ''
  if (intNum > 0) {
    const yi  = Math.floor(intNum / 100000000)
    const wan = Math.floor((intNum % 100000000) / 10000)
    const ge  = intNum % 10000

    let needZeroBeforeGe = false

    if (yi) {
      intResult += convertSection(yi) + '亿'
      needZeroBeforeGe = true
    }
    if (wan) {
      if (yi && wan < 1000) intResult += '零'
      intResult += convertSection(wan) + '万'
      needZeroBeforeGe = ge > 0 && ge < 1000
    } else if (yi && ge > 0) {
      // 亿 with no 万 section, but has ge
      needZeroBeforeGe = true
    }
    if (ge) {
      if (needZeroBeforeGe) intResult += '零'
      intResult += convertSection(ge)
    }
    intResult += '元'
  }

  // ── Decimal part ──
  let decResult = ''
  if (jiao === 0 && fen === 0) {
    decResult = '整'
  } else if (jiao === 0) {
    decResult = (intNum > 0 ? '零' : '') + DIGITS[fen] + '分'
  } else {
    decResult = DIGITS[jiao] + '角'
    decResult += fen > 0 ? DIGITS[fen] + '分' : '整'
  }

  if (intNum === 0) return decResult
  return intResult + decResult
}
