'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Siren, HeartPulse, Flame, AlertTriangle, CheckCheck, Send, Radio, Zap, ArrowLeft, Navigation, MapPin, Clock, Users, Camera, Map, Bell, BellOff } from 'lucide-react'
import { PhoneNav, PhoneNavProvider, ScreenBackground } from '@/components'
import { useShallow } from 'zustand/react/shallow'
import {
  useEmergencyStore, SERVICE_META,
  type ServiceType, type Severity,
} from '@/lib/emergencyStore'
import { useEmergencyClient } from '@/hooks/useEmergencyClient'
import { useMeshStore } from '@/lib/meshStore'
import { getPushState, enablePushAlerts, disablePushAlerts, type PushState } from '@/lib/pushNotifications'
import { DEVICE_PROFILES } from '@/lib/deviceProfiles'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<ServiceType, typeof Siren> = {
  POLICE: Siren,
  HOSPITAL: HeartPulse,
  FIRE: Flame,
}

const ACCENT: Record<ServiceType, { deep: string; accent: string }> = {
  POLICE: { deep: '#1E3A8A', accent: '#3B82F6' },
  HOSPITAL: { deep: '#991B1B', accent: '#EF4444' },
  FIRE: { deep: '#9A3412', accent: '#F97316' },
}

const CAP_LABEL: Record<ServiceType, string> = { POLICE: 'UNITS', HOSPITAL: 'BEDS', FIRE: 'TRUCKS' }

const ACTIONS: Record<ServiceType, { ack: string; dispatch: string; resolve: string }> = {
  POLICE: { ack: 'ACKNOWLEDGE', dispatch: 'DISPATCH UNIT', resolve: 'MARK RESOLVED' },
  HOSPITAL: { ack: 'ACCEPT', dispatch: 'SEND AMBULANCE', resolve: 'MARK RESOLVED' },
  FIRE: { ack: 'ACCEPT', dispatch: 'DISPATCH TRUCK', resolve: 'MARK RESOLVED' },
}

const SEV: Record<Severity, { color: string; rank: number }> = {
  CRITICAL: { color: '#DC2626', rank: 0 },
  HIGH: { color: '#F97316', rank: 1 },
  MEDIUM: { color: '#F59E0B', rank: 2 },
  LOW: { color: '#22C55E', rank: 3 },
}

const SLA_MS = 300 * 1000

const TEAMS: Record<ServiceType, { unit: string; crew: string }[]> = {
  POLICE: [
    { unit: 'UNIT K-9 · SH-12', crew: 'Officer R. Mehta + K9 Rex' },
    { unit: 'UNIT ALPHA · SH-07', crew: 'SI A. Patil + Constable V. Rao' },
    { unit: 'UNIT BRAVO · SH-03', crew: 'PSI K. Nair + Constable J. Das' },
  ],
  HOSPITAL: [
    { unit: 'AMB-7 · CODE GREEN', crew: 'Dr. S. Iyer + Paramedic T. Khan' },
    { unit: 'AMB-2 · CODE BLUE', crew: 'Dr. L. Dsouza + EMT A. Verma' },
    { unit: 'AMB-5 · CODE RED', crew: 'Dr. P. Bose + EMT M. Shaikh' },
  ],
  FIRE: [
    { unit: 'ENGINE-2 · CREW A', crew: 'FF Capt. D. Pawar + 4 crew' },
    { unit: 'ENGINE-1 · CREW B', crew: 'FF Capt. G. Reddy + 3 crew' },
    { unit: 'LADDER-4 · CREW C', crew: 'FF Lt. S. Joshi + 3 crew' },
  ],
}

function unitFor(type: ServiceType, incidentId: string) {
  const roster = TEAMS[type]
  let h = 0
  for (let i = 0; i < incidentId.length; i++) h = (h * 31 + incidentId.charCodeAt(i)) >>> 0
  return roster[h % roster.length]
}

const LIFE_CYCLE = ['Acknowledge', 'Dispatch', 'En Route', 'On Scene', 'Resolved']

