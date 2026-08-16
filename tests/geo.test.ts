import { describe, it, expect } from 'vitest'
import { haversineKm, formatDistanceKm, nearestOfEachType } from '../../emergency-services/server/shared/geo.js'

describe('haversineKm', () => {
  it('is zero at the same point', () => {
    expect(haversineKm(19.06, 72.86, 19.06, 72.86)).toBe(0)
  })

  it('matches a known distance (Mumbai–Delhi ≈ 1150 km)', () => {
    const km = haversineKm(19.076, 72.8777, 28.6139, 77.209)
    expect(km).toBeGreaterThan(1100)
    expect(km).toBeLessThan(1250)
  })

  it('is symmetric', () => {
    const a = haversineKm(19.06, 72.86, 19.1, 72.9)
    const b = haversineKm(19.1, 72.9, 19.06, 72.86)
    expect(a).toBeCloseTo(b, 10)
  })

  it('is positive for distinct points', () => {
    expect(haversineKm(19.06, 72.86, 19.061, 72.861)).toBeGreaterThan(0)
  })
})

describe('formatDistanceKm', () => {
  it('formats meters below 1 km', () => {
    expect(formatDistanceKm(0.42)).toBe('420m')
  })
  it('formats kilometers above 1 km', () => {
    expect(formatDistanceKm(3.125)).toBe('3.1km')
  })
})

describe('nearestOfEachType', () => {
  const base = [
    { id: 'POL-1', type: 'POLICE', lat: 19.076, lng: 72.8777, status: 'ONLINE', capacity: 12, currentLoad: 0 },
    { id: 'POL-2', type: 'POLICE', lat: 19.2, lng: 73.0, status: 'ONLINE', capacity: 12, currentLoad: 0 },
    { id: 'HOS-1', type: 'HOSPITAL', lat: 19.1183, lng: 72.8998, status: 'ONLINE', capacity: 8, currentLoad: 0 },
    { id: 'FIR-1', type: 'FIRE', lat: 19.033, lng: 72.833, status: 'ONLINE', capacity: 10, currentLoad: 0 },
    { id: 'FIR-OFF', type: 'FIRE', lat: 19.033, lng: 72.833, status: 'OFFLINE', capacity: 10, currentLoad: 0 },
  ]

  it('picks the nearest instance of each type', () => {
    const r = nearestOfEachType(base, 19.076, 72.8777)
    expect(r.POLICE.id).toBe('POL-1')
    expect(r.HOSPITAL.id).toBe('HOS-1')
    expect(r.FIRE.id).toBe('FIR-1')
  })

  it('skips offline services', () => {
    const onlyOffline = [
      { id: 'FIR-OFF', type: 'FIRE', lat: 19.033, lng: 72.833, status: 'OFFLINE', capacity: 10, currentLoad: 0 },
      { id: 'POL-1', type: 'POLICE', lat: 19.076, lng: 72.8777, status: 'ONLINE', capacity: 12, currentLoad: 0 },
    ]
    const r = nearestOfEachType(onlyOffline, 19.033, 72.833)
    expect(r.FIRE).toBeUndefined()
    expect(r.POLICE.id).toBe('POL-1')
  })

  it('breaks near-ties by lower load', () => {
    const s = [
      { id: 'A', type: 'POLICE', lat: 19.0, lng: 72.8, status: 'ONLINE', capacity: 10, currentLoad: 9 },
      { id: 'B', type: 'POLICE', lat: 19.0001, lng: 72.8001, status: 'ONLINE', capacity: 10, currentLoad: 0 },
    ]
    const r = nearestOfEachType(s, 19.0, 72.8)
    expect(r.POLICE.id).toBe('B')
  })
})
