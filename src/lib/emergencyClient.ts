'use client'

import { useEmergencyStore, SERVICE_META, type EmergencyStore, type ServiceType, type Severity, type RegisteredService } from '@/lib/emergencyStore'
import { useMeshStore } from '@/lib/meshStore'

// Endpoint config: set VITE_WS_URL to the deployed backend gateway (e.g. https://app.up.railway.app)
// and the client reaches /registry, /police, /hospital, /fire through the single port.
const WS_BASE = (import.meta.env.VITE_WS_URL as string | undefined)?.trim().replace(/\/+$/, '')
const REGISTRY_URL = WS_BASE ? `${WS_BASE}/registry` : 'ws://localhost:5000'
const SERVICE_URLS: Record<ServiceType, string> = {
  POLICE: WS_BASE ? `${WS_BASE}/police` : 'ws://localhost:5001',
  HOSPITAL: WS_BASE ? `${WS_BASE}/hospital` : 'ws://localhost:5002',
  FIRE: WS_BASE ? `${WS_BASE}/fire` : 'ws://localhost:5003',
}
const RECONNECT_BASE_MS = 1500

export type IncidentBusEvent =
  | { type: 'ALERT_ACK'; svc: ServiceType; serviceId: string; name: string; incidentId: string; etaMinutes?: number }
  | { type: 'DISPATCH_UPDATE'; svc: ServiceType; serviceId: string; name: string; incidentId: string; status: 'DISPATCHING' | 'RESOLVED'; note?: string }
  | { type: 'CHAT'; from: string; text: string; scope: ServiceType | 'ALL' }
  | { type: 'INCIDENT_CHAT'; incidentId: string; from: string; text: string; scope: ServiceType | 'ALL' }
  | { type: 'ALERT_CANCEL'; incidentId: string; source: string }
  | { type: 'INCIDENT_NOTE'; incidentId: string; from: string; text: string }
  | { type: 'INCIDENT_PHOTO'; incidentId: string; from: string; role: string; caption?: string }
  | { type: 'SAFETY_UPDATE'; incidentId: string; safe: boolean }

const incidentListeners = new Set<(e: IncidentBusEvent) => void>()

export const incidentBus = {
  publish(e: IncidentBusEvent) {
    incidentListeners.forEach((fn) => fn(e))
  },
  subscribe(fn: (e: IncidentBusEvent) => void) {
    incidentListeners.add(fn)
    return () => {
      incidentListeners.delete(fn)
    }
  },
}


const TYPES: ServiceType[] = ['POLICE', 'HOSPITAL', 'FIRE']

const TRUST_BASE = 98
const TRUST_PENALTY_LOW_BATTERY = 8
const TRUST_PENALTY_TEST = 10
const TRUST_VERIFIED_MIN = 70

// Fallback "scene snapshot" used when a live camera frame isn't available (demo/offline).
function simulateSceneSnapshot(opts: { severity: Severity; deviceName: string; lat: number; lng: number }): string {
  const c = document.createElement('canvas')
  c.width = 320
  c.height = 200
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const sevColor: Record<Severity, string> = { CRITICAL: '#DC2626', HIGH: '#F97316', MEDIUM: '#F59E0B', LOW: '#22C55E' }
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  ctx.fillStyle = '#0a0e1c'
  ctx.fillRect(0, 0, 320, 200)
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1
  for (let i = 0; i <= 320; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 200); ctx.stroke() }
  for (let i = 0; i <= 200; i += 32) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(320, i); ctx.stroke() }
  const g = ctx.createRadialGradient(160, 100, 10, 160, 100, 130)
  g.addColorStop(0, sevColor[opts.severity] + '66')
  g.addColorStop(1, sevColor[opts.severity] + '00')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 320, 200)
  ctx.fillStyle = '#0a0e1c'
  ctx.fillRect(70, 70, 180, 60)
  ctx.strokeStyle = sevColor[opts.severity]
  ctx.lineWidth = 2
  ctx.strokeRect(70, 70, 180, 60)
  ctx.fillStyle = sevColor[opts.severity]
  ctx.font = 'bold 22px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('SOS', 160, 97)
  ctx.font = '10px monospace'
  ctx.fillStyle = '#f0f2f5'
  ctx.fillText(opts.severity, 160, 118)
  ctx.font = '9px monospace'
  ctx.fillStyle = '#8b909e'
  ctx.textAlign = 'left'
  ctx.fillText(`${opts.deviceName} · ${opts.lat.toFixed(4)}, ${opts.lng.toFixed(4)}`, 8, 188)
  ctx.textAlign = 'right'
  ctx.fillText(t, 312, 188)
  ctx.font = 'bold 8px monospace'
  ctx.fillStyle = sevColor[opts.severity]
  ctx.fillText('EVIDENCE SNAPSHOT', 312, 10)
  return c.toDataURL('image/jpeg', 0.8)
}

