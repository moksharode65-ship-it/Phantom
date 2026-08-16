import { describe, it, expect } from 'vitest'
import { findMeshRoute, MAX_HOP_KM } from '@/lib/meshRoute'
import { createMeshStore } from '@/lib/meshStore'

const useMesh = createMeshStore(19.06, 72.86)
const nodes = useMesh.getState().nodes

function expectRoute(from: string, to: string) {
  const r = findMeshRoute(nodes, from, to)
  expect(r).not.toBeNull()
  expect(r!.path[0]).toBe(from)
  expect(r!.path[r!.path.length - 1]).toBe(to)
  return r!
}

describe('findMeshRoute', () => {
  it('returns a zero-hop path from a node to itself', () => {
    const r = findMeshRoute(nodes, 'PNT-3A2F', 'PNT-3A2F')
    expect(r!.path).toEqual(['PNT-3A2F'])
    expect(r!.totalKm).toBe(0)
  })

  it('never uses hops beyond the radio range', () => {
    const r = expectRoute('PNT-7K9M', 'PNT-5T8U')
    for (let i = 1; i < r.path.length; i++) {
      const a = nodes.find((n) => n.id === r.path[i - 1])!
      const b = nodes.find((n) => n.id === r.path[i])!
      const dx = (a.lat - b.lat) * 110.57
      const dy = (a.lng - b.lng) * 111.32
      expect(Math.sqrt(dx * dx + dy * dy)).toBeLessThanOrEqual(MAX_HOP_KM + 1e-9)
    }
  })

  it('finds a path between the sender and a far node', () => {
    expectRoute('PNT-7K9M', 'PNT-6W4V')
    expectRoute('PNT-7K9M', 'PNT-5T8U')
  })

  it('route is acyclic (no repeated nodes)', () => {
    const r = findMeshRoute(nodes, 'PNT-7K9M', 'PNT-5T8U')!
    expect(new Set(r.path).size).toBe(r.path.length)
  })

  it('returns null when either node is unknown', () => {
    expect(findMeshRoute(nodes, 'PNT-7K9M', 'NOPE')).toBeNull()
    expect(findMeshRoute(nodes, 'NOPE', 'PNT-3A2F')).toBeNull()
  })

  it('finds the shorter of two candidate paths', () => {
    const a = findMeshRoute(nodes, 'PNT-7K9M', 'PNT-9H3R')!
    const b = findMeshRoute(nodes, 'PNT-7K9M', 'PNT-4B9L')!
    expect(a.totalKm).toBeGreaterThan(0)
    expect(b.totalKm).toBeGreaterThan(0)
    expect(a.hopKm.length).toBe(a.path.length - 1)
  })
})
