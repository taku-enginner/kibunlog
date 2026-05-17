import { describe, it, expect } from 'vitest'
import { useDate } from '../composables/useDate'

describe('useDate', () => {
  const { formatWithDay, toLocalDateStr, getDateColor, getDayName, isHoliday, isSunday, isSaturday } = useDate()

  describe('formatWithDay', () => {
    it('should format date with day name', () => {
      // 2026-01-01 is Thursday
      const date = new Date(2026, 0, 1)
      expect(formatWithDay(date)).toBe('2026年1月1日（木）')
    })

    it('should format a Sunday', () => {
      // 2026-05-17 is Sunday
      const date = new Date(2026, 4, 17)
      expect(formatWithDay(date)).toBe('2026年5月17日（日）')
    })
  })

  describe('toLocalDateStr', () => {
    it('should return YYYY-MM-DD format', () => {
      const date = new Date(2026, 0, 5)
      expect(toLocalDateStr(date)).toBe('2026-01-05')
    })

    it('should zero-pad single digit month and day', () => {
      const date = new Date(2026, 2, 9)
      expect(toLocalDateStr(date)).toBe('2026-03-09')
    })
  })

  describe('getDateColor', () => {
    it('should return red for Sunday', () => {
      // 2026-05-17 is Sunday
      const date = new Date(2026, 4, 17)
      expect(getDateColor(date)).toBe('#dc3545')
    })

    it('should return blue for Saturday', () => {
      // 2026-05-16 is Saturday
      const date = new Date(2026, 4, 16)
      expect(getDateColor(date)).toBe('#007aff')
    })

    it('should return dark for weekday', () => {
      // 2026-05-18 is Monday
      const date = new Date(2026, 4, 18)
      expect(getDateColor(date)).toBe('#1d1d1f')
    })

    it('should return red for a holiday (New Year)', () => {
      // 2026-01-01 is a national holiday
      const date = new Date(2026, 0, 1)
      expect(getDateColor(date)).toBe('#dc3545')
    })
  })

  describe('getDayName', () => {
    it('should return correct day names', () => {
      expect(getDayName(new Date(2026, 4, 17))).toBe('日')
      expect(getDayName(new Date(2026, 4, 18))).toBe('月')
    })
  })
})
