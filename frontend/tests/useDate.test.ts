import { describe, it, expect } from 'vitest'
import { useDate } from '../composables/useDate'

describe('useDate', () => {
  const { formatWithDay, toLocalDateStr, getDateColor, getDayName, isHoliday, isSunday, isSaturday } = useDate()

  describe('formatWithDay', () => {
    it('should format date with day name - Thursday', () => {
      const date = new Date(2026, 0, 1)
      expect(formatWithDay(date)).toBe('2026年1月1日（木）')
    })

    it('should format a Sunday', () => {
      const date = new Date(2026, 4, 17)
      expect(formatWithDay(date)).toBe('2026年5月17日（日）')
    })

    it('should format a Monday', () => {
      const date = new Date(2026, 4, 18)
      expect(formatWithDay(date)).toBe('2026年5月18日（月）')
    })

    it('should format a Saturday', () => {
      const date = new Date(2026, 4, 16)
      expect(formatWithDay(date)).toBe('2026年5月16日（土）')
    })

    it('should format a Wednesday', () => {
      const date = new Date(2026, 4, 20)
      expect(formatWithDay(date)).toBe('2026年5月20日（水）')
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

    it('should handle December', () => {
      const date = new Date(2026, 11, 31)
      expect(toLocalDateStr(date)).toBe('2026-12-31')
    })

    it('should handle double digit month and day', () => {
      const date = new Date(2026, 10, 25)
      expect(toLocalDateStr(date)).toBe('2026-11-25')
    })
  })

  describe('getDateColor', () => {
    it('should return red for Sunday', () => {
      const date = new Date(2026, 4, 17)
      expect(getDateColor(date)).toBe('#dc3545')
    })

    it('should return blue for Saturday', () => {
      const date = new Date(2026, 4, 16)
      expect(getDateColor(date)).toBe('#007aff')
    })

    it('should return dark for weekday', () => {
      const date = new Date(2026, 4, 18)
      expect(getDateColor(date)).toBe('#1d1d1f')
    })

    it('should return red for a holiday (New Year)', () => {
      const date = new Date(2026, 0, 1)
      expect(getDateColor(date)).toBe('#dc3545')
    })

    it('should return dark for a regular Friday', () => {
      const date = new Date(2026, 4, 15)
      expect(getDateColor(date)).toBe('#1d1d1f')
    })
  })

  describe('getDayName', () => {
    it('should return 日 for Sunday', () => {
      expect(getDayName(new Date(2026, 4, 17))).toBe('日')
    })

    it('should return 月 for Monday', () => {
      expect(getDayName(new Date(2026, 4, 18))).toBe('月')
    })

    it('should return 火 for Tuesday', () => {
      expect(getDayName(new Date(2026, 4, 19))).toBe('火')
    })

    it('should return 水 for Wednesday', () => {
      expect(getDayName(new Date(2026, 4, 20))).toBe('水')
    })

    it('should return 木 for Thursday', () => {
      expect(getDayName(new Date(2026, 4, 21))).toBe('木')
    })

    it('should return 金 for Friday', () => {
      expect(getDayName(new Date(2026, 4, 22))).toBe('金')
    })

    it('should return 土 for Saturday', () => {
      expect(getDayName(new Date(2026, 4, 16))).toBe('土')
    })
  })

  describe('isHoliday', () => {
    it('should return true for New Year', () => {
      expect(isHoliday(new Date(2026, 0, 1))).toBe(true)
    })

    it('should return false for a regular weekday', () => {
      expect(isHoliday(new Date(2026, 4, 18))).toBe(false)
    })
  })

  describe('isSunday', () => {
    it('should return true for Sunday', () => {
      expect(isSunday(new Date(2026, 4, 17))).toBe(true)
    })

    it('should return false for Monday', () => {
      expect(isSunday(new Date(2026, 4, 18))).toBe(false)
    })
  })

  describe('isSaturday', () => {
    it('should return true for Saturday', () => {
      expect(isSaturday(new Date(2026, 4, 16))).toBe(true)
    })

    it('should return false for Friday', () => {
      expect(isSaturday(new Date(2026, 4, 15))).toBe(false)
    })
  })
})
