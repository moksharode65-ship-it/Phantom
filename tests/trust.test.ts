import { describe, it, expect } from 'vitest'
import { computeTrust, verifiedFromScore, trustLabel, TRUST } from '../../emergency-services/server/shared/trust.js'

const now = Date.now()

describe('computeTrust', () => {
  it('starts at the base score for a clean verified caller', () => {
    expect(computeTrust({ score: 98, source: 'USER-MOB-01' })).toBe(98)
  })

  it('drops score for low battery', () => {
    const s = computeTrust({ score: 98, lowBattery: true, source: 'USER-MOB-01' })
    expect(s).toBe(98 - TRUST.PENALTIES.LOW_BATTERY)
    expect(verifiedFromScore(s)).toBe(true)
  })

  it('drops score for drill/test mode', () => {
    const s = computeTrust({ score: 98, testMode: true, source: 'USER-MOB-01' })
    expect(s).toBe(98 - TRUST.PENALTIES.TEST_MODE)
  })

  it('heavily penalizes an unknown source', () => {
    const s = computeTrust({ score: 98, source: 'unknown' })
    expect(s).toBe(98 - TRUST.PENALTIES.UNKNOWN_SOURCE)
    expect(verifiedFromScore(s)).toBe(false)
  })

  it('stacks penalties for battery + drill + unknown source', () => {
    const s = computeTrust({ score: 98, lowBattery: true, testMode: true, source: 'unknown' })
    expect(s).toBe(98 - TRUST.PENALTIES.LOW_BATTERY - TRUST.PENALTIES.TEST_MODE - TRUST.PENALTIES.UNKNOWN_SOURCE)
  })

  it('penalizes spam: 3+ alerts in the window', () => {
    const history = Array.from({ length: 3 }, () => ({ ts: now - 1000, resolved: true }))
    const s = computeTrust({ score: 98, source: 'USER-MOB-01', history })
    expect(s).toBe(98 - TRUST.PENALTIES.HISTORY_SPAM)
  })

  it('ignores old history outside the window', () => {
    const history = Array.from({ length: 5 }, () => ({ ts: now - TRUST.WINDOW_MS - 60000, resolved: false }))
    expect(computeTrust({ score: 98, source: 'USER-MOB-01', history })).toBe(98)
  })

  it('penalizes previous false alarms (resolved without dispatch)', () => {
    const history = [{ ts: now - 1000, resolved: false }]
    const s = computeTrust({ score: 98, source: 'USER-MOB-01', history })
    expect(s).toBe(98 - TRUST.PENALTIES.PREVIOUS_FALSE_ALARM)
  })

  it('does not penalize a source with only genuine emergencies', () => {
    const history = [{ ts: now - 1000, resolved: true }]
    expect(computeTrust({ score: 98, source: 'USER-MOB-01', history })).toBe(98)
  })

  it('never goes below 0 or above 100', () => {
    expect(computeTrust({ score: 98, lowBattery: true, testMode: true, source: 'unknown' })).toBeGreaterThanOrEqual(0)
    expect(computeTrust({ score: 200, source: 'X' })).toBe(100)
    expect(computeTrust({ score: 5, source: 'X' })).toBeGreaterThanOrEqual(0)
  })
})

describe('verifiedFromScore / trustLabel', () => {
  it('verifies at or above the threshold', () => {
    expect(verifiedFromScore(TRUST.VERIFIED_MIN)).toBe(true)
    expect(verifiedFromScore(TRUST.VERIFIED_MIN - 1)).toBe(false)
  })

  it('labels accordingly', () => {
    expect(trustLabel(80)).toBe('VERIFIED')
    expect(trustLabel(50)).toBe('UNVERIFIED')
  })
})
