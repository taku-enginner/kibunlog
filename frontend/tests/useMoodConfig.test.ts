import { describe, it, expect } from 'vitest'
import { moodConfig, moodOptions, moodEmoji, moodLabel, moodLevelColor, MOOD_THRESHOLDS } from '../composables/useMoodConfig'

describe('MOOD_THRESHOLDS', () => {
  it('should have correct threshold values', () => {
    expect(MOOD_THRESHOLDS.best).toBe(9)
    expect(MOOD_THRESHOLDS.good).toBe(7)
    expect(MOOD_THRESHOLDS.neutral).toBe(5)
    expect(MOOD_THRESHOLDS.bad).toBe(3)
  })
})

describe('moodConfig', () => {
  it('should have 10 entries (1-10)', () => {
    expect(Object.keys(moodConfig)).toHaveLength(10)
  })

  it('should have emoji, label, bg, color for each entry', () => {
    for (let i = 1; i <= 10; i++) {
      expect(moodConfig[i]).toHaveProperty('emoji')
      expect(moodConfig[i]).toHaveProperty('label')
      expect(moodConfig[i]).toHaveProperty('bg')
      expect(moodConfig[i]).toHaveProperty('color')
    }
  })

  it('level 10 and 9 should be 最高', () => {
    expect(moodConfig[10].label).toBe('最高')
    expect(moodConfig[9].label).toBe('最高')
  })

  it('level 1 and 2 should be しんどい', () => {
    expect(moodConfig[1].label).toBe('しんどい')
    expect(moodConfig[2].label).toBe('しんどい')
  })
})

describe('moodOptions', () => {
  it('should have 10 items in descending order', () => {
    expect(moodOptions).toHaveLength(10)
    expect(moodOptions[0].level).toBe(10)
    expect(moodOptions[9].level).toBe(1)
  })

  it('each item should include level and moodConfig fields', () => {
    for (const opt of moodOptions) {
      expect(opt).toHaveProperty('level')
      expect(opt).toHaveProperty('emoji')
      expect(opt).toHaveProperty('label')
      expect(opt).toHaveProperty('bg')
      expect(opt).toHaveProperty('color')
    }
  })
})

describe('moodEmoji', () => {
  it('should return 😆 for level 10 and 9', () => {
    expect(moodEmoji(10)).toBe('😆')
    expect(moodEmoji(9)).toBe('😆')
  })

  it('should return 😊 for level 8 and 7', () => {
    expect(moodEmoji(8)).toBe('😊')
    expect(moodEmoji(7)).toBe('😊')
  })

  it('should return 😐 for level 6 and 5', () => {
    expect(moodEmoji(6)).toBe('😐')
    expect(moodEmoji(5)).toBe('😐')
  })

  it('should return 😣 for level 4 and 3', () => {
    expect(moodEmoji(4)).toBe('😣')
    expect(moodEmoji(3)).toBe('😣')
  })

  it('should return 😵 for level 2 and 1', () => {
    expect(moodEmoji(2)).toBe('😵')
    expect(moodEmoji(1)).toBe('😵')
  })
})

describe('moodLabel', () => {
  it('should return 最高 for level >= 9', () => {
    expect(moodLabel(10)).toBe('最高')
    expect(moodLabel(9)).toBe('最高')
  })

  it('should return 良い for level 7-8', () => {
    expect(moodLabel(8)).toBe('良い')
    expect(moodLabel(7)).toBe('良い')
  })

  it('should return 普通 for level 5-6', () => {
    expect(moodLabel(6)).toBe('普通')
    expect(moodLabel(5)).toBe('普通')
  })

  it('should return いまいち for level 3-4', () => {
    expect(moodLabel(4)).toBe('いまいち')
    expect(moodLabel(3)).toBe('いまいち')
  })

  it('should return しんどい for level 1-2', () => {
    expect(moodLabel(2)).toBe('しんどい')
    expect(moodLabel(1)).toBe('しんどい')
  })
})

describe('moodLevelColor', () => {
  it('should return gray for null', () => {
    expect(moodLevelColor(null)).toBe('#ccc')
  })

  it('should return dark green for level >= 9', () => {
    expect(moodLevelColor(10)).toBe('#1b5e20')
    expect(moodLevelColor(9)).toBe('#1b5e20')
  })

  it('should return green for level 7-8', () => {
    expect(moodLevelColor(8)).toBe('#28a745')
    expect(moodLevelColor(7)).toBe('#28a745')
  })

  it('should return yellow for level 5-6', () => {
    expect(moodLevelColor(6)).toBe('#ffc107')
    expect(moodLevelColor(5)).toBe('#ffc107')
  })

  it('should return red for level 3-4', () => {
    expect(moodLevelColor(4)).toBe('#dc3545')
    expect(moodLevelColor(3)).toBe('#dc3545')
  })

  it('should return dark red for level 1-2', () => {
    expect(moodLevelColor(2)).toBe('#491217')
    expect(moodLevelColor(1)).toBe('#491217')
  })
})