async function capturePhotoFrame(opts: { cameraAllowed: boolean; deviceName: string; severity: Severity; lat: number; lng: number }): Promise<string> {
  const snapshot = () => simulateSceneSnapshot({ severity: opts.severity, deviceName: opts.deviceName, lat: opts.lat, lng: opts.lng })
  if (!opts.cameraAllowed) return snapshot()
  try {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return snapshot()
    const stream = await Promise.race([
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 200 }, audio: false }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('camera timeout')), 4000)),
    ])
    try {
      const video = document.createElement('video')
      video.srcObject = stream
      await new Promise<void>((res) => { video.onloadedmetadata = () => res() })
      await video.play()
      await new Promise((r) => setTimeout(r, 300))
      const c = document.createElement('canvas')
      c.width = 320
      c.height = 200
      c.getContext('2d')?.drawImage(video, 0, 0, 320, 200)
      return c.toDataURL('image/jpeg', 0.7)
    } finally {
      stream.getTracks().forEach((t) => t.stop())
    }
  } catch {
    return snapshot()
  }
}

function trustFor(opts?: { lowBattery?: boolean; testMode?: boolean }) {
  let score = TRUST_BASE
  if (opts?.lowBattery) score -= TRUST_PENALTY_LOW_BATTERY
  if (opts?.testMode) score -= TRUST_PENALTY_TEST
  return { trustScore: score, verified: score >= TRUST_VERIFIED_MIN }
}

const CROSS_LINKS: Record<ServiceType, { keywords: RegExp; to: ServiceType }[]> = {
  HOSPITAL: [
    { keywords: /fire|burn|smoke|blaze|explosion|blast/, to: 'FIRE' },
    { keywords: /assault|stolen|threat|gun|knife|attack/, to: 'POLICE' },
  ],
  POLICE: [
    { keywords: /fire|burn|smoke|blaze|explosion|blast/, to: 'FIRE' },
  ],
  FIRE: [
    { keywords: /assault|threat|gun|knife|stolen|attack/, to: 'POLICE' },
  ],
}

// Geo-aware routing: for each service type, pick the NEAREST registered station to the
// emergency location so the alert lands with the closest POLICE / HOSPITAL / FIRE unit.
function nearestStationOfType(services: RegisteredService[], type: ServiceType, lat: number, lng: number): { station: RegisteredService | undefined; km: number } {
  const ofType = services.filter((s) => s.type === type && Number.isFinite(s.lat) && Number.isFinite(s.lng))
  if (!ofType.length) return { station: undefined, km: Infinity }
  const d2 = (svc: RegisteredService) => {
    const dLat = (svc.lat - lat) * 110.574
    const dLng = (svc.lng - lng) * 111.32 * Math.cos((lat * Math.PI) / 180)
    return dLat * dLat + dLng * dLng
  }
  const station = ofType.reduce((a, b) => (d2(b) < d2(a) ? b : a))
  return { station, km: Math.sqrt(d2(station)) }
}

