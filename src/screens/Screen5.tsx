'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HeartPulse, ShieldAlert, Flame, Layers, MapPin, Check, Crosshair, FlaskConical, Siren, HeartPulse as HP2, Flame as FL2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmergencyStore, SERVICE_META, type ServiceType } from '@/lib/emergencyStore'
import { useEmergencyClient } from '@/hooks/useEmergencyClient'

const SERVICE_COLOR: Record<ServiceType, string> = {
  POLICE: '#3B82F6',
  HOSPITAL: '#EF4444',
  FIRE: '#F97316',
}

const CATEGORIES = [
  { id: 'MEDICAL', label: 'Medical', icon: HeartPulse, sev: 'CRITICAL' as const, msg: 'Medical emergency — immediate help required', color: '#EF4444' },
  { id: 'CRIME', label: 'Crime', icon: ShieldAlert, sev: 'HIGH' as const, msg: 'Crime in progress — need police', color: '#3B82F6' },
  { id: 'FIRE', label: 'Fire', icon: Flame, sev: 'CRITICAL' as const, msg: 'Fire — evacuating, need fire brigade', color: '#F97316' },
  { id: 'COMBO', label: 'Combo', icon: Layers, sev: 'CRITICAL' as const, msg: 'Multiple emergencies — send all units', color: '#8B5CF6' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

const HOLD_MS = 3000
const RING_C = 2 * Math.PI * 40

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function LightMap() {
  const services = useEmergencyStore((s) => s.services)
  const location = useEmergencyStore((s) => s.location)
  const standby = useEmergencyStore((s) => s.standby)

  const project = (lat: number, lng: number) => {
    const dLat = (lat - location.lat) * 110.57
    const dLng = (lng - location.lng) * 111.32 * Math.cos((location.lat * Math.PI) / 180)
    return {
      x: Math.max(-115, Math.min(115, dLng * 48)) + 140,
      y: Math.max(-115, Math.min(115, -dLat * 48)) + 120,
    }
  }

  return (
    <div className={cn('relative w-full h-56 rounded-2xl overflow-hidden border', standby ? 'border-calm-border opacity-60' : 'border-calm-border')}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 280 240" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="calmGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width="280" height="240" fill="#EEF2F7" />
        <g stroke="#D9E1EC" strokeWidth="0.75" opacity="0.7">
          {[0, 40, 80, 120, 160, 200, 240].map((v) => (
            <g key={v}>
              <line x1={v} y1={0} x2={v} y2={240} />
              <line x1={0} y1={v} x2={280} y2={v} />
            </g>
          ))}
        </g>
        <circle cx="140" cy="120" r="42" fill="none" stroke="#C9D4E2" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="140" cy="120" r="84" fill="none" stroke="#D4DDEA" strokeWidth="1" strokeDasharray="4 4" />

        {services.map((svc) => {
          const p = project(svc.lat, svc.lng)
          const color = SERVICE_COLOR[svc.type]
          const km = Math.sqrt((svc.lat - location.lat) ** 2 * 110.57 ** 2 + (svc.lng - location.lng) ** 2 * (111.32 * Math.cos((location.lat * Math.PI) / 180)) ** 2)
          return (
            <g key={svc.id}>
              <circle cx={p.x} cy={p.y} r={7} fill={color} opacity="0.18" />
              <circle cx={p.x} cy={p.y} r={4.5} fill={color} stroke="#fff" strokeWidth={1.5} filter="url(#calmGlow)" />
              <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#334155">{SERVICE_META[svc.type].label}</text>
              <text x={p.x} y={p.y + 15} textAnchor="middle" fontSize="6.5" fill="#64748B">{km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}</text>
            </g>
          )
        })}

        <motion.g animate={{ scale: [1, 1.5], opacity: [0.4, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }} style={{ transformOrigin: '140px 120px' }}>
          <circle cx="140" cy="120" r="11" fill="#DC2626" />
        </motion.g>
        <circle cx="140" cy="120" r="9" fill="#DC2626" stroke="#fff" strokeWidth={2} filter="url(#calmGlow)" />
        <text x="140" y="99" textAnchor="middle" fontSize="7" fontWeight="800" fill="#DC2626">YOU</text>
      </svg>
      {standby && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
          <span className="px-3 py-1.5 rounded-full bg-calm-surface border border-calm-border text-[10px] font-mono font-bold text-calm-textMuted shadow">NETWORK STANDBY — UNLINKED</span>
        </div>
      )}
    </div>
  )
}

export function Screen5() {
  const conn = useEmergencyStore((s) => s.conn)
  const services = useEmergencyStore((s) => s.services)
  const alerts = useEmergencyStore((s) => s.alerts)
  const location = useEmergencyStore((s) => s.location)
  const tracking = useEmergencyStore((s) => s.tracking)
  const standby = useEmergencyStore((s) => s.standby)
  const { sendAlert, requestLocation, stopLiveTracking, replayIncident } = useEmergencyClient()

  const [category, setCategory] = useState<CategoryId>('MEDICAL')
  const [medical, setMedical] = useState('')
  const [testMode, setTestMode] = useState(false)
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const [fired, setFired] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ServiceType | null>(null)
  const holdStart = useRef(0)
  const raf = useRef(0)

  const cat = CATEGORIES.find((c) => c.id === category)!

  useEffect(() => {
    if (!holding) return
    holdStart.current = performance.now()
    const tick = () => {
      const p = Math.min(1, (performance.now() - holdStart.current) / HOLD_MS)
      setProgress(p)
      if (p >= 1) {
        setHolding(false)
        fire()
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [holding])

  const fire = () => {
    const id = sendAlert(cat.sev, cat.msg, { medical: medical || undefined, testMode })
    setProgress(0)
    setFired(id.incidentId)
  }

  const release = () => {
    if (holding) {
      setHolding(false)
      setProgress(0)
    }
  }

  const sentAlert = fired ? alerts.find((a) => a.incidentId === fired) : null
  const connected = (['POLICE', 'HOSPITAL', 'FIRE'] as ServiceType[]).filter((t) => conn[t] === 'ONLINE').length

  return (
    <div className="relative w-full h-full flex flex-col bg-calm-bg text-calm-text overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.22em] text-calm-text">SAFEZONE</p>
          <p className="text-[9px] font-mono text-calm-textMuted">PANTOM MESH RESPONSE</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-calm-surface border border-calm-border shadow-sm">
          <span className={cn('w-1.5 h-1.5 rounded-full', standby ? 'bg-calm-textDim' : 'bg-calm-green animate-pulse')} />
          <span className="text-[9px] font-bold tracking-wider text-calm-textMuted">{standby ? 'STANDBY' : `LIVE · ${connected}/3`}</span>
        </div>
      </header>

      <div className="flex-1 min-h-0 px-4 flex flex-col gap-3 overflow-y-auto scrollbar-thin">
        {/* Connection pills */}
        <div className="grid grid-cols-3 gap-2">
          {(['POLICE', 'HOSPITAL', 'FIRE'] as ServiceType[]).map((t) => {
            const color = SERVICE_COLOR[t]
            const on = !standby && conn[t] === 'ONLINE'
            return (
              <button
                key={t}
                onClick={() => setExpanded(expanded === t ? null : t)}
                className={cn(
                  'rounded-xl bg-calm-surface border shadow-sm px-2 py-2 text-left transition-all',
                  expanded === t ? 'border-calm-textMuted ring-2' : 'border-calm-border'
                )}
                style={expanded === t ? { borderColor: color, ['--tw-ring-color' as any]: `${color}33` } : undefined}
              >
                <span className="flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? color : '#CBD5E1' }} />
                  <span className="text-[9px] font-bold" style={{ color }}>{SERVICE_META[t].label}</span>
                </span>
                <span className={cn('text-[8px] font-mono font-semibold', on ? 'text-calm-green' : 'text-calm-textDim')}>
                  {standby ? 'STANDBY' : on ? 'CONNECTED' : 'SYNCING…'}
                </span>
              </button>
            )
          })}
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl bg-calm-surface border border-calm-border p-3">
                {(() => {
                  const svc = services.find((s) => s.type === expanded)
                  const km = svc
                    ? Math.sqrt((svc.lat - location.lat) ** 2 * 110.57 ** 2 + (svc.lng - location.lng) ** 2 * (111.32 * Math.cos((location.lat * Math.PI) / 180)) ** 2)
                    : null
                  const Icon = expanded === 'POLICE' ? Siren : expanded === 'HOSPITAL' ? HP2 : FL2
                  return (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${SERVICE_COLOR[expanded]}18` }}>
                        <Icon className="h-4 w-4" style={{ color: SERVICE_COLOR[expanded] }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-calm-text truncate">{svc ? svc.name : `${SERVICE_META[expanded].label} dispatch`}</p>
                        <p className="text-[9px] font-mono text-calm-textMuted tabular-nums">
                          {svc ? `load ${svc.currentLoad}/${svc.capacity} · uptime ${svc.uptime ?? 100}% · ${km != null ? (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`) : '…'} away` : 'discovering station…'}
                        </p>
                      </div>
                      <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold tracking-wider', !standby && conn[expanded] === 'ONLINE' ? 'bg-calm-green/15 text-calm-green' : 'bg-calm-border text-calm-textMuted')}>
                        {!standby && conn[expanded] === 'ONLINE' ? 'AVAILABLE' : 'OFFLINE'}
                      </span>
                    </div>
                  )
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Map */}
        <LightMap />

        {/* Category sheet */}
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map((c) => {
            const Icon = c.icon
            const active = category === c.id
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={cn('rounded-xl py-2.5 flex flex-col items-center gap-1 border transition-all shadow-sm', active ? 'text-white' : 'bg-calm-surface border-calm-border text-calm-textMuted')}
                style={active ? { background: c.color, borderColor: c.color } : undefined}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[8px] font-bold tracking-wide">{c.label}</span>
              </button>
            )
          })}
        </div>

        {/* Settings row */}
        <div className="rounded-xl bg-calm-surface border border-calm-border divide-y divide-calm-border">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <Crosshair className="h-3.5 w-3.5 text-calm-textMuted" />
            <span className="text-[10px] font-semibold text-calm-text flex-1">Live location sharing</span>
            <span className={cn('text-[8px] font-mono font-bold px-1.5 py-0.5 rounded', tracking === 'ON' ? 'bg-calm-green/15 text-calm-green' : tracking === 'DENIED' ? 'bg-calm-accent/15 text-calm-accent' : 'bg-calm-border text-calm-textMuted')}>
              {tracking === 'ON' ? 'SHARING' : tracking === 'DENIED' ? 'DENIED' : 'OFF'}
            </span>
            <button
              onClick={() => (tracking === 'ON' ? stopLiveTracking() : requestLocation())}
              className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-calm-accent text-white active:scale-95 transition-transform"
            >
              {tracking === 'ON' ? 'STOP' : 'SHARE'}
            </button>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <FlaskConical className="h-3.5 w-3.5 text-calm-textMuted" />
            <input
              value={medical}
              onChange={(e) => setMedical(e.target.value)}
              placeholder="Medical profile — blood type, allergies (feeds Hospital)"
              className="flex-1 bg-transparent text-[10px] text-calm-text placeholder:text-calm-textDim focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <span className="text-[10px] font-semibold text-calm-text flex-1 pl-5">Drill mode (no real dispatch)</span>
            <button
              onClick={() => setTestMode(!testMode)}
              className={cn('w-9 h-5 rounded-full transition-colors', testMode ? 'bg-calm-green' : 'bg-calm-border')}
              aria-label="Toggle drill mode"
            >
              <span className={cn('block w-4 h-4 rounded-full bg-white shadow transition-transform', testMode ? 'translate-x-4.5' : 'translate-x-0.5')} />
            </button>
          </div>
        </div>
      </div>

      {/* Receipts overlay */}
      <AnimatePresence>
        {fired && sentAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-calm-bg/98 backdrop-blur-sm flex flex-col"
          >
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold tracking-[0.22em] text-calm-accent">ALERT SENT</p>
                  <p className="text-[9px] font-mono text-calm-textMuted mt-0.5">{sentAlert.incidentId} · {sentAlert.severity} · {sentAlert.message}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-calm-green/15 flex items-center justify-center">
                  <Check className="h-4 w-4 text-calm-green" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => replayIncident(sentAlert.incidentId)}
                  className="px-3 py-1.5 rounded-lg bg-calm-surface border border-calm-border text-[9px] font-bold text-calm-textMuted active:scale-95 transition-transform"
                >
                  REPLAY RESPONSE
                </button>
                <button
                  onClick={() => setFired(null)}
                  className="px-3 py-1.5 rounded-lg bg-calm-accent text-white text-[9px] font-bold active:scale-95 transition-transform"
                >
                  DONE
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 px-4 overflow-y-auto scrollbar-thin space-y-2.5">
              {sentAlert.acks.map((ack) => {
                const color = SERVICE_COLOR[ack.type]
                const Icon = ack.type === 'POLICE' ? Siren : ack.type === 'HOSPITAL' ? HP2 : FL2
                const steps = [
                  { label: 'Sent', done: true, sub: `0:00`, at: sentAlert.sentAt },
                  { label: 'Acknowledged', done: ack.status !== 'OPEN', sub: ack.status !== 'OPEN' ? fmtClock(ack.ts - sentAlert.sentAt) : '—', at: ack.ts },
                  { label: 'Unit Dispatched', done: ack.status === 'DISPATCHING' || ack.status === 'RESOLVED', sub: ack.status === 'DISPATCHING' || ack.status === 'RESOLVED' ? fmtClock(ack.ts - sentAlert.sentAt) : '—', at: ack.ts },
                  { label: 'Resolved', done: ack.status === 'RESOLVED', sub: ack.status === 'RESOLVED' ? fmtClock(ack.ts - sentAlert.sentAt) : '—', at: ack.ts },
                ]
                return (
                  <div key={ack.type} className="rounded-2xl bg-calm-surface border border-calm-border p-3">
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-calm-text">{SERVICE_META[ack.type].label} DISPATCH</p>
                        <p className="text-[8px] font-mono text-calm-textMuted">{ack.status === 'RESOLVED' ? 'resolved' : ack.status === 'DISPATCHING' ? `en route · ETA ${ack.etaMinutes ?? '—'} min` : ack.status === 'ACKED' ? 'acknowledged' : 'waiting for ack'}</p>
                      </div>
                      {ack.status === 'DISPATCHING' && (
                        <motion.span animate={{ opacity: [0.4, 1] }} transition={{ duration: 1, repeat: Infinity }} className="ml-auto text-[9px] font-bold text-calm-green">
                          EN ROUTE
                        </motion.span>
                      )}
                    </div>
                    <div className="flex">
                      {steps.map((st, i) => (
                        <div key={st.label} className="flex-1 flex flex-col items-center relative">
                          {i > 0 && (
                            <span className={cn('absolute top-2 left-[-50%] w-full h-0.5', st.done ? 'bg-calm-green' : 'bg-calm-border')} />
                          )}
                          <span className={cn('relative w-4 h-4 rounded-full border-2 flex items-center justify-center z-10', st.done ? 'bg-calm-green border-calm-green' : 'bg-calm-surface border-calm-border')}>
                            {st.done && <Check className="h-2.5 w-2.5 text-white" />}
                          </span>
                          <span className="text-[7px] font-bold mt-1 text-calm-textMuted tracking-wide">{st.label}</span>
                          <span className={cn('text-[7px] font-mono tabular-nums', st.done ? 'text-calm-green' : 'text-calm-textDim')}>{st.sub}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SOS button */}
      <div className="px-4 pb-4 pt-1">
        <div className="flex items-center justify-center gap-4">
          <div className="text-right">
            <p className="text-[8px] font-mono text-calm-textDim tabular-nums">{useEmergencyStore.getState().location.lat.toFixed(4)}, {useEmergencyStore.getState().location.lng.toFixed(4)}</p>
            <p className="text-[8px] font-mono text-calm-textDim flex items-center justify-end gap-1"><MapPin className="h-2.5 w-2.5" />{tracking === 'ON' ? 'LIVE TRACKING' : 'LAST KNOWN'}</p>
          </div>
          <motion.button
            onPointerDown={() => !standby && setHolding(true)}
            onPointerUp={release}
            onPointerLeave={release}
            whileTap={{ scale: 0.96 }}
            className={cn('relative w-24 h-24 rounded-full flex items-center justify-center select-none touch-none', standby ? 'opacity-50 cursor-not-allowed' : 'active:cursor-grabbing')}
            aria-label="Hold to send emergency alert"
          >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#FEE2E2" strokeWidth="6" />
              <motion.circle
                cx="50" cy="50" r="40" fill="none"
                stroke="#DC2626" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={RING_C}
                animate={{ strokeDashoffset: RING_C * (1 - progress) }}
                transition={{ ease: 'linear', duration: 0.05 }}
              />
            </svg>
            <div className={cn('absolute inset-1.5 rounded-full flex flex-col items-center justify-center shadow-lg transition-colors', holding ? 'bg-calm-accent' : 'bg-gradient-to-b from-[#E11D48] to-[#991B1B]')}>
              <span className="text-[10px] font-black tracking-[0.3em] text-white">SOS</span>
              {holding ? (
                <span className="text-[8px] font-bold text-white/90 tabular-nums">{Math.max(1, Math.ceil((1 - progress) * 3))}…</span>
              ) : (
                <span className="text-[6px] font-semibold text-white/70 tracking-wider">HOLD 3S</span>
              )}
            </div>
          </motion.button>
          <div className="text-left">
            <p className="text-[8px] font-mono text-calm-textDim">{cat.label.toUpperCase()} READY</p>
            <p className="text-[8px] font-mono text-calm-textDim">{testMode ? 'DRILL MODE ON' : 'LIVE DISPATCH'}</p>
          </div>
        </div>
        {standby && (
          <p className="text-center text-[9px] font-semibold text-calm-accent mt-2">Network unlinked — press SYNC ALL to rearm the button</p>
        )}
      </div>
    </div>
  )
}