function stepFor(status?: string): number {
  if (status === 'RESOLVED') return 4
  if (status === 'DISPATCHING') return 2
  if (status === 'ACKED') return 1
  return 0
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const fmtElapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const fmtClock = (ms: number) => `${Math.floor(Math.max(0, ms) / 1000 / 60)}:${String(Math.floor(Math.max(0, ms) / 1000) % 60).padStart(2, '0')}`

export function ServiceDashboard({ type }: { type: ServiceType }) {
  const [chatText, setChatText] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [noteText, setNoteText] = useState('')
  const [photoCaption, setPhotoCaption] = useState('')
  const [incMsg, setIncMsg] = useState('')
  const [pushState, setPushState] = useState<PushState>('unsupported')
  const meta = SERVICE_META[type]
  const Icon = TYPE_ICONS[type]
  const accent = ACCENT[type]
  const { ackIncident, dispatchIncident, sendChatTo, sendNote, sendPhoto, sendIncidentChat, capturePhoto } = useEmergencyClient()

  const conn = useEmergencyStore((s) => s.conn[type])
  const standby = useEmergencyStore((s) => s.standby)
  const alerts = useEmergencyStore((s) => s.alerts)
  const services = useEmergencyStore((s) => s.services)
  const location = useEmergencyStore((s) => s.location)
  const tracking = useEmergencyStore((s) => s.tracking)
  const chat = useEmergencyStore(useShallow((s) => s.chat.filter((c) => c.scope === 'ALL' || c.scope === type)))

  const station = services.find((s) => s.type === type)
  const activeCount = alerts.filter((a) => {
    const ack = a.acks.find((k) => k.type === type)
    return ack ? ack.status !== 'RESOLVED' : true
  }).length

  useEffect(() => {
    if (activeCount === 0) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [activeCount])

  useEffect(() => {
    getPushState().then(setPushState)
  }, [])

  const togglePush = async () => {
    if (pushState === 'on') {
      await disablePushAlerts(type)
      setPushState('idle')
      return
    }
    const res = await enablePushAlerts(type, station?.name ?? meta.label)
    setPushState(res.ok ? 'on' : res.reason === 'denied' ? 'denied' : 'idle')
  }

  const alertDistance = (lat?: number, lng?: number) => {
    if (lat == null || lng == null || !station) return null
    const km = haversineKm(lat, lng, station.lat, station.lng)
    return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`
  }

  const gmapsUrl = (lat?: number, lng?: number) => (lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : '')

  const queue = [...alerts]
    .filter((a) => a.acks.some((k) => k.type === type))
    .sort((a, b) => {
    const r = SEV[a.severity].rank - SEV[b.severity].rank
    return r !== 0 ? r : a.sentAt - b.sentAt
  })

  const selectedAlert = selected ? alerts.find((a) => a.incidentId === selected) : null

  const addScenePhoto = async () => {
    if (!selectedAlert) return
    const photo = await capturePhoto({ cameraAllowed: false, severity: selectedAlert.severity, deviceName: station?.name ?? type })
    sendPhoto(selectedAlert.incidentId, photo, { caption: photoCaption.trim() || undefined, role: 'RESPONDER' })
    setPhotoCaption('')
  }

  const emergencyNodes = useMeshStore((s) => s.nodes).filter((n) => n.status === 'EMERGENCY')
  const resolveNodeEmergency = useMeshStore((s) => s.resolveNodeEmergency)

  const online = !standby && conn === 'ONLINE'

  return (
    <div className="relative w-full h-full flex flex-col bg-dispatch-bg text-dispatch-text overflow-hidden">
      <ScreenBackground />
      <PhoneNavProvider><PhoneNav /></PhoneNavProvider>

      {/* Top bar — capacity readout */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: `${accent.deep}66` }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent.deep}99` }}>
            <Icon className="h-4 w-4" style={{ color: accent.accent }} />
          </div>
          <div>
            <p className="text-[12px] font-bold leading-tight" style={{ color: accent.accent }}>
              {station ? station.name : `${meta.label} DISPATCH`}
            </p>
            <p className="text-[8px] font-mono text-dispatch-textDim">CAD {type} · {station ? `:${station.port}` : 'AWAITING REGISTRY'}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-black tabular-nums" style={{ color: accent.accent }}>
            {station ? `${Math.max(0, station.capacity - station.currentLoad)}/${station.capacity}` : '—'}{' '}
            <span className="text-[8px] font-bold text-dispatch-textMuted">{CAP_LABEL[type]}</span>
          </p>
          <p className="text-[8px] font-mono text-dispatch-textDim tabular-nums">
            uptime {station?.uptime ?? 100}% · load {station?.currentLoad ?? 0}
          </p>
        </div>
      </header>

      {/* Status strip */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-dispatch-border bg-dispatch-surface/60">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: standby ? '#EDB40B' : online ? '#22C55E' : '#DC2626' }} />
          <span className="text-[9px] font-bold tracking-widest text-dispatch-textMuted">
            {standby ? 'STANDBY' : online ? 'ON DUTY' : 'LINK DOWN'}
          </span>
        </div>
        <span className="text-[9px] font-mono text-dispatch-textMuted">
          {activeCount} ACTIVE · {queue.filter((a) => { const k = a.acks.find((x) => x.type === type); return k?.status === 'RESOLVED' }).length} CLOSED
        </span>
        {tracking === 'ON' && (
          <span className="flex items-center gap-1 text-[9px] font-mono text-dispatch-textDim ml-auto">
            <MapPin className="h-2.5 w-2.5" />{location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </span>
        )}
        {pushState !== 'unsupported' && (
          <button
            onClick={togglePush}
            className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-black tracking-wider transition-all active:scale-95 ${pushState === 'on' ? 'text-[#22C55E]' : pushState === 'denied' ? 'text-[#DC2626] cursor-not-allowed' : 'text-calm-gold'}`}
            style={pushState === 'on' ? { background: '#22C55E18', border: '1px solid #22C55E44' } : pushState === 'denied' ? { background: '#DC262610' } : { background: 'rgba(237,180,11,0.12)', border: '1px solid rgba(237,180,11,0.35)' }}
            disabled={pushState === 'denied'}
          >
            {pushState === 'on' ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
            {pushState === 'on' ? 'PUSH ON' : pushState === 'denied' ? 'BLOCKED' : 'ENABLE PUSH'}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 scrollbar-thin">
        <AnimatePresence mode="wait">
          {selectedAlert ? (
            <motion.div key={`detail-${selectedAlert.incidentId}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
              <button
                onClick={() => setSelected(null)}
                className="flex items-center gap-1 text-[9px] font-bold tracking-widest text-dispatch-textMuted mb-2 hover:text-dispatch-text transition-colors"
              >
                <ArrowLeft className="h-3 w-3" /> BACK TO QUEUE
              </button>

              <div className="rounded-xl border border-dispatch-border bg-dispatch-surface p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] tabular-nums" style={{ color: accent.accent }}>{selectedAlert.incidentId}</span>
                  <span className="flex items-center gap-1.5">
                    {selectedAlert.testMode && <span className="px-1.5 py-0.5 rounded bg-dispatch-surfaceElevated text-dispatch-textMuted text-[8px] font-bold tracking-wider border border-dispatch-border">DRILL</span>}
                    {selectedAlert.verified != null && (
                      <span className={cn('px-2 py-0.5 rounded text-[8px] font-black tracking-wider border', selectedAlert.verified ? 'text-[#22C55E] border-[#22C55E]/50 bg-[#22C55E]/10' : 'text-calm-gold border-calm-gold/50 bg-calm-gold/10')}>
                        {selectedAlert.verified ? '✓ VERIFIED' : 'UNVERIFIED'} {selectedAlert.trustScore != null ? selectedAlert.trustScore : ''}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-wider text-white" style={{ background: SEV[selectedAlert.severity].color }}>
                      {selectedAlert.severity}
                    </span>
                  </span>
                </div>
                <p className="text-[12px] text-dispatch-text leading-snug mb-1.5">{selectedAlert.message}</p>
                <div className="flex items-center gap-3 text-[9px] font-mono text-dispatch-textMuted mb-2">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(selectedAlert.sentAt).toLocaleTimeString()}</span>
                  <span>{alertDistance(selectedAlert.lat, selectedAlert.lng)} away</span>
                  {selectedAlert.lowBattery && <span className="text-[#DC2626] flex items-center gap-1"><Zap className="h-3 w-3" />BATTERY</span>}
                </div>
                {selectedAlert.lat != null && selectedAlert.lng != null && (
                  <div className="flex items-center gap-2 mb-2 rounded-lg bg-dispatch-bg border border-dispatch-border px-2 py-1.5">
                    <MapPin className="h-3 w-3 shrink-0" style={{ color: accent.accent }} />
                    <span className="text-[9px] font-mono text-dispatch-text tabular-nums tracking-wide">
                      EXACT {selectedAlert.lat.toFixed(6)}, {selectedAlert.lng.toFixed(6)}
                    </span>
                    {selectedAlert.nearestStation && (
                      <span className="text-[8px] font-mono text-dispatch-textDim truncate">nearest {selectedAlert.nearestStation}</span>
                    )}
                    <a
                      href={gmapsUrl(selectedAlert.lat, selectedAlert.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-black tracking-wider text-white active:scale-95 transition-transform shrink-0"
                      style={{ background: accent.accent }}
                    >
                      <Map className="h-3 w-3" /> OPEN MAP
                    </a>
                  </div>
                )}
                {(selectedAlert.reports ?? 1) > 1 && (
                  <div className="mb-2 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 px-2 py-1.5">
                    <p className="text-[10px] font-mono flex items-center gap-1.5 mb-1">
                      <Users className="h-3 w-3 text-[#F59E0B]" />
                      <span className="text-[#F59E0B] font-black">{selectedAlert.reports} PEOPLE</span>
                      <span className="text-dispatch-textMuted">reported — one consolidated case</span>
                    </p>
                    <p className="text-[9px] font-mono text-dispatch-text leading-snug">
                      {(selectedAlert.reporters ?? []).map((id) => DEVICE_PROFILES[id]?.deviceName || id).join(' · ')}
                    </p>
                  </div>
                )}
                {selectedAlert.medical && (
                  <p className="text-[10px] font-mono leading-snug mb-2 rounded-lg bg-dispatch-bg border border-dispatch-border px-2 py-1.5">
                    <span className="text-dispatch-textDim">MEDICAL:</span> <span className="text-dispatch-text">{selectedAlert.medical}</span>
                  </p>
                )}
                {selectedAlert.evidence?.photo && (
                  <div className="mb-2 rounded-lg border border-dispatch-border overflow-hidden">
                    <p className="text-[7.5px] font-black tracking-[0.18em] text-dispatch-textDim bg-dispatch-bg px-2 py-1">SCENE EVIDENCE · AUTO-CAPTURED</p>
                    <img src={selectedAlert.evidence.photo} alt="Incident scene evidence" className="w-full object-cover" style={{ aspectRatio: '16/9' }} />
                    <p className="text-[7px] font-mono text-dispatch-textDim px-2 py-1 tabular-nums">
                      {selectedAlert.evidence.lat?.toFixed(4)}, {selectedAlert.evidence.lng?.toFixed(4)} · {new Date(selectedAlert.evidence.ts ?? selectedAlert.sentAt).toLocaleTimeString()}
                    </p>
                  </div>
                )}

                {/* Lifecycle stepper */}
                <p className="text-[8px] font-black tracking-[0.18em] text-dispatch-textDim mb-1.5">INCIDENT LIFECYCLE</p>
                <div className="flex mb-2">
                  {LIFE_CYCLE.map((step, i) => {
                    const st = stepFor(selectedAlert.acks.find((k) => k.type === type)?.status)
                    const done = i <= st
                    const active = i === st && st < 4
                    return (
                      <div key={step} className="flex-1 flex flex-col items-center relative">
                        {i > 0 && <span className="absolute top-1.5 left-[-50%] w-full h-0.5" style={{ background: done ? accent.accent : '#1E293B' }} />}
                        <span
                          className="relative z-10 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: done ? accent.accent : '#334155', background: active ? accent.accent : '#131C2E' }}
                        >
                          {done && !active && <CheckCheck className="h-2 w-2 text-white" />}
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        </span>
                        <span className={cn('text-[6.5px] font-bold mt-1 tracking-wide', done ? 'text-dispatch-text' : 'text-dispatch-textDim')}>{step}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Dispatched team */}
                {(() => {
                  const myAck = selectedAlert.acks.find((k) => k.type === type)
                  const dispatched = myAck?.status === 'DISPATCHING' || myAck?.status === 'RESOLVED'
                  if (!dispatched) return null
                  const unit = unitFor(type, selectedAlert.incidentId)
                  const etaMs = (myAck?.etaMinutes ?? 4) * 60 * 1000
                  const elapsed = myAck?.ts ? now - myAck.ts : 0
                  const progress = myAck?.status === 'RESOLVED' ? 1 : Math.min(0.98, Math.max(0.05, elapsed / etaMs))
                  const remainMin = Math.max(0, Math.ceil((etaMs - elapsed) / 60000))
                  return (
                    <div className="mt-2 rounded-lg border px-2.5 py-2" style={{ borderColor: myAck?.status === 'RESOLVED' ? '#22C55E66' : `${accent.accent}66`, background: myAck?.status === 'RESOLVED' ? '#22C55E12' : `${accent.accent}12` }}>
                      <p className="text-[8px] font-black tracking-[0.18em] mb-1" style={{ color: myAck?.status === 'RESOLVED' ? '#22C55E' : accent.accent }}>
                        {myAck?.status === 'RESOLVED' ? 'TEAM CLEARED — INCIDENT CLOSED' : 'TEAM DISPATCHED — EN ROUTE'}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent.accent}22` }}>
                          <Navigation className="h-4 w-4" style={{ color: accent.accent }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-dispatch-text truncate">{unit.unit}</p>
                          <p className="text-[8px] font-mono text-dispatch-textDim truncate">{unit.crew}</p>
                        </div>
                        {myAck?.status === 'DISPATCHING' && (
                          <span className="ml-auto flex items-center gap-1 text-[8px] font-mono text-[#F59E0B] shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />ETA {remainMin}m
                          </span>
                        )}
                      </div>
                      {myAck?.status === 'DISPATCHING' && (
                        <div className="mt-1.5">
                          <div className="h-1.5 rounded-full bg-dispatch-bg overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.round(progress * 100)}%`, background: 'linear-gradient(90deg, #F59E0B, #22C55E)' }} />
                          </div>
                          <p className="text-[7px] font-mono text-dispatch-textDim mt-0.5 tabular-nums">unit {Math.round(progress * 100)}% of the way · {unit.unit}</p>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Safety check-in (from victim) */}
                {selectedAlert.safety && (
                  <div className={cn('mt-2 rounded-lg border px-2.5 py-1.5 flex items-center gap-2 text-[9px] font-mono', selectedAlert.safety === 'SAFE' ? 'border-[#22C55E]/50 bg-[#22C55E]/10 text-[#22C55E]' : 'border-[#DC2626]/50 bg-[#DC2626]/10 text-[#DC2626]')}>
                    <CheckCheck className="h-3 w-3" />
                    {selectedAlert.safety === 'SAFE' ? 'VICTIM CONFIRMED SAFE — incident closed' : 'VICTIM STILL NEEDS HELP — re-check unit'}
                  </div>
                )}

                {/* Evidence gallery — responder photos */}
                {(selectedAlert.photos ?? []).length > 0 && (
                  <div className="mt-2 rounded-lg bg-dispatch-bg border border-dispatch-border px-2.5 py-1.5">
                    <p className="text-[7.5px] font-black tracking-[0.18em] text-dispatch-textDim mb-1">SCENE EVIDENCE · RESPONDER PHOTOS</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(selectedAlert.photos ?? []).slice(-9).map((p) => (
                        <div key={p.id} className="relative rounded-md overflow-hidden border border-dispatch-border bg-black">
                          <img src={p.photo} alt={p.caption || 'scene photo'} className="w-full h-14 object-cover" />
                          <p className="absolute inset-x-0 bottom-0 bg-black/70 text-[6.5px] text-white px-1 py-0.5 truncate">{p.caption || `${p.from} photo`}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addScenePhoto() }}
                    placeholder="Caption scene photo…"
                    className="flex-1 rounded-lg bg-dispatch-bg border border-dispatch-border px-2.5 py-1.5 text-[11px] text-dispatch-text placeholder:text-dispatch-textDim focus:outline-none"
                    style={{ borderColor: '#1E293B' }}
                  />
                  <button
                    onClick={addScenePhoto}
                    className="px-2.5 py-1.5 rounded-lg text-[8px] font-black tracking-wider text-white transition-all active:scale-95 inline-flex items-center gap-1"
                    style={{ background: accent.accent }}
                  >
                    <Camera className="h-3 w-3" /> CAPTURE
                  </button>
                </div>

                {/* Follow-up notes */}
                {(selectedAlert.notes ?? []).length > 0 && (
                  <div className="mt-2 rounded-lg bg-dispatch-bg border border-dispatch-border px-2.5 py-1.5">
                    <p className="text-[7.5px] font-black tracking-[0.18em] text-dispatch-textDim mb-1">FOLLOW-UP NOTES</p>
                    <div className="space-y-1">
                      {(selectedAlert.notes ?? []).slice(-6).map((n, i) => (
                        <p key={i} className="text-[9px] font-mono text-dispatch-text leading-snug">
                          <span style={{ color: accent.accent }}>{n.from}:</span> {n.text}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && noteText.trim()) { sendNote(selectedAlert.incidentId, noteText.trim()); setNoteText('') } }}
                    placeholder="Add follow-up note…"
                    className="flex-1 rounded-lg bg-dispatch-bg border border-dispatch-border px-2.5 py-1.5 text-[11px] text-dispatch-text placeholder:text-dispatch-textDim focus:outline-none"
                    style={{ borderColor: '#1E293B' }}
                  />
                  <button
                    onClick={() => { if (noteText.trim()) { sendNote(selectedAlert.incidentId, noteText.trim()); setNoteText('') } }}
                    className="px-2.5 py-1.5 rounded-lg text-[8px] font-black tracking-wider text-white transition-all active:scale-95"
                    style={{ background: accent.accent }}
                  >
                    NOTE
                  </button>
                </div>

                {/* Incident room chat */}
                <div className="mt-2 rounded-lg bg-dispatch-bg border border-dispatch-border px-2.5 py-1.5">
                  <p className="text-[7.5px] font-black tracking-[0.18em] text-dispatch-textDim mb-1">INCIDENT ROOM · {selectedAlert.incidentId}</p>
                  <div className="max-h-20 overflow-y-auto space-y-0.5 mb-1 scrollbar-thin">
                    {chat.filter((c) => c.incidentId === selectedAlert.incidentId).length === 0 && (
                      <p className="text-[9px] font-mono text-dispatch-textDim">Room empty — victim + dispatched units chat here</p>
                    )}
                    {chat.filter((c) => c.incidentId === selectedAlert.incidentId).slice(-8).map((c, i) => (
                      <p key={i} className="text-[9px] font-mono text-dispatch-text leading-snug">
                        <span style={{ color: c.from === 'SAFEZONE-1' ? accent.accent : '#22C55E' }}>{c.from}:</span> {c.text}
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={incMsg}
                      onChange={(e) => setIncMsg(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && incMsg.trim()) { sendIncidentChat(selectedAlert.incidentId, incMsg.trim()); setIncMsg('') } }}
                      placeholder={`Reply in room…`}
                      className="flex-1 rounded-lg bg-dispatch-surface border border-dispatch-border px-2.5 py-1.5 text-[11px] text-dispatch-text placeholder:text-dispatch-textDim focus:outline-none"
                      style={{ borderColor: '#1E293B' }}
                    />
                    <button
                      onClick={() => { if (incMsg.trim()) { sendIncidentChat(selectedAlert.incidentId, incMsg.trim()); setIncMsg('') } }}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ background: `${accent.accent}20`, color: accent.accent }}
                      aria-label="Send in room"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Action stack — always actionable so the loop can be driven end-to-end */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => ackIncident(type, selectedAlert.incidentId)}
                    className="flex-1 py-2 rounded-lg text-[9px] font-black tracking-wider text-white transition-all active:scale-95"
                    style={{ background: accent.accent }}
                  >
                    {ACTIONS[type].ack}
                  </button>
                  <button
                    onClick={() => dispatchIncident(type, selectedAlert.incidentId, 'DISPATCH', 'unit en route')}
                    className="flex-1 py-2 rounded-lg text-[9px] font-black tracking-wider transition-all active:scale-95"
                    style={{ background: '#F59E0B', color: '#0F172A' }}
                  >
                    {ACTIONS[type].dispatch}
                  </button>
                  <button
                    onClick={() => dispatchIncident(type, selectedAlert.incidentId, 'RESOLVED', 'incident handled')}
                    className="flex-1 py-2 rounded-lg text-[9px] font-black tracking-wider text-white transition-all active:scale-95"
                    style={{ background: '#22C55E' }}
                  >
                    {ACTIONS[type].resolve}
                  </button>
                </div>
              </div>

              {/* Radio chat */}
              <div className="mt-2 rounded-xl border border-dispatch-border bg-dispatch-surface p-2.5">
                <p className="text-[8px] font-black tracking-[0.18em] text-dispatch-textDim mb-1.5">RADIO CHAT</p>
                <div className="max-h-24 overflow-y-auto space-y-1 mb-1.5 scrollbar-thin">
                  {chat.length === 0 && <p className="text-[10px] text-dispatch-textDim">No messages yet</p>}
                  {chat.slice(-10).map((c, i) => (
                    <div key={i} className="text-[10px] font-mono leading-relaxed">
                      <span style={{ color: c.from === 'SAFEZONE-1' ? accent.accent : '#22C55E' }}>{c.from}:</span>{' '}
                      <span className="text-dispatch-text">{c.text}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { sendChatTo(type, chatText); setChatText('') } }}
                    placeholder={`Reply from ${meta.label}…`}
                    className="flex-1 rounded-lg bg-dispatch-bg border border-dispatch-border px-2.5 py-1.5 text-[11px] text-dispatch-text placeholder:text-dispatch-textDim focus:outline-none"
                    style={{ borderColor: '#1E293B' }}
                  />
                  <button
                    onClick={() => { sendChatTo(type, chatText); setChatText('') }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ background: `${accent.accent}20`, color: accent.accent }}
                    aria-label="Send chat"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {emergencyNodes.length > 0 && (
                <div className="rounded-xl border border-dispatch-border bg-dispatch-surface overflow-hidden">
                  <p className="text-[9px] font-black tracking-[0.2em] text-dispatch-textDim flex items-center gap-1.5 px-3 py-2 border-b border-dispatch-border">
                    <MapPin className="h-3 w-3 text-[#DC2626]" />
                    MESH EMERGENCIES <span className="text-[#DC2626]">({emergencyNodes.length})</span>
                  </p>
                  <div className="divide-y divide-dispatch-border">
                    {emergencyNodes.map((n) => (
                      <div key={n.id} className="px-3 py-2 flex items-center gap-2.5">
                        <span className="relative flex-none">
                          <span className="w-2 h-2 rounded-full bg-[#DC2626] block animate-ping absolute inset-0 opacity-60" />
                          <span className="w-2 h-2 rounded-full bg-[#DC2626] block relative" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[10px] text-dispatch-text">{n.id}</p>
                          <p className="text-[8px] font-mono text-dispatch-textDim truncate">EMERGENCY · {n.incidentId ?? 'ACTIVE'}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (!n.incidentId) return
                            dispatchIncident(type, n.incidentId, 'RESOLVED', `mesh node ${n.id} cleared — emergency over`)
                            resolveNodeEmergency(n.id)
                          }}
                          className="px-2.5 py-1 rounded-lg text-[8px] font-black tracking-wider text-white transition-all active:scale-95"
                          style={{ background: '#22C55E' }}
                        >
                          CLEAR NODE
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[9px] font-black tracking-[0.2em] text-dispatch-textDim flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" style={{ color: accent.accent }} />
                INCIDENT QUEUE · {activeCount} ACTIVE
              </p>

              {queue.length === 0 && (
                <div className="rounded-xl border border-dashed border-dispatch-border bg-dispatch-surface/40 p-5 text-center">
                  <Radio className="h-5 w-5 mx-auto mb-2" style={{ color: accent.accent }} />
                  <p className="text-[11px] text-dispatch-textMuted">No incoming incidents</p>
                  <p className="text-[9px] text-dispatch-textDim font-mono mt-1">hold SOS on the citizen app to raise one</p>
                </div>
              )}

              {queue.map((a) => {
                const ack = a.acks.find((k) => k.type === type)
                const sev = SEV[a.severity]
                const dist = alertDistance(a.lat, a.lng)
                const t0 = ack?.status === 'OPEN' || !ack ? a.sentAt : ack.ts
                const elapsed = now - t0
                const pastSla = ack?.status !== 'RESOLVED' && elapsed > SLA_MS
                return (
                  <motion.button
                    key={a.incidentId}
                    initial={{ backgroundColor: `${accent.accent}2E` }}
                    animate={{ backgroundColor: 'rgba(0,0,0,0)' }}
                    transition={{ duration: 1.4, delay: 0.2 }}
                    onClick={() => setSelected(a.incidentId)}
                    className="w-full text-left rounded-xl border border-dispatch-border bg-dispatch-surface p-2.5 hover:border-dispatch-borderBright transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider text-white shrink-0" style={{ background: sev.color }}>
                        {a.severity}
                      </span>
                      <span className="font-mono text-[9px] tabular-nums text-dispatch-textMuted truncate">{a.incidentId}</span>
                      {(ack?.status === 'OPEN' || !ack) && (
                        <span className="px-1.5 py-0.5 rounded bg-[#DC2626]/20 text-[#DC2626] text-[7px] font-black animate-pulse shrink-0">INCOMING</span>
                      )}
                      {(a.reports ?? 1) > 1 && (
                        <span className="px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] text-[8px] font-black shrink-0" title={`${a.reports} people reported this incident`}>
                          {a.reports} PEOPLE
                        </span>
                      )}
                      <span className={cn('ml-auto text-[10px] font-black tabular-nums', pastSla ? 'text-[#DC2626] animate-pulse' : 'text-dispatch-textMuted')}>
                        {fmtElapsed(elapsed)}
                      </span>
                    </div>
                    <p className="text-[11px] text-dispatch-text leading-snug truncate">{a.message}</p>
                    <div className="flex items-center gap-3 text-[8px] font-mono text-dispatch-textDim mt-1">
                      <span className="flex items-center gap-1"><Navigation className="h-2.5 w-2.5" />{dist ?? '—'} away</span>
                      {ack && (
                        <span className="ml-auto" style={{ color: ack.status === 'RESOLVED' ? '#22C55E' : ack.status === 'DISPATCHING' ? '#F59E0B' : ack.status === 'ACKED' ? accent.accent : ack.status === 'ESCALATED' ? '#DC2626' : '#94A3B8' }}>
                          {ack.status === 'DISPATCHING' ? `EN ROUTE · ETA ${ack.etaMinutes ?? '—'}m` : ack.status === 'ACKED' ? `ACK · ETA ${ack.etaMinutes ?? '—'}m` : ack.status}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-dispatch-border/60">
                      <p className="text-[7.5px] font-black tracking-[0.15em] text-dispatch-textDim mb-1.5">
                        {ack?.status === 'RESOLVED' ? 'RESOLVED' : ack?.status === 'DISPATCHING' ? 'UNIT EN ROUTE' : ack?.status === 'ACKED' ? 'ACKNOWLEDGED' : ack?.status === 'ESCALATED' ? 'ESCALATED — ACK AVAILABLE' : 'WAITING FOR ACK'}
                      </p>
                      <div className="flex">
                        {[
                          { label: 'Sent', done: true, time: '0:00' },
                          { label: 'Ack', done: ack != null && ack.status !== 'OPEN', time: ack != null && ack.status !== 'OPEN' ? fmtClock(ack.ts - a.sentAt) : '—' },
                          { label: 'Dispatch', done: ack?.status === 'DISPATCHING' || ack?.status === 'RESOLVED', time: ack?.status === 'DISPATCHING' || ack?.status === 'RESOLVED' ? fmtClock(ack.ts - a.sentAt) : '—' },
                          { label: 'Resolved', done: ack?.status === 'RESOLVED', time: ack?.status === 'RESOLVED' ? fmtClock(ack.ts - a.sentAt) : '—' },
                        ].map((st, i) => (
                          <div key={st.label} className="flex-1 flex flex-col items-center relative">
                            {i > 0 && <span className="absolute top-1.5 left-[-50%] w-full h-0.5" style={{ background: st.done ? '#22C55E' : '#1E293B' }} />}
                            <span className={cn('relative w-3 h-3 rounded-full border-2 flex items-center justify-center z-10', st.done ? 'border-[#22C55E] bg-[#22C55E]' : 'border-[#334155] bg-[#131C2E]')}>
                              {st.done && <CheckCheck className="h-1.5 w-1.5 text-white" />}
                            </span>
                            <span className={cn('text-[6px] font-bold mt-0.5 tracking-wide', st.done ? 'text-dispatch-text' : 'text-dispatch-textDim')}>{st.label}</span>
                            <span className={cn('text-[6px] font-mono tabular-nums', st.done ? 'text-[#22C55E]' : 'text-dispatch-textDim')}>{st.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}