'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, Wifi, Minus, Plus, Target, Layers, Siren, HeartPulse, Flame, Radio, AlertTriangle, FlameKindling, PlusCircle, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmergencyStore, SERVICE_META, type ServiceType, type Severity } from '@/lib/emergencyStore'
import { useEmergencyClient } from '@/hooks/useEmergencyClient'
import { type EmergencyClient } from '@/lib/emergencyClient'
import { useMeshStore, nodeDistanceKm, nodeHops, SENDER_NODE_ID, type MeshNode, type MeshStore } from '@/lib/meshStore'
import { usePoiStore, POI_META, type Poi } from '@/lib/poiStore'

const PX_PER_KM = 55

const HEAT_CONFIG: Record<Severity, { radius: number; color: string }> = {
  CRITICAL: { radius: 26, color: '#E10600' },
  HIGH: { radius: 20, color: '#ff8a00' },
  MEDIUM: { radius: 15, color: '#EDB40B' },
  LOW: { radius: 10, color: '#00d47e' },
}

const TYPE_ICONS: Record<ServiceType, typeof Siren> = {
  POLICE: Siren,
  HOSPITAL: HeartPulse,
  FIRE: Flame,
}

interface MapStation {
  id: string
  name: string
  type: ServiceType
  port: number
  x: number
  y: number
  distanceKm: number
  load: number
  capacity: number
  online: boolean
}

interface PortMapProps {
  className?: string
  placeMode?: boolean
  onNodeClick?: (node: MeshNode) => void
  onMapClick?: (lat: number, lng: number) => void
  board?: boolean
  client?: EmergencyClient
  meshStore?: MeshStore
  ownNodeId?: string
}

