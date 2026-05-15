import holiday_jp from '@holiday-jp/holiday_jp'

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

export function useDate() {
  function getDayName(date: Date): string {
    return DAY_NAMES[date.getDay()]
  }

  function isHoliday(date: Date): boolean {
    return holiday_jp.isHoliday(date)
  }

  function isSunday(date: Date): boolean {
    return date.getDay() === 0
  }

  function isSaturday(date: Date): boolean {
    return date.getDay() === 6
  }

  function getDateColor(date: Date): string {
    if (isHoliday(date) || isSunday(date)) return '#dc3545'
    if (isSaturday(date)) return '#007aff'
    return '#1d1d1f'
  }

  function formatWithDay(date: Date): string {
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    const d = date.getDate()
    const day = getDayName(date)
    return `${y}年${m}月${d}日（${day}）`
  }

  function toLocalDateStr(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return { getDayName, isHoliday, isSunday, isSaturday, getDateColor, formatWithDay, toLocalDateStr }
}
