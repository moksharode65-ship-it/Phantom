'use client'

import { create, type UseBoundStore, type StoreApi, type StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'

export type ServiceType = 'POLICE' | 'HOSPITAL' | 'FIRE'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ConnState = 'CONNECTING' | 'ONLINE' | 'OFFLINE'
export type TrackingState = 'OFF' | 'REQUESTING' | 'ON' | 'DENIED'

export interface RegisteredService {
  id: string
  name: string
  type: ServiceType
  port: number
  lat: number
  lng: number
  capacity: number
  status: string
  currentLoad: number
  distanceKm?: number
  uptime?: number
}

export interface AckRecord {
  serviceId: string
  name: string
  type: ServiceType
  status: 'OPEN' | 'ACKED' | 'DISPATCHING' | 'RESOLVED' | 'ESCALATED' | 'DUPLICATE'
  etaMinutes?: number
  note?: string
  ts: number
}

export interface AlertRecord {
  incidentId: string
  severity: Severity
  message: string
  sentAt: number
  lat?: number
  lng?: number
  sourceId?: string
  acks: AckRecord[]
  duplicate?: boolean
  testMode?: boolean
  medical?: string
  lowBattery?: boolean
  verified?: boolean
  trustScore?: number
  reports?: number
  reporters?: string[]
  notes?: { from: string; text: string; ts: number }[]
  safety?: 'SAFE' | 'NEED_HELP' | null
  evidence?: { photo?: string; lat?: number; lng?: number; ts?: number }
  photos?: { id: string; from: string; role: string; photo: string; caption?: string; ts: number }[]
  nearestStation?: string
  distanceKm?: number
}

export interface ChatEntry {
  id?: string
  from: string
  text: string
  ts: number
  scope: ServiceType | 'ALL'
  incidentId?: string
}

export interface LogEntry {
  ts: number
  kind: string
  text: string
}

export interface Notice {
  id: string
  ts: number
  kind: ServiceType | 'SYSTEM'
  text: string
}

export interface OnlineDevice {
  nodeId: string
  name: string
  lat: number
  lng: number
  lastSeen: number
}

interface EmergencyState {
  conn: Record<ServiceType | 'REGISTRY', ConnState>
  services: RegisteredService[]
  devices: OnlineDevice[]
  nearest: Partial<Record<ServiceType, RegisteredService>>
  location: { lat: number; lng: number }
  tracking: TrackingState
  degraded: boolean
  standby: boolean
  blocked: ServiceType[]
  alerts: AlertRecord[]
  chat: ChatEntry[]
  log: LogEntry[]
  notices: Notice[]
  deferredMerge: Record<string, { reports?: number; reporters?: string[]; severity?: Severity; absorbFrom?: string[] }>
  setConn: (which: ServiceType | 'REGISTRY', state: ConnState) => void
  setTracking: (state: TrackingState) => void
  setDegraded: (on: boolean) => void
  setStandby: (on: boolean) => void
  toggleBlocked: (type: ServiceType) => void
  removeChat: (id?: string) => void
  clearChat: () => void
  clearAlerts: () => void
  setServices: (services: RegisteredService[]) => void
  setDevices: (devices: OnlineDevice[]) => void
  setNearest: (nearest: Partial<Record<ServiceType, RegisteredService>>) => void
  setLocation: (lat: number, lng: number) => void
  addAlert: (alert: AlertRecord) => void
  applyMerge: (incidentId: string, patch: { reports?: number; reporters?: string[]; severity?: Severity }) => void
  absorbMerged: (incidentId: string, mergedInto: string, patch: { reports?: number; reporters?: string[]; severity?: Severity }) => void
  updateAck: (incidentId: string, type: ServiceType, ack: Omit<AckRecord, 'type'>) => void
  markDuplicate: (incidentId: string) => void
  addChat: (entry: ChatEntry) => void
  addNote: (incidentId: string, note: { from: string; text: string; ts: number }) => void
  addPhoto: (incidentId: string, photo: { id: string; from: string; role: string; photo: string; caption?: string; ts: number }) => void
  markSafety: (incidentId: string, safe: boolean) => void
  cancelAlert: (incidentId: string) => void
  addLog: (kind: string, text: string) => void
  addNotice: (notice: Notice) => void
  dismissNotice: (id: string) => void
}

const DEFAULT_LOCATION = { lat: 19.06, lng: 72.86 }

export const SERVICE_META: Record<ServiceType, { label: string; color: string }> = {
  POLICE: { label: 'POLICE', color: '#0099ff' },
  HOSPITAL: { label: 'HOSPITAL', color: '#00d47e' },
  FIRE: { label: 'FIRE', color: '#EDB40B' },
}

export const SEVERITY_ORDER: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

const SEV_RANK: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }

// Same-scene SOS reports are consolidated by the server (service-core.js); clients reflect
// the consolidated reports/reporters via INCIDENT_MERGED / ALERT_DUPLICATE(mergedInto).

export type EmergencyStore = UseBoundStore<StoreApi<EmergencyState>>

export function createEmergencyStore(opts?: { defaultLocation?: { lat: number; lng: number }; persistKey?: string }) {
  const stateCreator: StateCreator<EmergencyState, [], [], EmergencyState> = (set) => ({
    conn: { REGISTRY: 'CONNECTING', POLICE: 'CONNECTING', HOSPITAL: 'CONNECTING', FIRE: 'CONNECTING' },
    services: [],
    devices: [],
    nearest: {},
    location: opts?.defaultLocation ?? DEFAULT_LOCATION,
    tracking: 'OFF',
    degraded: false,
    standby: false,
    blocked: [],
    alerts: [],
    chat: [],
    log: [],
    notices: [],
    deferredMerge: {},
    setConn: (which, state) => set((s) => ({ conn: { ...s.conn, [which]: state } })),
    setTracking: (state) => set({ tracking: state }),
    setDegraded: (on) => set({ degraded: on }),
    setStandby: (on) => set({ standby: on }),
    setServices: (services) => set({ services }),
    setDevices: (devices) => set({ devices }),
    setNearest: (nearest) => set({ nearest }),
    setLocation: (lat, lng) => set({ location: { lat, lng } }),
    addAlert: (alert) =>
      set((s) => {
        let incoming = { ...alert, reports: alert.reports ?? 1, reporters: alert.reporters ?? (alert.sourceId ? [alert.sourceId] : []) }
        const deferred = s.deferredMerge[incoming.incidentId]
        let absorbFrom: string[] = []
        if (deferred) {
          absorbFrom = deferred.absorbFrom ?? []
          incoming = {
            ...incoming,
            reports: Math.max(deferred.reports ?? incoming.reports, incoming.reports),
            reporters: Array.from(new Set([...(deferred.reporters ?? []), ...(incoming.reporters ?? [])])),
            severity: (deferred.severity && SEV_RANK[deferred.severity] > SEV_RANK[incoming.severity] ? deferred.severity : incoming.severity) as Severity,
          }
        }
        const defs = { ...s.deferredMerge }
        delete defs[incoming.incidentId]
        absorbFrom.forEach((id) => delete defs[id])
        return { deferredMerge: defs, alerts: [incoming, ...s.alerts.filter((a) => !absorbFrom.includes(a.incidentId))].slice(0, 12) }
      }),
    applyMerge: (incidentId, patch) =>
      set((s) => {
        if (!s.alerts.some((a) => a.incidentId === incidentId)) {
          const prev = s.deferredMerge[incidentId]
          return { deferredMerge: { ...s.deferredMerge, [incidentId]: { ...prev, ...patch } } }
        }
        return {
          alerts: s.alerts.map((a) =>
            a.incidentId !== incidentId
              ? a
              : {
                  ...a,
                  reports: Math.max(patch.reports ?? a.reports ?? 1, a.reports ?? 1),
                  reporters: Array.from(new Set([...(patch.reporters ?? []), ...(a.reporters ?? [])])),
                  severity: patch.severity && SEV_RANK[patch.severity] > SEV_RANK[a.severity] ? patch.severity : a.severity,
                }
          ),
        }
      }),
    absorbMerged: (incidentId, mergedInto, patch) =>
      set((s) => {
        const rest = s.alerts.filter((a) => a.incidentId !== incidentId)
        if (!rest.some((a) => a.incidentId === mergedInto)) {
          const prev = s.deferredMerge[mergedInto]
          return {
            deferredMerge: {
              ...s.deferredMerge,
              [mergedInto]: {
                ...prev,
                ...patch,
                absorbFrom: Array.from(new Set([...(prev?.absorbFrom ?? []), incidentId])),
              },
            },
            alerts: rest,
          }
        }
        return {
          alerts: rest.map((a) =>
            a.incidentId !== mergedInto
              ? a
              : {
                  ...a,
                  reports: Math.max(patch.reports ?? a.reports ?? 1, a.reports ?? 1),
                  reporters: Array.from(new Set([...(patch.reporters ?? []), ...(a.reporters ?? [])])),
                  severity: patch.severity && SEV_RANK[patch.severity] > SEV_RANK[a.severity] ? patch.severity : a.severity,
                }
          ),
        }
      }),
    updateAck: (incidentId, type, ack) =>
      set((s) => {
        if (!s.alerts.some((a) => a.incidentId === incidentId)) return s
        return {
          alerts: s.alerts.map((a) => {
            if (a.incidentId !== incidentId) return a
            const others = a.acks.filter((k) => k.type !== type)
            return { ...a, acks: [...others, { ...ack, type }] }
          }),
        }
      }),
    markDuplicate: (incidentId) =>
      set((s) => {
        if (!s.alerts.some((a) => a.incidentId === incidentId)) return s
        return {
          alerts: s.alerts.map((a) => (a.incidentId === incidentId ? { ...a, duplicate: true } : a)),
        }
      }),
    addChat: (entry) => set((s) => ({
      chat: [...s.chat, entry.id ? entry : { ...entry, id: `C-${entry.ts}-${Math.random().toString(36).slice(2, 8)}` }].slice(-40),
    })),
    addNote: (incidentId, note) =>
      set((s) => ({
        alerts: s.alerts.map((a) => {
          if (a.incidentId !== incidentId) return a
          const existing = (a.notes ?? []).some((n) => n.from === note.from && n.text === note.text && Math.abs(n.ts - note.ts) < 1500)
          if (existing) return a
          return { ...a, notes: [...(a.notes ?? []), note].slice(-30) }
        }),
      })),
    addPhoto: (incidentId, photo) =>
      set((s) => ({
        alerts: s.alerts.map((a) => {
          if (a.incidentId !== incidentId) return a
          if ((a.photos ?? []).some((p) => p.id === photo.id)) return a
          return { ...a, photos: [...(a.photos ?? []), photo].slice(-40) }
        }),
      })),
    markSafety: (incidentId, safe) =>
      set((s) => ({
        alerts: s.alerts.map((a) => (a.incidentId === incidentId ? { ...a, safety: safe ? 'SAFE' : 'NEED_HELP' } : a)),
      })),
    cancelAlert: (incidentId) =>
      set((s) => ({
        alerts: s.alerts.map((a) =>
          a.incidentId !== incidentId
            ? a
            : {
                ...a,
                safety: 'SAFE',
                acks: a.acks.map((k) => ({ ...k, status: 'RESOLVED' as const, note: 'cancelled by caller — false alarm', ts: Date.now() })),
              }
        ),
      })),
    addNotice: (notice) => set((s) => ({ notices: [notice, ...s.notices].slice(0, 8) })),
    dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
    toggleBlocked: (type) => set((s) => ({
      blocked: s.blocked.includes(type) ? s.blocked.filter((t) => t !== type) : [...s.blocked, type],
    })),
    removeChat: (id) => set((s) => (id ? { chat: s.chat.filter((c) => c.id !== id) } : s)),
    clearChat: () => set({ chat: [] }),
    clearAlerts: () => set({ alerts: [] }),
    addLog: (kind, text) => set((s) => ({ log: [{ ts: Date.now(), kind, text }, ...s.log].slice(0, 40) })),
  })

  if (!opts?.persistKey) return create<EmergencyState>()(stateCreator)
  return create<EmergencyState>()(
    persist(stateCreator, {
      name: opts.persistKey,
      partialize: (s) => ({ alerts: s.alerts, chat: s.chat, log: s.log, blocked: s.blocked, location: s.location, tracking: s.tracking, standby: s.standby }),
    })
  )
}

export const useEmergencyStore = createEmergencyStore({ persistKey: 'pantom-phone' })