export function PortMap({ className, placeMode, onNodeClick, onMapClick, board, client, meshStore = useMeshStore, ownNodeId }: PortMapProps) {
  const [zoom, setZoom] = useState(1)
  const [selected, setSelected] = useState<MapStation | null>(null)
  const [filterType, setFilterType] = useState<'ALL' | ServiceType>('ALL')
  const [filterOnline, setFilterOnline] = useState(true)
  const [heatOn, setHeatOn] = useState(true)
  const [showPois, setShowPois] = useState(true)
  const [selPoi, setSelPoi] = useState<Poi | null>(null)
  const [now, setNow] = useState(Date.now())
  const svgRef = useRef<SVGSVGElement>(null)

  const deviceStore = client?.store ?? useEmergencyStore
  const services = deviceStore((s) => s.services)
  const location = deviceStore((s) => s.location)
  const conn = deviceStore((s) => s.conn)
  const standby = deviceStore((s) => s.standby)
  const alerts = deviceStore((s) => s.alerts)
  const meshNodes = meshStore((s) => s.nodes)
  const { sendAlertTo } = useEmergencyClient(client)
  const pois = usePoiStore((s) => s.pois)
  const poiStatus = usePoiStore((s) => s.status)
  const fetchNearby = usePoiStore((s) => s.fetchNearby)

  const project = (lat: number, lng: number) => {
    const dLat = (lat - location.lat) * 110.57
    const dLng = (lng - location.lng) * 111.32 * Math.cos((location.lat * Math.PI) / 180)
    return {
      x: Math.max(-135, Math.min(135, dLng * PX_PER_KM)) + 150,
      y: Math.max(-135, Math.min(135, -dLat * PX_PER_KM)) + 150,
    }
  }

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!placeMode || !onMapClick) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 300
    const y = ((e.clientY - rect.top) / rect.height) * 300
    const dLng = (x - 150) / PX_PER_KM
    const dLat = -(y - 150) / PX_PER_KM
    onMapClick(location.lat + dLat / 110.57, location.lng + dLng / (111.32 * Math.cos((location.lat * Math.PI) / 180)))
  }

  const hasDispatch = alerts.some((a) => a.acks.some((k) => k.status === 'DISPATCHING'))

  useEffect(() => {
    if (!hasDispatch) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [hasDispatch])

  useEffect(() => {
    if (poiStatus === 'IDLE') fetchNearby(location.lat, location.lng)
  }, [])

  const nearestPois = useMemo(
    () =>
      [...pois]
        .map((p) => ({ p, km: nodeDistanceKm(location.lat, location.lng, p.lat, p.lng) }))
        .sort((a, b) => a.km - b.km),
    [pois, location]
  )

  const stations = useMemo<MapStation[]>(() => {
    return services.map((svc) => {
      const p = project(svc.lat, svc.lng)
      return {
        id: svc.id,
        name: svc.name,
        type: svc.type,
        port: svc.port,
        x: p.x,
        y: p.y,
        distanceKm: Math.sqrt((svc.lat - location.lat) ** 2 * 110.57 ** 2 + (svc.lng - location.lng) ** 2 * (111.32 * Math.cos((location.lat * Math.PI) / 180)) ** 2),
        load: svc.currentLoad,
        capacity: svc.capacity,
        online: svc.status === 'ONLINE',
      }
    })
  }, [services, location])

  const visible = stations.filter((s) => {
    if (filterType !== 'ALL' && s.type !== filterType) return false
    if (filterOnline && !s.online) return false
    return true
  })

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)}m`
    return `${km.toFixed(1)}km`
  }

  const onlineCount = stations.filter((s) => s.online).length
  const registryState = conn.REGISTRY

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('relative flex flex-col bg-pantom-surface/95 backdrop-blur-xl border border-pantom-border rounded-2xl overflow-hidden animate-fade-slide-up delay-1000', className)}
    >
      {/* Header */}
      <div className={cn('flex items-center justify-between border-b border-pantom-border/50 bg-pantom-bg/50', board ? 'px-5 py-4' : 'px-3 py-2.5')}>
        <div className="flex items-center gap-2">
          <Layers className={cn('text-pantom-gold', board ? 'h-6 w-6' : 'h-4 w-4')} />
          <span className={cn('text-pantom-text font-medium', board ? 'text-2xl tracking-[0.2em] font-black' : 'text-sm')}>PORT MAP</span>
          <span className={cn('px-1.5 py-0.5 text-[9px] font-mono bg-pantom-gold/20 text-pantom-gold rounded', board && 'px-2.5 py-1 text-sm')}>
            {onlineCount}/{stations.length} LIVE
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.25))}
            className={cn('text-pantom-textMuted hover:text-pantom-gold transition-colors', board ? 'p-2.5' : 'p-1.5')}
            aria-label="Zoom in"
          >
            <Plus className={cn('', board ? 'h-6 w-6' : 'h-3.5 w-3.5')} />
          </button>
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            className={cn('text-pantom-textMuted hover:text-pantom-gold transition-colors', board ? 'p-2.5' : 'p-1.5')}
            aria-label="Zoom out"
          >
            <Minus className={cn('', board ? 'h-6 w-6' : 'h-3.5 w-3.5')} />
          </button>
          <button
            onClick={() => { setZoom(1); setSelected(null); }}
            className={cn('text-pantom-textMuted hover:text-pantom-gold transition-colors', board ? 'p-2.5' : 'p-1.5')}
            aria-label="Reset view"
          >
            <Target className={cn('', board ? 'h-6 w-6' : 'h-3.5 w-3.5')} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={cn('border-b border-pantom-border/30 bg-pantom-bg/30 flex items-center gap-1.5 flex-wrap', board ? 'px-5 py-3 gap-2.5' : 'px-3 py-1.5')}>
        {(['ALL', 'POLICE', 'HOSPITAL', 'FIRE'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={cn(
              'font-bold tracking-wider rounded transition-all border',
              board ? 'px-4 py-2 text-base' : 'px-2 py-1 text-[9px]',
              filterType === t
                ? t === 'ALL'
                  ? 'bg-pantom-gold text-pantom-bg border-pantom-gold'
                  : `bg-pantom-gold/20 text-pantom-gold border-pantom-gold/40`
                : 'bg-pantom-border/40 text-pantom-textMuted border-transparent hover:text-pantom-gold'
            )}
          >
            {t === 'ALL' ? 'ALL' : t.slice(0, 4)}
          </button>
        ))}
        <button
          onClick={() => setFilterOnline(!filterOnline)}
          className={cn(
            'ml-auto font-bold tracking-wider rounded transition-all border',
            board ? 'px-4 py-2 text-base' : 'px-2 py-1 text-[9px]',
            filterOnline
              ? 'bg-pantom-green/20 text-pantom-green border-pantom-green/30'
              : 'bg-pantom-border/40 text-pantom-textMuted border-transparent hover:text-pantom-red'
          )}
        >
          <Wifi className={cn('inline mr-1', board ? 'h-4 w-4' : 'h-2.5 w-2.5')} />ONLINE
        </button>
        <button
          onClick={() => setHeatOn(!heatOn)}
          className={cn(
            'font-bold tracking-wider rounded transition-all border',
            board ? 'px-4 py-2 text-base' : 'px-2 py-1 text-[9px]',
            heatOn
              ? 'bg-pantom-red/20 text-pantom-red border-pantom-red/40'
              : 'bg-pantom-border/40 text-pantom-textMuted border-transparent hover:text-pantom-red'
          )}
        >
          <FlameKindling className={cn('inline mr-1', board ? 'h-4 w-4' : 'h-2.5 w-2.5')} />HEAT
        </button>
        <button
          onClick={() => {
            if (poiStatus === 'LOADING') return
            if (poiStatus === 'OK') setShowPois(!showPois)
            else fetchNearby(location.lat, location.lng)
          }}
          className={cn(
            'font-bold tracking-wider rounded transition-all border',
            board ? 'px-4 py-2 text-base' : 'px-2 py-1 text-[9px]',
            poiStatus === 'LOADING'
              ? 'bg-pantom-gold/10 text-pantom-gold border-pantom-gold/40 animate-pulse cursor-wait'
              : poiStatus === 'OK' && showPois
                ? 'bg-pantom-blue/20 text-pantom-blue border-pantom-blue/40'
                : 'bg-pantom-border/40 text-pantom-textMuted border-transparent hover:text-pantom-blue'
          )}
        >
          <MapPin className={cn('inline mr-1', board ? 'h-4 w-4' : 'h-2.5 w-2.5')} />
          {poiStatus === 'LOADING' ? 'FETCHING' : poiStatus === 'ERROR' ? 'RETRY' : poiStatus === 'OK' ? `NEARBY ${pois.length}` : 'NEARBY'}
        </button>
      </div>

      {/* Map Canvas */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
        <svg ref={svgRef} className={cn('w-full h-full', placeMode && 'cursor-crosshair')} viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet" style={{ transformOrigin: 'center center' }} onClick={handleSvgClick}>
          <defs>
            <radialGradient id="pulseGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#EDB40B" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#EDB40B" stopOpacity="0" />
            </radialGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid */}
          <g stroke="#2a2f3e" strokeWidth="0.5" opacity="0.35">
            {[0, 50, 100, 150, 200, 250, 300].map((v) => (
              <g key={v}>
                <line x1={v} y1={0} x2={v} y2={300} />
                <line x1={0} y1={v} x2={300} y2={v} />
              </g>
            ))}
          </g>

          {/* Range circles */}
          <circle cx="150" cy="150" r="50" fill="none" stroke="#EDB40B" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
          <circle cx="150" cy="150" r="100" fill="none" stroke="#EDB40B" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />
          <circle cx="150" cy="150" r="150" fill="none" stroke="#EDB40B" strokeWidth="1" strokeDasharray="4 4" opacity="0.1" />

          {/* Connections from center */}
          <g stroke="#EDB40B" strokeWidth="1" opacity="0.35">
            {visible.map((s) => (
              <line key={s.id} x1={150} y1={150} x2={s.x} y2={s.y} strokeDasharray="5 5" />
            ))}
          </g>

          {/* Incident heatmap */}
          {heatOn && alerts.filter((a) => a.lat != null && a.lng != null).map((a) => {
            const p = project(a.lat as number, a.lng as number)
            const cfg = HEAT_CONFIG[a.severity]
            return (
              <g key={a.incidentId} className="pointer-events-none">
                <circle cx={p.x} cy={p.y} r={cfg.radius} fill={cfg.color} opacity="0.15" />
                <circle cx={p.x} cy={p.y} r={cfg.radius * 0.55} fill={cfg.color} opacity="0.28" />
                <circle cx={p.x} cy={p.y} r={2.5} fill={cfg.color} />
              </g>
            )
          })}

          {/* Stations */}
          {visible.map((s) => {
            const color = SERVICE_META[s.type].color
            return (
              <g key={s.id}>
                {s.online && (
                  <motion.circle
                    cx={s.x}
                    cy={s.y}
                    r={16}
                    fill="url(#pulseGradient)"
                    animate={{ r: [13, 20], opacity: [0.45, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: s.port % 3 * 0.4 }}
                    filter="url(#glow)"
                  />
                )}
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={10}
                  fill={color}
                  stroke="#0a0e1c"
                  strokeWidth={2}
                  filter={s.online ? 'url(#glow)' : undefined}
                  opacity={s.online ? 1 : 0.4}
                  className="cursor-pointer transition-all"
                  onClick={() => setSelected(s)}
                />
                <text
                  x={s.x}
                  y={s.y - 17}
                  textAnchor="middle"
                  fontSize="8"
                  fontFamily="monospace"
                  fill={s.online ? '#f0f2f5' : '#5a5f6e'}
                  className="pointer-events-none"
                >
                  {s.name.length > 14 ? s.name.substring(0, 12) + '…' : s.name}
                </text>
                <text
                  x={s.x}
                  y={s.y + 17}
                  textAnchor="middle"
                  fontSize="7"
                  fontFamily="monospace"
                  fill={s.online ? color : '#5a5f6e'}
                  className="pointer-events-none"
                >
                  {formatDistance(s.distanceKm)}
                </text>
              </g>
            )
          })}

          {/* Real nearby POIs (OpenStreetMap) */}
          {showPois && nearestPois.map(({ p, km }) => {
            const pt = project(p.lat, p.lng)
            const meta = POI_META[p.type]
            const sel = selPoi?.id === p.id
            const label = nearestPois.findIndex((x) => x.p.id === p.id) < 6
            return (
              <g key={p.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelPoi(sel ? null : p) }}>
                {sel && <circle cx={pt.x} cy={pt.y} r={10} fill="none" stroke={meta.color} strokeWidth={1} strokeDasharray="2 2" />}
                <rect
                  x={pt.x - 3}
                  y={pt.y - 3}
                  width={6}
                  height={6}
                  rx={1}
                  transform={`rotate(45 ${pt.x} ${pt.y})`}
                  fill={meta.color}
                  stroke="#0a0e1c"
                  strokeWidth={1}
                  opacity={0.95}
                />
                {(label || sel) && (
                  <text x={pt.x} y={pt.y + 13} textAnchor="middle" fontSize="5.5" fontFamily="monospace" fontWeight="bold" fill={meta.color} className="pointer-events-none">
                    {p.name.length > 24 ? p.name.slice(0, 22) + '…' : p.name}
                  </text>
                )}
                {sel && (
                  <text x={pt.x} y={pt.y + 20} textAnchor="middle" fontSize="5.5" fontFamily="monospace" fill="#8b909e" className="pointer-events-none">
                    {km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(1) + 'km'}
                  </text>
                )}
              </g>
            )
          })}

          {/* User at center */}
          <circle cx="150" cy="150" r="12" fill="#EDB40B" stroke="#0a0e1c" strokeWidth={2} filter="url(#glow)" />
          <text x="150" y="142" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#EDB40B" fontWeight="bold" className="pointer-events-none">
            YOU
          </text>
          <text x="150" y="172" textAnchor="middle" fontSize="6.5" fontFamily="monospace" fill="#8b909e" className="pointer-events-none">
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </text>

          {/* Mesh nodes */}
          {meshNodes.filter((n) => n.id !== (ownNodeId ?? SENDER_NODE_ID)).map((n) => {
            const p = project(n.lat, n.lng)
            const km = nodeDistanceKm(location.lat, location.lng, n.lat, n.lng)
            const hops = nodeHops(km)
            const emergency = n.status === 'EMERGENCY'
            return (
              <g key={n.id} className={cn(onNodeClick && 'cursor-pointer')} onClick={(e) => { e.stopPropagation(); onNodeClick?.(n) }}>
                {emergency && (
                  <motion.circle
                    cx={p.x}
                    cy={p.y}
                    r={14}
                    fill="none"
                    stroke="#E10600"
                    strokeWidth={2}
                    animate={{ r: [10, 20], opacity: [0.8, 0] }}
                    transition={{ duration: 1.1, repeat: Infinity }}
                  />
                )}
                {emergency && (
                  <motion.circle
                    cx={p.x}
                    cy={p.y}
                    r={16}
                    fill="url(#pulseGradient)"
                    animate={{ r: [13, 22], opacity: [0.5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={emergency ? 6 : 4.5}
                  fill={emergency ? '#E10600' : hops <= 2 ? '#EDB40B' : '#5a5f6e'}
                  stroke="#0a0e1c"
                  strokeWidth={1.5}
                  filter={emergency ? 'url(#glow)' : undefined}
                  opacity={emergency ? 1 : hops <= 2 ? 0.9 : 0.55}
                />
                <text
                  x={p.x}
                  y={p.y + (emergency ? 16 : 14)}
                  textAnchor="middle"
                  fontSize="6.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill={emergency ? '#E10600' : hops <= 2 ? '#EDB40B' : '#5a5f6e'}
                  className="pointer-events-none"
                >
                  {n.id}
                </text>
                {emergency && n.incidentId && (
                  <text
                    x={p.x}
                    y={p.y - 12}
                    textAnchor="middle"
                    fontSize="6"
                    fontFamily="monospace"
                    fill="#E10600"
                    className="pointer-events-none"
                  >
                    ⚠ {n.incidentId}
                  </text>
                )}
              </g>
            )
          })}

          {/* Units en route */}
          {alerts.flatMap((a) =>
            a.acks
              .filter((k) => k.status === 'DISPATCHING')
              .map((ack) => {
                const station = stations.find((st) => st.type === ack.type)
                if (!station) return null
                const from = { x: station.x, y: station.y }
                const etaMin = ack.etaMinutes ?? 5
                const remaining = Math.max(0, Math.ceil(etaMin - (now - ack.ts) / 60000))
                const dur = Math.min(10, Math.max(4, etaMin * 1.2))
                return (
                  <g key={`${a.incidentId}-${ack.type}`}>
                    <motion.circle
                      cx={from.x}
                      cy={from.y}
                      r={7}
                      fill="#EDB40B"
                      stroke="#0a0e1c"
                      strokeWidth={2}
                      filter="url(#glow)"
                      initial={false}
                      animate={{ cx: 150, cy: 150 }}
                      transition={{ duration: dur, ease: 'easeInOut' }}
                      className="pointer-events-none"
                    />
                    <motion.text
                      x={from.x}
                      y={from.y}
                      fontSize="7"
                      fontFamily="monospace"
                      fill="#f0f2f5"
                      fontWeight="bold"
                      textAnchor="middle"
                      initial={false}
                      animate={{ x: 150, y: 168 }}
                      transition={{ duration: dur, ease: 'easeInOut' }}
                      className="pointer-events-none"
                    >
                      EN ROUTE {remaining}m
                    </motion.text>
                  </g>
                )
              })
          )}
        </svg>
        </div>

        {placeMode && (
          <div className={cn('absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pantom-gold/15 border border-pantom-gold/50 z-10', board && 'px-4 py-2.5 gap-2')}>
            <PlusCircle className={cn('text-pantom-gold', board ? 'h-5 w-5' : 'h-3 w-3')} />
            <span className={cn('font-mono text-pantom-gold font-bold', board ? 'text-lg' : 'text-[9px]')}>PLACE MODE — CLICK MAP TO DROP A NODE</span>
          </div>
        )}

        {poiStatus === 'LOADING' && (
          <div className={cn('absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pantom-bg/85 border border-pantom-border z-10', board && 'px-4 py-2.5 gap-2')}>
            <span className="w-1.5 h-1.5 bg-pantom-gold rounded-full animate-pulse" />
            <span className={cn('font-mono text-pantom-gold animate-pulse', board ? 'text-lg' : 'text-[9px]')}>FETCHING REAL NEARBY PLACES…</span>
          </div>
        )}
        {poiStatus === 'ERROR' && (
          <div className={cn('absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pantom-bg/85 border border-pantom-red/40 z-10', board && 'px-4 py-2.5 gap-2')}>
            <AlertTriangle className={cn('text-pantom-red', board ? 'h-5 w-5' : 'h-3 w-3')} />
            <span className={cn('font-mono text-pantom-red', board ? 'text-lg' : 'text-[9px]')}>NEARBY OFFLINE — NO INTERNET, TAP NEARBY TO RETRY</span>
          </div>
        )}

        {stations.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-pantom-bg/40">
            <div className="text-center px-4">
              <Radio className={cn('mx-auto text-pantom-gold mb-2', board ? 'h-8 w-8' : 'h-5 w-5')} />
              <p className={cn('text-pantom-textMuted leading-relaxed', board ? 'text-2xl' : 'text-[11px]')}>
                No services discovered
              </p>
              <p className={cn('text-pantom-textDim font-mono mt-1', board ? 'text-base' : 'text-[9px]')}>
                run `npm run start:all` in emergency-services/server
              </p>
            </div>
          </div>
        )}

        {registryState !== 'ONLINE' && (
          <div className={cn('absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-pantom-bg/80 border z-10', standby ? 'border-pantom-gold/40' : 'border-pantom-red/40', board && 'px-4 py-2 gap-2')}>
            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', standby ? 'bg-pantom-gold' : 'bg-pantom-red')} />
            <span className={cn('font-mono', standby ? 'text-pantom-gold' : 'text-pantom-red', board ? 'text-lg' : 'text-[9px]')}>
              {standby ? 'NETWORK STANDBY — DEVICES UNLINKED' : 'REGISTRY OFFLINE — RETRYING…'}
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className={cn('border-t border-pantom-border/30 flex items-center justify-center gap-3 text-pantom-textMuted', board ? 'px-5 py-3 gap-5 text-base' : 'px-3 py-1.5 text-[9px]')}>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pantom-gold" />YOU</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#0099ff' }} />POLICE</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#00d47e' }} />HOSPITAL</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#EDB40B' }} />FIRE</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-500 opacity-40" />OFFLINE</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-500 opacity-40" />NODE</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E10600]" />EMERGENCY</div>
        <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rotate-45 bg-white/70" />REAL POI</div>
      </div>

      {/* Station Details */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="px-3 pb-3 pt-2 border-t border-pantom-border/30 bg-pantom-bg/50"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={cn('rounded-xl flex items-center justify-center', board ? 'w-12 h-12' : 'w-8 h-8')}
                style={{ background: `${SERVICE_META[selected.type].color}18` }}
              >
                {(() => {
                  const Icon = TYPE_ICONS[selected.type]
                  return <Icon className={cn('', board ? 'h-6 w-6' : 'h-4 w-4')} style={{ color: SERVICE_META[selected.type].color }} />
                })()}
              </div>
              <div>
                <p className={cn('font-mono text-pantom-gold', board ? 'text-xl' : 'text-[12px]')}>{selected.id}</p>
                <p className={cn('text-pantom-textMuted', board ? 'text-base' : 'text-[10px]')}>{selected.name}</p>
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="p-1 text-pantom-textMuted hover:text-pantom-gold"
              aria-label="Close details"
            >
              <X className={cn('', board ? 'h-6 w-6' : 'h-4 w-4')} />
            </button>
          </div>

          <div className={cn('grid grid-cols-3 gap-2 mb-3', board ? 'gap-3 text-lg' : 'text-[10px]')}>
            <div className="bg-pantom-border/30 rounded p-1.5 text-center">
              <p className="text-pantom-textMuted">TYPE</p>
              <p className="font-mono" style={{ color: SERVICE_META[selected.type].color }}>{selected.type}</p>
            </div>
            <div className="bg-pantom-border/30 rounded p-1.5 text-center">
              <p className="text-pantom-textMuted">DISTANCE</p>
              <p className="font-mono text-pantom-gold">{formatDistance(selected.distanceKm)}</p>
            </div>
            <div className="bg-pantom-border/30 rounded p-1.5 text-center">
              <p className="text-pantom-textMuted">LOAD</p>
              <p className={cn('font-mono', selected.load >= selected.capacity ? 'text-pantom-red' : 'text-pantom-green')}>
                {selected.load}/{selected.capacity}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sendAlertTo(selected.type, 'HIGH', `Station alert via port map — ${formatDistance(selected.distanceKm)} from user`)
              setSelected(null)
            }}
            disabled={!selected.online}
            className={cn(
              'w-full rounded-lg font-semibold transition-all flex items-center justify-center gap-2',
              board ? 'py-3.5 text-2xl' : 'py-2 text-sm',
              selected.online
                ? 'bg-pantom-gold text-pantom-bg hover:shadow-glow-gold'
                : 'bg-pantom-border text-pantom-textDim cursor-not-allowed'
            )}
          >
            <AlertTriangle className={cn('', board ? 'h-6 w-6' : 'h-3.5 w-3.5')} />
            {selected.online ? 'SEND ALERT TO STATION' : 'STATION OFFLINE'}
          </button>
        </motion.div>
      )}
    </motion.div>
  )
}