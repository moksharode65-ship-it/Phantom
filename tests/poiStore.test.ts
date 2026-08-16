import { describe, it, expect } from 'vitest'
import { buildOverpassQuery } from '@/lib/poiStore'

describe('buildOverpassQuery', () => {
  it('scales the radius to meters', () => {
    const q = buildOverpassQuery(19.06, 72.86, 3)
    expect(q).toContain('around:3000,19.06,72.86')
  })

  it('queries police, hospital and fire stations', () => {
    const q = buildOverpassQuery(19.06, 72.86, 5)
    expect(q).toContain('node[amenity=police]')
    expect(q).toContain('node[amenity=hospital]')
    expect(q).toContain('node[amenity=fire_station]')
  })

  it('requests JSON output with a timeout', () => {
    const q = buildOverpassQuery(19.06, 72.86, 2)
    expect(q.startsWith('[out:json][timeout:25];')).toBe(true)
  })

  it('is URL-encodable without spaces', () => {
    const q = buildOverpassQuery(19.06, 72.86, 3)
    expect(decodeURIComponent(encodeURIComponent(q))).toBe(q)
  })
})
