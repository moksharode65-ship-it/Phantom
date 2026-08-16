'use client'

import { useState } from 'react'
import { Server, Activity, Siren, HeartPulse, Flame, Radio, ShieldCheck, Timer } from 'lucide-react'
import { PhoneNav, PhoneNavProvider, ScreenBackground, PortMap } from '@/components'
import { cn } from '@/lib/utils'
import { useEmergencyStore, SERVICE_META, type ServiceType } from '@/lib/emergencyStore'
import { useLinkStore } from '@/lib/linkStore'

const TYPE_ICONS = { POLICE: Siren, HOSPITAL: HeartPulse, FIRE: Flame } as const
const TYPE_COLOR: Record<ServiceType, string> = { POLICE: '#3B82F6', HOSPITAL: '#EF4444', FIRE: '#F97316' }

const FILTERS = ['ALL', 'ALERT', 'ACK', 'LOCATION', 'SYSTEM', 'OTHER'] as const

export function Screen1() {
  const services = useEmergencyStore((s) => s.services)
  const alerts = useEmergencyStore((s) => s.alerts)
  const log = useEmergencyStore((s) => s.log)
  const standby = useEmergencyStore((s) => s.standby)
  const degraded = useEmergencyStore((s) => s.degraded)
  const linked = useLinkStore((s) => s.linked)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL')

  const online = services.filter((s) => s.status === 'ONLINE').length
  const active = alerts.filter((a) => a.acks.some((k) => k.status !== 'RESOLVED')).length
  const escalated = alerts.filter((a) => a.acks.some((k) => k.status === 'ESCALATED')).length

  const responseFor = (type: ServiceType) => {
    const ts = alerts.flatMap((a) =>
      a.acks.filter((k) => k.type === type && k.status !== 'OPEN').map((k) => k.ts - a.sentAt)
    )
    if (!ts.length) return '—'
    return `${Math.round(ts.reduce((x, y) => x + y, 0) / ts.length)}s`
  }

  const visibleLog = log.filter((e) => {
    if (filter === 'ALL') return true
    if (filter === 'OTHER') return !['ALERT', 'ACK', 'LOCATION', 'SYSTEM'].includes(e.kind)
    return e.kind === filter
  }).slice(0, 14)

  return (
    <div className="relative w-full h-full flex flex-col bg-dispatch-bg text-dispatch-text overflow-hidden">
      <ScreenBackground />
      <PhoneNavProvider><PhoneNav /></PhoneNavProvider>

      <header className="flex items-center justify-between px-4 py-2.5 border-b border-dispatch-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-dispatch-surfaceElevated border border-dispatch-border flex items-center justify-center">
            <Server className="h-4 w-4 text-dispatch-textMuted" />
          </div>
          <div>
            <p className="text-[12px] font-bold tracking-wide">REGISTRY</p>
            <p className="text-[8px] font-mono text-dispatch-textDim">NETWORK OVERVIEW · :5000</p>
          </div>
        </div>
        <div className="text-right">
          <span className={cn('inline-flex items-center gap-1.5 text-[9px] font-black tracking-widest', standby ? 'text-[#F59E0B]' : linked ? 'text-[#22C55E]' : 'text-[#DC2626]')}>
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', standby ? 'bg-[#F59E0B]' : linked ? 'bg-[#22C55E]' : 'bg-[#DC2626]')} />
            {standby ? 'STANDBY' : linked ? 'ONLINE' : 'DOWN'}
          </span>
        </div>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-1.5 px-3 py-2 border-b border-dispatch-border bg-dispatch-surface/50">
        {[
          { label: 'STATIONS', value: `${online}/${services.length}`, color: linked ? '#22C55E' : '#DC2626' },
          { label: 'ACTIVE', value: String(active), color: active ? '#DC2626' : '#94A3B8' },
          { label: 'ESCALATED', value: String(escalated), color: escalated ? '#DC2626' : '#94A3B8' },
          { label: 'NETWORK', value: degraded ? 'DEGRADED' : 'STABLE', color: degraded ? '#F59E0B' : '#94A3B8' },
        ].map((k) => (
          <div key={k.label} className="rounded-lg bg-dispatch-surface border border-dispatch-border px-2 py-1.5">
            <p className="text-[7px] font-black tracking-[0.14em] text-dispatch-textDim">{k.label}</p>
            <p className="text-[11px] font-black tabular-nums" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin">
        {/* Coverage map */}
        <div className="rounded-xl border border-dispatch-border overflow-hidden">
          <p className="text-[8px] font-black tracking-[0.2em] text-dispatch-textDim px-3 py-1.5 bg-dispatch-surface border-b border-dispatch-border flex items-center gap-1.5">
            <Radio className="h-2.5 w-2.5" />COVERAGE MAP · LIVE
          </p>
          <PortMap className="h-52" />
        </div>

        {/* Station table */}
        <div className="rounded-xl border border-dispatch-border bg-dispatch-surface overflow-hidden">
          <p className="text-[8px] font-black tracking-[0.2em] text-dispatch-textDim px-3 py-1.5 border-b border-dispatch-border flex items-center gap-1.5">
            <Activity className="h-2.5 w-2.5" />STATION TABLE
          </p>
          <div className="px-3 py-1.5 grid grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr] gap-1 text-[7px] font-black tracking-[0.12em] text-dispatch-textDim border-b border-dispatch-border">
            <span>STATION</span><span>STATUS</span><span>INCID</span><span className="text-right">RESP</span>
          </div>
          {services.map((svc) => {
            const Icon = TYPE_ICONS[svc.type]
            const count = alerts.filter((a) => {
              const k = a.acks.find((x) => x.type === svc.type)
              return k ? k.status !== 'RESOLVED' : true
            }).length
            return (
              <div key={svc.id} className="px-3 py-1.5 grid grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr] gap-1 items-center border-b border-dispatch-border/60 last:border-0">
                <div className="min-w-0 flex items-center gap-1.5">
                  <Icon className="h-3 w-3 shrink-0" style={{ color: TYPE_COLOR[svc.type] }} />
                  <div className="min-w-0">
                    <p className="text-[9px] font-mono tabular-nums text-dispatch-text truncate">{svc.id}</p>
                    <p className="text-[7px] font-mono text-dispatch-textDim">{SERVICE_META[svc.type].label} · uptime {svc.uptime ?? 100}%</p>
                  </div>
                </div>
                <span className={cn('text-[8px] font-bold tracking-wider', svc.status === 'ONLINE' ? 'text-[#22C55E]' : 'text-[#DC2626]')}>
                  {svc.status === 'ONLINE' ? 'LIVE' : 'DOWN'}
                </span>
                <span className={cn('text-[9px] font-mono tabular-nums', count ? 'text-[#F59E0B]' : 'text-dispatch-textDim')}>{count}</span>
                <span className="text-right text-[9px] font-mono tabular-nums text-dispatch-textMuted">{responseFor(svc.type)}</span>
              </div>
            )
          })}
          {services.length === 0 && (
            <p className="px-3 py-3 text-[10px] text-dispatch-textDim font-mono text-center">awaiting registry handshake…</p>
          )}
        </div>

        {/* Audit log */}
        <div className="rounded-xl border border-dispatch-border bg-dispatch-surface overflow-hidden">
          <p className="text-[8px] font-black tracking-[0.2em] text-dispatch-textDim px-3 py-1.5 border-b border-dispatch-border flex items-center gap-1.5">
            <ShieldCheck className="h-2.5 w-2.5" />AUDIT LOG STREAM
          </p>
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-dispatch-border overflow-x-auto scrollbar-thin">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[8px] font-bold tracking-wider border transition-all shrink-0',
                  filter === f ? 'bg-dispatch-text text-dispatch-bg border-dispatch-text' : 'border-dispatch-border text-dispatch-textDim hover:text-dispatch-text'
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 space-y-0.5 max-h-40 overflow-y-auto scrollbar-thin">
            {visibleLog.length === 0 && (
              <p className="text-[10px] text-dispatch-textDim font-mono py-1">no entries for this filter</p>
            )}
            {visibleLog.map((e, i) => (
              <div key={i} className="flex items-baseline gap-2 text-[8px] font-mono leading-relaxed">
                <span className="text-dispatch-textDim tabular-nums shrink-0">{new Date(e.ts).toLocaleTimeString([], { hour12: false })}</span>
                <span className={cn(
                  'shrink-0 font-black tracking-wider',
                  e.kind === 'ALERT' ? 'text-[#DC2626]' :
                  e.kind === 'ACK' ? 'text-[#22C55E]' :
                  e.kind === 'LOCATION' ? 'text-[#3B82F6]' :
                  e.kind === 'SYSTEM' ? 'text-[#F59E0B]' :
                  'text-dispatch-textMuted'
                )}>
                  [{e.kind}]
                </span>
                <span className="text-dispatch-textMuted truncate">{e.text}</span>
              </div>
            ))}
          </div>
          {log.length > 14 && filter === 'ALL' && (
            <p className="px-3 py-1 text-[8px] font-mono text-dispatch-textDim border-t border-dispatch-border/60 flex items-center gap-1">
              <Timer className="h-2.5 w-2.5" /> showing latest 14 of {log.length} entries
            </p>
          )}
        </div>
      </div>
    </div>
  )
}