const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`)

export interface AlertOptions {
  medical?: string
  lowBattery?: boolean
  testMode?: boolean
  photo?: string
}

export interface EmergencyClientOptions {
  senderName?: string
  sourceId?: string
}

const liveClients = new Set<EmergencyClientManager>()

export function setAllLinked(v: boolean) {
  liveClients.forEach((c) => c.setLinked(v))
}

class EmergencyClientManager {
  private registryWs: WebSocket | null = null
  private serviceWs: Partial<Record<ServiceType, WebSocket>> = {}
  private retries: Record<string, number> = {}
  private disposed = false
  private started = false
  private queue: { key: string; payload: unknown }[] = []
  private trackWatcher: number | null = null
  private trackUnsub: (() => void) | null = null
  private replaying = false
  readonly store: EmergencyStore
  private readonly options: Required<EmergencyClientOptions>

  constructor(store: EmergencyStore, options: EmergencyClientOptions = {}) {
    this.store = store
    this.options = { senderName: 'YOU', sourceId: 'USER-MOB-01', ...options }
    liveClients.add(this)
  }

  start() {
    if (this.started) return
    this.started = true
    this.disposed = false

    this.connect('REGISTRY', REGISTRY_URL, (m: any) => this.onRegistryMessage(m), true)
    TYPES.forEach((t) => {
      this.connect(t, SERVICE_URLS[t], (m: any) => this.onServiceMessage(t, m), false)
    })
  }

  stop() {
    this.disposed = true
    this.started = false
    this.registryWs?.close()
    TYPES.forEach((t) => this.serviceWs[t]?.close())
    this.registryWs = null
    this.serviceWs = {}
  }

  private isCurrent(key: string, ws: WebSocket, isRegistry: boolean) {
    return (isRegistry ? this.registryWs : this.serviceWs[key as ServiceType]) === ws
  }

  private connect(key: string, url: string, onMessage: (m: any) => void, isRegistry: boolean) {
    if (this.disposed) return
    this.store.getState().setConn(key as any, 'CONNECTING')
    const retryCount = this.retries[key] || 0
    const delay = Math.min(15000, RECONNECT_BASE_MS * 2 ** retryCount)

    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      setTimeout(() => this.connect(key, url, onMessage, isRegistry), delay)
      return
    }

    if (isRegistry) this.registryWs = ws
    else this.serviceWs[key as ServiceType] = ws

    ws.onopen = () => {
      if (!this.isCurrent(key, ws, isRegistry)) return
      this.retries[key] = 0
      this.store.getState().setConn(key as any, 'ONLINE')
      this.flushQueue()
      if (isRegistry) {
        const { location } = this.store.getState()
        this.registryWs?.send(JSON.stringify({ type: 'NEAREST', payload: { lat: location.lat, lng: location.lng } }))
        this.store.getState().addLog('REGISTRY', 'Connected to central registry :5000')
      }
    }
    ws.onmessage = (e) => {
      if (!this.isCurrent(key, ws, isRegistry)) return
      try {
        const m = JSON.parse(e.data)
        if (this.store.getState().degraded) {
          setTimeout(() => {
            if (this.isCurrent(key, ws, isRegistry)) onMessage(m)
          }, 800 + Math.random() * 1200)
        } else {
          onMessage(m)
        }
      } catch { /* ignore malformed */ }
    }
    ws.onerror = () => ws.close()
    ws.onclose = () => {
      if (!this.isCurrent(key, ws, isRegistry)) return
      this.store.getState().setConn(key as any, 'OFFLINE')
      if (this.disposed) return
      this.retries[key] = (this.retries[key] || 0) + 1
      setTimeout(() => this.connect(key, url, onMessage, isRegistry), delay)
    }
  }

  private sendTo(key: string, payload: unknown): boolean {
    const ws = key === 'REGISTRY' ? this.registryWs : this.serviceWs[key as ServiceType]
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (this.store.getState().degraded && Math.random() < 0.18) {
        this.queue.push({ key, payload })
        setTimeout(() => this.flushQueue(), 900 + Math.random() * 1400)
        return false
      }
      ws.send(JSON.stringify(payload))
      return true
    }
    this.queue.push({ key, payload })
    return false
  }

  private flushQueue() {
    const remaining: { key: string; payload: unknown }[] = []
    for (const item of this.queue) {
      const ws = item.key === 'REGISTRY' ? this.registryWs : this.serviceWs[item.key as ServiceType]
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(item.payload))
      else remaining.push(item)
    }
    this.queue = remaining
  }

  private restFallback(type: ServiceType, payload: unknown) {
    let url: string
    if (WS_BASE) {
      const httpBase = WS_BASE.startsWith('wss://') ? `https://${WS_BASE.slice(6)}` : `http://${WS_BASE.slice(5)}`
      url = `${httpBase}/${type.toLowerCase()}/api/actions`
    } else {
      url = `http://localhost:${5001 + TYPES.indexOf(type)}/api/actions`
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }

  private stationName(type: ServiceType): string {
    return this.store.getState().services.find((s) => s.type === type)?.name || type
  }

  private onRegistryMessage(m: any) {
    const s = this.store.getState()
    if (m.type === 'SERVICES') {
      s.setServices(m.payload.services)
    }
    if (m.type === 'NEAREST_RESULT') {
      const nearest: Partial<Record<ServiceType, RegisteredService>> = {}
      for (const [type, svc] of Object.entries(m.payload.nearest || {})) {
        if (svc) nearest[type as ServiceType] = svc as RegisteredService
      }
      s.setNearest(nearest)
    }
    if (m.type === 'LOG') {
      if (['REGISTER', 'RE_REGISTER', 'OFFLINE', 'DEREGISTER'].includes(m.payload.kind)) {
        s.addLog('REGISTRY', `[${m.payload.kind}] ${m.payload.name || m.payload.id || ''}`.trim())
      }
    }
  }

  private onServiceMessage(type: ServiceType, m: any) {
    const s = this.store.getState()
    if (m.type === 'ALERT_ACK') {
      s.updateAck(m.payload.incidentId, type, {
        serviceId: m.payload.service?.id || type,
        name: m.payload.service?.name || type,
        status: 'ACKED',
        etaMinutes: m.payload.etaMinutes,
        ts: Date.now(),
      })
      s.addLog(type, `${m.payload.incidentId} acknowledged · ETA ${m.payload.etaMinutes} min`)
      if (s.alerts.some((a) => a.incidentId === m.payload.incidentId)) {
        s.addNotice({ id: `${type}-ack-${Date.now()}`, ts: Date.now(), kind: type, text: `GOT YOUR ORDER — ACKNOWLEDGED, ETA ${m.payload.etaMinutes ?? '—'} min` })
      }
    }
    if (m.type === 'DISPATCH_UPDATE') {
      const status = m.payload.status === 'RESOLVED' ? 'RESOLVED' : 'DISPATCHING'
      s.updateAck(m.payload.incidentId, type, {
        serviceId: m.payload.service?.id || type,
        name: m.payload.service?.name || type,
        status,
        note: m.payload.note,
        ts: Date.now(),
      })
      s.addLog(type, `${m.payload.incidentId} ${status}${m.payload.note ? ' · ' + m.payload.note : ''}`)
      if (s.alerts.some((a) => a.incidentId === m.payload.incidentId)) {
        s.addNotice({
          id: `${type}-${status}-${Date.now()}`,
          ts: Date.now(),
          kind: type,
          text: status === 'RESOLVED' ? 'MARKED RESOLVED — emergency closed, you are safe' : 'DISPATCHED — GOT YOUR ORDER, unit en route',
        })
      }
      if (status === 'RESOLVED') useMeshStore.getState().resolveByIncident(m.payload.incidentId)
    }
    if (m.type === 'ALERT_DUPLICATE') {
      const p = m.payload
      if (p.mergedInto) {
        s.absorbMerged(p.incidentId, p.mergedInto, { reports: p.reports, reporters: p.reporters, severity: p.severity })
        s.addLog(type, `${p.incidentId} merged into ${p.mergedInto} (${p.reports ?? 1} reporters)`)
        s.addNotice({
          id: `dup-${Date.now()}`,
          ts: Date.now(),
          kind: type,
          text: `SAME INCIDENT REPORTED ${p.reports ?? 2} TIMES — folded into one case`,
        })
      } else {
        s.markDuplicate(p.incidentId)
        s.addLog(type, `${p.incidentId} duplicate suppressed`)
      }
    }
    if (m.type === 'INCIDENT_MERGED') {
      const p = m.payload
      s.applyMerge(p.incidentId, { reports: p.reports, reporters: p.reporters, severity: p.severity })
      s.addLog(type, `${p.incidentId} now ${p.reports ?? 1} reporter${(p.reports ?? 1) > 1 ? 's' : ''} — same scene`)
    }
    if (m.type === 'INCIDENT_UPDATE') {
      const st = m.payload.status
      if (st === 'ESCALATED') {
        s.updateAck(m.payload.incidentId, type, {
          serviceId: type,
          name: this.stationName(type),
          status: 'ESCALATED',
          ts: Date.now(),
        })
        s.addLog(type, `${m.payload.incidentId} ESCALATED — no ack within timeout`)
        if (s.alerts.some((a) => a.incidentId === m.payload.incidentId)) {
          s.addNotice({ id: `esc-${Date.now()}`, ts: Date.now(), kind: type, text: `NO ACK — ESCALATED, auto-dispatching nearest ${SERVICE_META[type].label} unit` })
        }
      } else if (st === 'OPEN') {
        const km = m.payload.distanceKm
        s.addLog(type, `alert received${km != null ? ` — ${km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(1) + 'km'} away` : ''}`)
      }
    }
    if (m.type === 'ALERT') {
      const inc = m.payload.incident ?? m.payload
      if (!inc || !inc.incidentId) return
      if (s.alerts.some((a) => a.incidentId === inc.incidentId)) return
      s.addAlert({
        incidentId: inc.incidentId,
        severity: inc.severity ?? 'MEDIUM',
        message: inc.message ?? 'Emergency alert from a peer device',
        sentAt: inc.receivedAt ?? Date.now(),
        lat: inc.lat,
        lng: inc.lng,
        sourceId: inc.source,
        acks: TYPES.map((t) => ({
          serviceId: t, name: this.stationName(t), type: t, status: 'OPEN' as const, ts: Date.now(),
        })),
        medical: inc.medical || undefined,
        lowBattery: inc.lowBattery || false,
        testMode: inc.testMode || false,
        verified: inc.verified,
        trustScore: inc.trustScore,
        evidence: inc.evidence || undefined,
        nearestStation: inc.nearestStation || undefined,
        distanceKm: inc.distanceKm,
      })
      s.addLog('ALERT', `EMERGENCY from ${inc.source ?? 'peer'} — ${inc.incidentId} (${inc.severity ?? 'MEDIUM'})${inc.distanceKm != null ? ` · ${inc.distanceKm < 1 ? Math.round(inc.distanceKm * 1000) + 'm' : inc.distanceKm.toFixed(1) + 'km'} away` : ''}`)
    }
    if (m.type === 'CHAT') {
      const from = m.payload.from || type
      const recent = s.chat.some((c) => c.from === from && c.text === m.payload.text && Date.now() - c.ts < 5000)
      if (!recent) s.addChat({ from, text: m.payload.text, ts: Date.now(), scope: type })
    }
    if (m.type === 'INCIDENT_CHAT') {
      const from = m.payload.from || type
      const recent = s.chat.some((c) => c.from === from && c.text === m.payload.text && c.incidentId === m.payload.incidentId && Date.now() - c.ts < 5000)
      if (!recent) s.addChat({ from, text: m.payload.text, ts: Date.now(), scope: type, incidentId: m.payload.incidentId })
    }
    if (m.type === 'INCIDENT_NOTE') {
      const note = { from: m.payload.from || type, text: m.payload.text, ts: m.payload.ts ?? Date.now() }
      s.addNote(m.payload.incidentId, note)
      s.addLog(type, `${m.payload.incidentId} note · ${note.from}: ${note.text}`)
    }
    if (m.type === 'INCIDENT_PHOTO') {
      const photo = {
        id: m.payload.id || `PH-${m.payload.ts ?? Date.now()}-${type}`,
        from: m.payload.from || type,
        role: m.payload.role || 'RESPONDER',
        photo: m.payload.photo,
        caption: m.payload.caption || '',
        ts: m.payload.ts ?? Date.now(),
      }
      s.addPhoto(m.payload.incidentId, photo)
      s.addLog(type, `${m.payload.incidentId} scene photo · ${photo.from}${photo.caption ? ': ' + photo.caption : ''}`)
    }
    if (m.type === 'SAFETY_UPDATE') {
      s.markSafety(m.payload.incidentId, !!m.payload.safe)
      s.addLog(type, `${m.payload.incidentId} victim ${m.payload.safe ? 'SAFE' : 'NEEDS HELP'}`)
    }
    if (m.type === 'ALERT_CANCEL') {
      s.cancelAlert(m.payload.incidentId)
      s.addLog(type, `${m.payload.incidentId} cancelled by caller — false alarm`)
      if (s.alerts.some((a) => a.incidentId === m.payload.incidentId)) {
        s.addNotice({ id: `cancel-${Date.now()}`, ts: Date.now(), kind: type, text: 'CALLER CANCELLED ALERT — false alarm, unit stood down' })
      }
    }
  }

  async capturePhoto(opts: { cameraAllowed: boolean; severity: Severity; deviceName: string }): Promise<string> {
    const { location } = this.store.getState()
    return capturePhotoFrame({ cameraAllowed: opts.cameraAllowed, deviceName: opts.deviceName, severity: opts.severity, lat: location.lat, lng: location.lng })
  }

  sendAlert(severity: Severity, message: string, opts?: AlertOptions) {
    const s = this.store.getState()
    const trust = trustFor(opts)
    const incidentId = `ALRT-${Date.now().toString(36).toUpperCase()}`
    const nearestNotes: string[] = []
    let sent = 0
    TYPES.forEach((t) => {
      const { station, km } = nearestStationOfType(s.services, t, s.location.lat, s.location.lng)
      const payload = {
        type: 'ALERT',
        payload: {
          incidentId,
          severity,
          message,
          lat: s.location.lat,
          lng: s.location.lng,
          sourceId: this.options.sourceId,
          medical: opts?.medical || null,
          lowBattery: opts?.lowBattery || false,
          testMode: opts?.testMode || false,
          verified: trust.verified,
          trustScore: trust.trustScore,
          nearestStation: station?.name ?? null,
          distanceKm: Number.isFinite(km) ? Number(km.toFixed(2)) : null,
          evidence: opts?.photo ? { photo: opts.photo, lat: s.location.lat, lng: s.location.lng, ts: Date.now() } : null,
        },
      }
      if (this.sendTo(t, payload)) sent++
      else this.restFallback(t, payload)
      nearestNotes.push(station && Number.isFinite(km) ? `${SERVICE_META[t].label} ${fmtKm(km)}` : SERVICE_META[t].label)
    })
    s.addAlert({
      incidentId, severity, message, sentAt: Date.now(),
      lat: s.location.lat, lng: s.location.lng,
      sourceId: this.options.sourceId,
      acks: TYPES.map((t) => ({
        serviceId: t, name: this.stationName(t), type: t, status: 'OPEN' as const, ts: Date.now(),
      })),
      testMode: opts?.testMode || false,
      medical: opts?.medical || undefined,
      lowBattery: opts?.lowBattery || false,
      verified: trust.verified,
      trustScore: trust.trustScore,
      evidence: opts?.photo ? { photo: opts.photo, lat: s.location.lat, lng: s.location.lng, ts: Date.now() } : undefined,
    })
    s.addLog('ALERT', `${incidentId} ${severity} → nearest ${nearestNotes.join(' · ')} (${sent}/3 up)${opts?.testMode ? ' [TEST]' : ''}`)
    return { incidentId, sent }
  }

  sendAlertTo(type: ServiceType, severity: Severity, message: string, opts?: AlertOptions) {
    const s = this.store.getState()
    const trust = trustFor(opts)
    const incidentId = `ALRT-${Date.now().toString(36).toUpperCase()}`
    const targets: ServiceType[] = [type]
    if (severity === 'CRITICAL') {
      for (const rule of CROSS_LINKS[type] || []) {
        if (rule.keywords.test(message)) targets.push(rule.to)
      }
    }
    const nearestNotes: string[] = []
    targets.forEach((t) => {
      const { station, km } = nearestStationOfType(s.services, t, s.location.lat, s.location.lng)
      const payload = {
        type: 'ALERT',
        payload: {
          incidentId,
          severity,
          message,
          lat: s.location.lat,
          lng: s.location.lng,
          sourceId: this.options.sourceId,
          medical: opts?.medical || null,
          lowBattery: opts?.lowBattery || false,
          testMode: opts?.testMode || false,
          verified: trust.verified,
          trustScore: trust.trustScore,
          nearestStation: station?.name ?? null,
          distanceKm: Number.isFinite(km) ? Number(km.toFixed(2)) : null,
          evidence: opts?.photo ? { photo: opts.photo, lat: s.location.lat, lng: s.location.lng, ts: Date.now() } : null,
        },
      }
      if (!this.sendTo(t, payload)) this.restFallback(t, payload)
      nearestNotes.push(station && Number.isFinite(km) ? `${SERVICE_META[t].label} ${fmtKm(km)}` : SERVICE_META[t].label)
    })
    s.addAlert({
      incidentId, severity, message, sentAt: Date.now(),
      lat: s.location.lat, lng: s.location.lng,
      sourceId: this.options.sourceId,
      acks: targets.map((t) => ({
        serviceId: t, name: this.stationName(t), type: t, status: 'OPEN' as const, ts: Date.now(),
      })),
      testMode: opts?.testMode || false,
      medical: opts?.medical || undefined,
      lowBattery: opts?.lowBattery || false,
      verified: trust.verified,
      trustScore: trust.trustScore,
      evidence: opts?.photo ? { photo: opts.photo, lat: s.location.lat, lng: s.location.lng, ts: Date.now() } : undefined,
    })
    const linked = targets.filter((t) => t !== type)
    s.addLog('ALERT', `${incidentId} ${severity} → nearest ${nearestNotes.join(' · ')}${linked.length ? ` · cross-link: ${linked.join(', ')}` : ''}${opts?.testMode ? ' [TEST]' : ''}`)
    return { incidentId, sent: targets.length }
  }

  ackIncident(type: ServiceType, incidentId: string, eta?: number) {
    const s = this.store.getState()
    const station = s.services.find((svc) => svc.type === type)
    const payload = { type: 'ALERT_ACK', payload: { incidentId, eta: eta ?? 5 } }
    const viaWs = this.sendTo(type, payload)
    if (!viaWs) this.restFallback(type, payload)
    s.updateAck(incidentId, type, {
      serviceId: station?.id || type,
      name: station?.name || type,
      status: 'ACKED',
      etaMinutes: eta ?? 5,
      ts: Date.now(),
    })
    s.addLog(type, `${incidentId} acknowledged (ETA ${eta ?? 5} min)`)
    incidentBus.publish({ type: 'ALERT_ACK', svc: type, serviceId: station?.id || type, name: station?.name || type, incidentId, etaMinutes: eta ?? 5 })
    return true
  }

  dispatchIncident(type: ServiceType, incidentId: string, action: 'DISPATCH' | 'RESOLVED', note?: string) {
    const s = this.store.getState()
    const station = s.services.find((svc) => svc.type === type)
    const payload = { type: 'DISPATCH_UPDATE', payload: { incidentId, action, note } }
    const viaWs = this.sendTo(type, payload)
    if (!viaWs) this.restFallback(type, payload)
    s.updateAck(incidentId, type, {
      serviceId: station?.id || type,
      name: station?.name || type,
      status: action === 'RESOLVED' ? 'RESOLVED' : 'DISPATCHING',
      note,
      ts: Date.now(),
    })
    s.addLog(type, `${incidentId} ${action}${note ? ' · ' + note : ''}`)
    incidentBus.publish({
      type: 'DISPATCH_UPDATE',
      svc: type,
      serviceId: station?.id || type,
      name: station?.name || type,
      incidentId,
      status: action === 'RESOLVED' ? 'RESOLVED' : 'DISPATCHING',
      note,
    })
    return true
  }

  sendChat(text: string) {
    const payload = { type: 'CHAT', payload: { from: this.options.senderName, text } }
    TYPES.forEach((t) => {
      if (!this.sendTo(t, payload)) this.restFallback(t, payload)
    })
    this.store.getState().addChat({ from: this.options.senderName, text, ts: Date.now(), scope: 'ALL' })
    incidentBus.publish({ type: 'CHAT', from: this.options.senderName, text, scope: 'ALL' })
  }

  sendChatTo(type: ServiceType, text: string) {
    const payload = { type: 'CHAT', payload: { from: this.options.senderName, text } }
    if (!this.sendTo(type, payload)) this.restFallback(type, payload)
    this.store.getState().addChat({ from: this.options.senderName, text, ts: Date.now(), scope: type })
    incidentBus.publish({ type: 'CHAT', from: this.options.senderName, text, scope: type })
  }

  sendIncidentChat(incidentId: string, text: string) {
    const payload = { type: 'INCIDENT_CHAT', payload: { from: this.options.senderName, text, incidentId } }
    TYPES.forEach((t) => {
      if (!this.sendTo(t, payload)) this.restFallback(t, payload)
    })
    this.store.getState().addChat({ from: this.options.senderName, text, ts: Date.now(), scope: 'ALL', incidentId })
    incidentBus.publish({ type: 'INCIDENT_CHAT', incidentId, from: this.options.senderName, text, scope: 'ALL' })
  }

  sendNote(incidentId: string, text: string) {
    const payload = { type: 'INCIDENT_NOTE', payload: { from: this.options.senderName, text, incidentId } }
    TYPES.forEach((t) => {
      if (this.sendTo(t, payload)) this.store.getState().setConn(t, 'ONLINE')
    })
    this.store.getState().addNote(incidentId, { from: this.options.senderName, text, ts: Date.now() })
    incidentBus.publish({ type: 'INCIDENT_NOTE', incidentId, from: this.options.senderName, text })
  }

  sendPhoto(incidentId: string, photo: string, opts?: { caption?: string; role?: string }) {
    const id = `PH-${Date.now().toString(36).toUpperCase()}`
    const entry = { id, from: this.options.senderName, role: opts?.role || 'RESPONDER', photo, caption: opts?.caption || '', ts: Date.now() }
    const payload = { type: 'INCIDENT_PHOTO', payload: { incidentId, ...entry } }
    TYPES.forEach((t) => {
      if (this.sendTo(t, payload)) this.store.getState().setConn(t, 'ONLINE')
    })
    this.store.getState().addPhoto(incidentId, entry)
    incidentBus.publish({ type: 'INCIDENT_PHOTO', incidentId, from: entry.from, role: entry.role, caption: entry.caption })
  }

  cancelAlert(incidentId: string) {
    const payload = { type: 'ALERT_CANCEL', payload: { incidentId, source: this.options.sourceId } }
    TYPES.forEach((t) => {
      if (!this.sendTo(t, payload)) this.restFallback(t, payload)
    })
    this.store.getState().cancelAlert(incidentId)
    this.store.getState().addLog('ALERT', `${incidentId} cancelled by caller — false alarm`)
    incidentBus.publish({ type: 'ALERT_CANCEL', incidentId, source: this.options.sourceId })
  }

  reportSafety(incidentId: string, safe: boolean) {
    const payload = { type: 'SAFETY_UPDATE', payload: { incidentId, safe } }
    TYPES.forEach((t) => {
      if (!this.sendTo(t, payload)) this.restFallback(t, payload)
    })
    this.store.getState().markSafety(incidentId, safe)
    this.store.getState().addLog('SAFETY', `${incidentId} victim ${safe ? 'SAFE' : 'NEEDS HELP'}`)
    incidentBus.publish({ type: 'SAFETY_UPDATE', incidentId, safe })
  }

  moveTo(lat: number, lng: number) {
    const s = this.store.getState()
    s.setLocation(lat, lng)
    if (this.registryWs?.readyState === WebSocket.OPEN) {
      this.registryWs.send(JSON.stringify({ type: 'NEAREST', payload: { lat, lng } }))
    }
    const locPayload = JSON.stringify({ type: 'LOCATION_UPDATE', payload: { lat, lng } })
    TYPES.forEach((t) => {
      const ws = this.serviceWs[t]
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(locPayload)
    })
    s.addLog('LOCATION', `Location re-broadcast (${lat.toFixed(4)}, ${lng.toFixed(4)})`)
  }

  reconnectAll() {
    this.store.getState().addLog('SYSTEM', 'Reconnecting all endpoints…')
    this.registryWs?.close()
    TYPES.forEach((t) => this.serviceWs[t]?.close())
  }

  requestLocation() {
    if (!('geolocation' in navigator)) {
      this.store.getState().setTracking('DENIED')
      this.store.getState().addLog('LOCATION', 'Geolocation not available on this device')
      return
    }
    if (this.trackWatcher != null) return
    this.store.getState().setTracking('REQUESTING')
    navigator.geolocation.getCurrentPosition(
      (pos) => this.beginTracking(pos.coords.latitude, pos.coords.longitude),
      () => {
        this.store.getState().setTracking('DENIED')
        this.store.getState().addLog('LOCATION', 'Location permission denied — using default coords')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  private beginTracking(lat: number, lng: number) {
    this.moveTo(lat, lng)
    if (this.trackWatcher != null) return
    this.store.getState().setTracking('ON')
    this.store.getState().addLog('LOCATION', `Live tracking started (${lat.toFixed(4)}, ${lng.toFixed(4)}) — stays on until all services resolve`)
    this.trackWatcher = navigator.geolocation.watchPosition(
      (pos) => this.moveTo(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    )
    this.trackUnsub = this.store.subscribe((s) => {
      const anyUnresolved = s.alerts.some((a) => a.acks.some((k) => k.status !== 'RESOLVED'))
      if (!anyUnresolved) this.stopLiveTracking()
    })
  }

  stopLiveTracking() {
    if (this.trackWatcher != null) {
      navigator.geolocation.clearWatch(this.trackWatcher)
      this.trackWatcher = null
    }
    this.trackUnsub?.()
    this.trackUnsub = null
    this.store.getState().setTracking('OFF')
    this.store.getState().addLog('LOCATION', 'Live tracking stopped — all services marked resolved')
  }

  setDegraded(on: boolean) {
    this.store.getState().setDegraded(on)
    this.store.getState().addLog('SYSTEM', on
      ? 'NETWORK DEGRADED — 18% packet loss · delayed delivery · retries active'
      : 'Network condition restored to normal')
  }

  setLinked(v: boolean) {
    const s = this.store.getState()
    if (v) {
      s.setStandby(false)
      s.addLog('SYSTEM', 'Network link restored — all devices reconnected as one fabric')
      this.start()
      this.flushQueue()
    } else {
      this.stop()
      s.setStandby(true)
      s.addLog('SYSTEM', 'Network unlinked — devices now standalone, emergency stream paused')
    }
  }

  simulateAlert(type: ServiceType) {
    const s = this.store.getState()
    const trust = trustFor({ testMode: true })
    const incidentId = `SIM-${Date.now().toString(36).toUpperCase()}`
    const samples = [
      { severity: 'HIGH' as Severity, message: 'Simulated drill — vehicle collision reported nearby' },
      { severity: 'CRITICAL' as Severity, message: 'Simulated drill — structure fire with possible casualties' },
      { severity: 'MEDIUM' as Severity, message: 'Simulated drill — suspicious activity in the area' },
    ]
    const pick = samples[Math.floor(Math.random() * samples.length)]
    const payload = {
      type: 'ALERT',
      payload: {
        incidentId,
        severity: pick.severity,
        message: `${pick.message} [SIMULATED]`,
        lat: s.location.lat + (Math.random() - 0.5) * 0.01,
        lng: s.location.lng + (Math.random() - 0.5) * 0.01,
        sourceId: 'SIM-DRILL',
        medical: null,
        lowBattery: false,
        testMode: true,
        verified: trust.verified,
        trustScore: trust.trustScore,
      },
    }
    if (!this.sendTo(type, payload)) this.restFallback(type, payload)
    s.addAlert({
      incidentId, severity: pick.severity, message: `${pick.message} [SIMULATED]`, sentAt: Date.now(),
      lat: s.location.lat, lng: s.location.lng,
      sourceId: 'SIM-DRILL',
      acks: [{ serviceId: type, name: this.stationName(type), type, status: 'OPEN' as const, ts: Date.now() }],
      testMode: true,
      verified: trust.verified,
      trustScore: trust.trustScore,
    })
    s.addLog('ALERT', `${incidentId} simulated ${pick.severity} → ${type} [DRILL]`)
    return incidentId
  }

  replayIncident(incidentId: string) {
    if (this.replaying) return
    const s = this.store.getState()
    const alert = s.alerts.find((a) => a.incidentId === incidentId)
    if (!alert || !alert.acks.length) return
    this.replaying = true
    const types = alert.acks.map((k) => k.type)
    s.addLog('ALERT', `${incidentId} replay started`)
    const resetAck = (t: ServiceType) =>
      s.updateAck(incidentId, t, {
        serviceId: t, name: this.stationName(t), status: 'OPEN', ts: Date.now(),
      })
    const stepAck = (t: ServiceType, status: 'ACKED' | 'DISPATCHING' | 'RESOLVED', eta?: number) =>
      s.updateAck(incidentId, t, {
        serviceId: t, name: this.stationName(t), status, etaMinutes: eta, ts: Date.now(),
      })
    types.forEach((t, i) => setTimeout(() => resetAck(t), i * 120))
    const offsets = [500, 1300, 2100]
    types.forEach((t, i) => {
      setTimeout(() => stepAck(t, 'ACKED', 5), offsets[i] % 2500)
      setTimeout(() => stepAck(t, 'DISPATCHING', 4), offsets[i] % 2500 + 700)
      setTimeout(() => stepAck(t, 'RESOLVED'), offsets[i] % 2500 + 1400)
    })
    setTimeout(() => {
      this.replaying = false
      s.addLog('ALERT', `${incidentId} replay complete — sent → acked → dispatched → resolved`)
    }, 3600)
  }
}

export type EmergencyClient = EmergencyClientManager

export function createEmergencyClient(store: EmergencyStore, options: EmergencyClientOptions = {}): EmergencyClient {
  return new EmergencyClientManager(store, options)
}

export const emergencyClient = createEmergencyClient(useEmergencyStore, { senderName: 'SAFEZONE-1', sourceId: 'USER-MOB-01' })