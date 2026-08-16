import { nodeDistanceKm, type MeshNode } from '@/lib/meshStore'

export const MAX_HOP_KM = 1.5

export interface RouteResult {
  path: string[]
  hopKm: number[]
  totalKm: number
}

export function findMeshRoute(nodes: MeshNode[], fromId: string, toId: string): RouteResult | null {
  const index = new Map(nodes.map((n) => [n.id, n]))
  const start = index.get(fromId)
  const goal = index.get(toId)
  if (!start || !goal) return null
  if (fromId === toId) return { path: [fromId], hopKm: [], totalKm: 0 }

  const dist = new Map<string, number>()
  const prev = new Map<string, string | null>()
  const visited = new Set<string>()
  for (const n of nodes) {
    dist.set(n.id, Infinity)
    prev.set(n.id, null)
  }
  dist.set(fromId, 0)

  for (;;) {
    let u: string | null = null
    let best = Infinity
    for (const n of nodes) {
      if (!visited.has(n.id)) {
        const d = dist.get(n.id)!
        if (d < best) {
          best = d
          u = n.id
        }
      }
    }
    if (u === null || u === toId) break
    visited.add(u)
    const a = index.get(u)!
    for (const n of nodes) {
      if (n.id === u || visited.has(n.id)) continue
      const km = nodeDistanceKm(a.lat, a.lng, n.lat, n.lng)
      if (km > MAX_HOP_KM) continue
      const alt = (dist.get(u) ?? Infinity) + km
      if (alt < (dist.get(n.id) ?? Infinity)) {
        dist.set(n.id, alt)
        prev.set(n.id, u)
      }
    }
  }

  if (dist.get(toId) === Infinity) return null
  const path: string[] = []
  let cur: string | null = toId
  while (cur !== null) {
    path.push(cur)
    cur = prev.get(cur) ?? null
  }
  path.reverse()
  const hopKm: number[] = []
  for (let i = 1; i < path.length; i++) {
    const a = index.get(path[i - 1])!
    const b = index.get(path[i])!
    hopKm.push(nodeDistanceKm(a.lat, a.lng, b.lat, b.lng))
  }
  return { path, hopKm, totalKm: hopKm.reduce((s, x) => s + x, 0) }
}
