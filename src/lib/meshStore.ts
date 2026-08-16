import { create } from 'zustand'

export type NodeStatus = 'NORMAL' | 'EMERGENCY'

export interface MeshNode {
  id: string
  lat: number
  lng: number
  status: NodeStatus
  incidentId?: string
}

export const SENDER_NODE_ID = 'PNT-7K9M'

export const DEVICE_B_NODE_ID = 'PNT-2B8D'

export const MESH_RANGE_KM = 2.5

const SEED: [string, number, number][] = [
  ['PNT-3A2F', 0.01, 0.006],
  ['PNT-8K1M', -0.008, 0.01],
  ['PNT-4B9L', 0.006, -0.009],
  ['PNT-1Z6Q', -0.011, -0.005],
  ['PNT-9H3R', 0.014, 0.013],
  ['PNT-2E7Y', -0.013, 0.012],
  ['PNT-6W4V', 0.017, -0.01],
  ['PNT-5T8U', -0.018, -0.013],
]

export function createMeshStore(
  senderLat = 19.06,
  senderLng = 72.86,
  senderId = SENDER_NODE_ID,
  extra: [string, number, number][] = [['PNT-2B8D', 0.005, 0.005]],
  opts?: { seeded?: boolean },
) {
  const nodes: MeshNode[] = [
    { id: senderId, lat: senderLat, lng: senderLng, status: 'NORMAL' },
    ...extra.map(([id, dLat, dLng]) => ({ id, lat: senderLat + dLat, lng: senderLng + dLng, status: 'NORMAL' as NodeStatus })),
    ...(opts?.seeded === false ? [] : SEED.map(([id, dLat, dLng]) => ({ id, lat: senderLat + dLat, lng: senderLng + dLng, status: 'NORMAL' as NodeStatus }))),
  ]

  return create<{
    nodes: MeshNode[]
    setNodeEmergency: (id: string, incidentId: string) => void
    resolveNodeEmergency: (id: string) => void
    resolveByIncident: (incidentId: string) => void
    addNode: (lat: number, lng: number) => MeshNode
    upsertNode: (node: { id: string; lat: number; lng: number; status?: NodeStatus; incidentId?: string }) => void
  }>()((set) => ({
    nodes,
    setNodeEmergency: (id, incidentId) =>
      set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, status: 'EMERGENCY', incidentId } : n)) })),
    resolveNodeEmergency: (id) =>
      set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, status: 'NORMAL', incidentId: undefined } : n)) })),
    resolveByIncident: (incidentId) =>
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.incidentId === incidentId ? { ...n, status: 'NORMAL' as NodeStatus, incidentId: undefined } : n
        ),
      })),
    addNode: (lat, lng) => {
      const id = `PNT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      const node: MeshNode = { id, lat, lng, status: 'NORMAL' }
      set((s) => ({ nodes: [...s.nodes, node] }))
      return node
    },
    upsertNode: (node) =>
      set((s) => {
        const existing = s.nodes.find((n) => n.id === node.id)
        if (existing) return { nodes: s.nodes.map((n) => (n.id === node.id ? { ...n, lat: node.lat, lng: node.lng } : n)) }
        return { nodes: [...s.nodes, { ...node, status: node.status || 'NORMAL' }] }
      }),
  }))
}

export function nodeDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  return Math.sqrt((lat2 - lat1) ** 2 * 110.57 ** 2 + (lng2 - lng1) ** 2 * (111.32 * Math.cos((lat1 * Math.PI) / 180)) ** 2)
}

export function nodeHops(km: number) {
  return Math.max(1, Math.round(km / 1.1))
}

export const useMeshStore = createMeshStore()

export type MeshStore = ReturnType<typeof createMeshStore>

type BusMessage = { id: string; from: string; to: string; content: string; priority: string; route: string[]; timestamp: number }

const busListeners = new Set<(msg: BusMessage) => void>()

export const meshMessageBus = {
  publish(msg: BusMessage) {
    busListeners.forEach((fn) => fn(msg))
  },
  subscribe(fn: (msg: BusMessage) => void) {
    busListeners.add(fn)
    return () => {
      busListeners.delete(fn)
    }
  },
}
