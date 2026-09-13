import { describe, it, expect } from 'vitest'

/**
 * Score calculation utilities — extracted from ExamResult logic.
 * These are pure functions that can be tested independently.
 */

function calculateCttScore(correctCount: number, totalQuestions: number): number {
  if (totalQuestions === 0) return 0
  return correctCount
}

function calculateIrtScaledScore(rawScore: number, maxRaw: number, maxScaled: number = 300): number {
  if (maxRaw === 0) return 0
  return Math.round((rawScore / maxRaw) * maxScaled * 10) / 10
}

function calculateTotalScore(parts: (number | null)[]): number | null {
  const validParts = parts.filter((p): p is number => p !== null)
  if (validParts.length === 0) return null
  return validParts.reduce((sum, p) => sum + p, 0)
}

function getPartLabel(part: number): string {
  const labels: Record<number, string> = {
    1: 'Tiếng Việt',
    2: 'Tiếng Anh',
    3: 'Toán học',
    4: 'Tư duy khoa học',
  }
  return labels[part] || 'Không xác định'
}

describe('Score Calculation Utilities', () => {
  describe('calculateCttScore', () => {
    it('returns correct count as raw score', () => {
      expect(calculateCttScore(10, 30)).toBe(10)
    })

    it('returns 0 when no correct answers', () => {
      expect(calculateCttScore(0, 30)).toBe(0)
    })

    it('returns 0 when total is 0', () => {
      expect(calculateCttScore(5, 0)).toBe(0)
    })
  })

  describe('calculateIrtScaledScore', () => {
    it('scales 0 to 0', () => {
      expect(calculateIrtScaledScore(0, 30)).toBe(0)
    })

    it('scales max raw to max scaled', () => {
      expect(calculateIrtScaledScore(30, 30, 300)).toBe(300)
    })

    it('scales half raw to half scaled', () => {
      expect(calculateIrtScaledScore(15, 30, 300)).toBe(150)
    })

    it('handles decimal precision', () => {
      const result = calculateIrtScaledScore(10, 30, 300)
      expect(result).toBe(100)
    })

    it('returns 0 when maxRaw is 0', () => {
      expect(calculateIrtScaledScore(5, 0)).toBe(0)
    })
  })

  describe('calculateTotalScore', () => {
    it('sums all parts', () => {
      expect(calculateTotalScore([100, 200, 150, 180])).toBe(630)
    })

    it('ignores null parts', () => {
      expect(calculateTotalScore([100, null, 150, null])).toBe(250)
    })

    it('returns null when all parts are null', () => {
      expect(calculateTotalScore([null, null, null, null])).toBeNull()
    })

    it('returns single part value', () => {
      expect(calculateTotalScore([null, null, 200, null])).toBe(200)
    })
  })

  describe('getPartLabel', () => {
    it('returns correct labels for each part', () => {
      expect(getPartLabel(1)).toBe('Tiếng Việt')
      expect(getPartLabel(2)).toBe('Tiếng Anh')
      expect(getPartLabel(3)).toBe('Toán học')
      expect(getPartLabel(4)).toBe('Tư duy khoa học')
    })

    it('returns fallback for unknown part', () => {
      expect(getPartLabel(5)).toBe('Không xác định')
      expect(getPartLabel(0)).toBe('Không xác định')
    })
  })
})
