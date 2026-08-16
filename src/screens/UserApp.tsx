'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, MessageSquareText, History, Building2, Settings, HeartPulse, ShieldAlert, Flame, Layers,
  MapPin, Phone, Flashlight, Volume2, Info, Check, Siren, Crosshair, FlaskConical, Trash2, Copy,
  Ban, Lock, ShieldOff, Send, Radio, Clock, Navigation, Zap, ChevronDown, Lightbulb, Globe, Waves,
  Network, Wifi, Activity, RefreshCw, ArrowDownRight, LockKeyhole, TriangleAlert, Languages, Map, Maximize2, X, Battery, SignalHigh, Smartphone, Bell, Camera,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SERVICE_META, type ServiceType, type Severity } from '@/lib/emergencyStore'
import { type Message } from '@/lib/messageStore'
import { incidentBus } from '@/lib/emergencyClient'
import { useEmergencyClient } from '@/hooks/useEmergencyClient'
import { nodeDistanceKm, nodeHops, MESH_RANGE_KM, meshMessageBus } from '@/lib/meshStore'
import { findMeshRoute } from '@/lib/meshRoute'
import { usePoiStore, POI_META } from '@/lib/poiStore'
import { t } from '@/lib/i18n'
import { type DeviceContext } from '@/lib/deviceContext'
import { type DeviceProfile, DEVICE_PROFILES } from '@/lib/deviceProfiles'
import { PortMap } from '@/components'

const SERVICE_COLOR: Record<ServiceType, string> = { POLICE: '#3B82F6', HOSPITAL: '#EF4444', FIRE: '#F97316' }
const TYPE_ICONS = { POLICE: Siren, HOSPITAL: HeartPulse, FIRE: Flame } as const
const SEV_COLOR: Record<Severity, string> = { CRITICAL: '#DC2626', HIGH: '#F97316', MEDIUM: '#F59E0B', LOW: '#22C55E' }

const CATEGORIES = [
  { id: 'MEDICAL', label: 'Medical', icon: HeartPulse, sev: 'CRITICAL' as const, msg: 'Medical emergency — immediate help required', color: '#EF4444' },
  { id: 'CRIME', label: 'Crime', icon: ShieldAlert, sev: 'HIGH' as const, msg: 'Crime in progress — need police', color: '#3B82F6' },
  { id: 'FIRE', label: 'Fire', icon: Flame, sev: 'CRITICAL' as const, msg: 'Fire — evacuating, need fire brigade', color: '#F97316' },
  { id: 'COMBO', label: 'Combo', icon: Layers, sev: 'CRITICAL' as const, msg: 'Multiple emergencies — send all units', color: '#8B5CF6' },
] as const
type CategoryId = (typeof CATEGORIES)[number]['id']

const HOLD_MS = 3000
const RING_C = 2 * Math.PI * 40
const fmtClock = (ms: number) => `${Math.floor(Math.max(0, ms) / 1000 / 60)}:${String(Math.floor(Math.max(0, ms) / 1000) % 60).padStart(2, '0')}`
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtRel = (ts: number) => {
  const d = Date.now() - ts
  if (d < 60000) return 'now'
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
  return fmtTime(ts)
}

const TIPS = [
  { t: 'Hold SOS for 3 full seconds', d: 'The button only fires on a deliberate press-and-hold — release early to cancel.' },
  { t: 'Pick a category before you press', d: 'Medical, Crime, Fire or Combo tags your alert so the right units arrive first.' },
  { t: 'Share live location', d: 'Starts GPS tracking that stays on until every service marks your incident resolved.' },
  { t: 'Replies go to all or one station', d: 'In CHAT choose ALL, POLICE, HOSPITAL or FIRE — the whole mesh hears you.' },
  { t: 'Check receipts after sending', d: 'HISTORY shows sent → acked → dispatched → resolved times for every service.' },
  { t: 'Drill mode is safe', d: 'TEST alerts are tagged DRILL — services know it is a simulation.' },
  { t: 'The mesh stores & forwards', d: 'If a station is offline, your alert waits in queue and flushes when it reconnects.' },
  { t: 'Escalation is automatic', d: 'Unanswered CRITICAL alerts escalate to all services after 30s.' },
]

type Tab = 'HOME' | 'CHAT' | 'HISTORY' | 'SERVICES' | 'NETWORK' | 'MORE'

type PermKey = 'location' | 'notifications' | 'camera'

function OnboardingScreen({
  profile,
  perms,
  onGrant,
  onEnter,
}: {
  profile: DeviceProfile
  perms: Record<PermKey, boolean>
  onGrant: (which: PermKey) => void
  onEnter: () => void
}) {
  const items: { key: PermKey; icon: typeof MapPin; label: string; desc: string; granted: boolean }[] = [
    { key: 'location', icon: MapPin, label: 'LOCATION', desc: 'Live map, SOS coordinates and nearby help on the port map.', granted: perms.location },
    { key: 'notifications', icon: Bell, label: 'NOTIFICATIONS', desc: 'Dispatch replies and escalation alerts even in the background.', granted: perms.notifications },
    { key: 'camera', icon: Camera, label: 'CAMERA', desc: 'Photo evidence attached to your incident for the responding unit.', granted: perms.camera },
  ]
  const done = items.every((i) => i.granted)
  return (
    <div className="relative w-full h-full flex flex-col bg-calm-bg text-calm-text overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-2 flex items-center justify-center" style={{ background: `${profile.accent}18`, border: `1px solid ${profile.accent}44` }}>
            <Waves className="h-6 w-6" style={{ color: profile.accent }} />
          </div>
          <p className="text-[13px] font-extrabold tracking-[0.25em]" style={{ color: profile.accent }}>{profile.deviceName}</p>
          <p className="text-[10px] font-mono text-calm-textMuted mt-0.5">{profile.userId} · NODE {profile.meshNode} · {profile.model}</p>
          <p className="text-[9px] font-mono text-calm-textDim mt-1">PANTOM — peer-to-peer emergency mesh</p>
        </div>

        <p className="text-[9px] font-black tracking-[0.2em] text-calm-textDim mb-2">FIRST LAUNCH · PERMISSIONS</p>
        <div className="space-y-2">
          {items.map((it) => {
            const Icon = it.icon
            return (
              <div key={it.key} className="rounded-xl border bg-calm-surface p-2.5 flex items-center gap-2.5" style={{ borderColor: it.granted ? `${profile.accent}55` : 'var(--color-calm-border)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${it.granted ? profile.accent : '#8b909e'}1a` }}>
                  <Icon className="h-4 w-4" style={{ color: it.granted ? profile.accent : '#8b909e' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold" style={{ color: it.granted ? profile.accent : 'inherit' }}>{it.label} {it.granted && '✓'}</p>
                  <p className="text-[8px] font-mono text-calm-textMuted leading-snug">{it.desc}</p>
                </div>
                <button
                  onClick={() => onGrant(it.key)}
                  disabled={it.granted}
                  className={cn('px-3 py-1.5 rounded-lg text-[8px] font-black tracking-wider transition-all active:scale-95 shrink-0', it.granted ? 'text-calm-textDim cursor-default' : 'text-white')}
                  style={it.granted ? { background: '#1E293B' } : { background: profile.accent }}
                >
                  {it.granted ? 'GRANTED' : 'ALLOW'}
                </button>
              </div>
            )
          })}
        </div>
        <p className="text-[8px] font-mono text-calm-textDim mt-2 leading-relaxed">
          Everything else runs automatically — mesh join, service discovery, store-and-forward, escalation. You only ever grant what the SOS flow needs.
        </p>
      </div>

      <div className="px-4 pb-4 pt-2">
        <button
          onClick={onEnter}
          className={cn('w-full py-3 rounded-xl text-[10px] font-black tracking-[0.25em] transition-all active:scale-[0.98]', done ? 'text-white' : 'text-calm-textDim')}
          style={{ background: done ? profile.accent : '#1E293B' }}
        >
          {done ? `ENTER ${profile.deviceName}` : 'GRANT PERMISSIONS TO CONTINUE'}
        </button>
        {!done && (
          <button onClick={onEnter} className="w-full mt-1.5 text-center text-[8px] font-bold tracking-wider text-calm-textDim py-1">
            SKIP FOR NOW →
          </button>
        )}
      </div>
    </div>
  )
}

const MSG_STATUS: Record<Message['status'], { color: string; label: string }> = {
  QUEUED: { color: '#94A3B8', label: 'QUEUED' },
  TRANSMITTING: { color: '#3B82F6', label: 'TRANSMITTING' },
  RELAYING: { color: '#F59E0B', label: 'RELAYING' },
  DELIVERED: { color: '#22C55E', label: 'DELIVERED' },
  FAILED: { color: '#DC2626', label: 'FAILED' },
  STORED: { color: '#94A3B8', label: 'STORED' },
  RECEIVED: { color: '#22C55E', label: 'RECEIVED' },
  READ: { color: '#64748B', label: 'READ' },
}

const RADIO = { band: '915 MHz', channel: 12, txPower: '22 dBm', snr: '9.4 dB', dutyCycle: '3.2%', firmware: 'PANTOM v0.9.4-alpha' }

export function UserApp({ device }: { device: DeviceContext }) {
  const { store, client, messageStore, linkStore, meshStore, langStore, profile } = device
  const appId = device.appId
  const senderName = profile.deviceName
  const conn = store((s) => s.conn)
  const services = store((s) => s.services)
  const alerts = store((s) => s.alerts)
  const chat = store((s) => s.chat)
  const location = store((s) => s.location)
  const tracking = store((s) => s.tracking)
  const degraded = store((s) => s.degraded)
  const standby = store((s) => s.standby)
  const blocked = store((s) => s.blocked)
  const notices = store((s) => s.notices)
  const dismissNotice = store((s) => s.dismissNotice)
  const addLog = store((s) => s.addLog)
  const addNotice = store((s) => s.addNotice)
  const toggleBlocked = store((s) => s.toggleBlocked)
  const removeChat = store((s) => s.removeChat)
  const clearChat = store((s) => s.clearChat)
  const clearAlerts = store((s) => s.clearAlerts)
  const linked = linkStore((s) => s.linked)
  const autoRelinkAt = linkStore((s) => s.autoRelinkAt)
  const remoteAlerts = alerts.filter(
    (a) => a.sourceId && a.sourceId !== profile.userId && a.acks.some((k) => k.status !== 'RESOLVED')
  )
  const meshMsgs = messageStore((s) => s.messages)
  const receiveMesh = messageStore((s) => s.receiveMessage)
  const sendMesh = messageStore((s) => s.sendMessage)

  const { lang, setLang } = langStore()


  const { sendAlert, sendChat, sendChatTo, requestLocation, stopLiveTracking, replayIncident, setDegraded, ackIncident, dispatchIncident, sendIncidentChat, sendNote, cancelAlert, reportSafety } = useEmergencyClient(client)
  const [tab, setTab] = useState<Tab>('HOME')
  const [category, setCategory] = useState<CategoryId>('MEDICAL')
  const SETTINGS_KEY = `pantom-device-${appId.toLowerCase()}-settings`
  const [medical, setMedical] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
      return typeof raw.medical === 'string' ? raw.medical : profile.medical
    } catch {
      return profile.medical
    }
  })
  const [testMode, setTestMode] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').testMode === true
    } catch {
      return false
    }
  })
  const [silent, setSilent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').silent === true
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ medical, testMode, silent }))
    } catch {
      // ignore
    }
  }, [SETTINGS_KEY, medical, testMode, silent])
  const [torch, setTorch] = useState(false)
  const [siren, setSiren] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(false)
  const ONBOARD_KEY = `${SETTINGS_KEY}-onboarded`
  const [onboarded, setOnboarded] = useState(() => {
    try {
      return localStorage.getItem(ONBOARD_KEY) === '1'
    } catch {
      return false
    }
  })
  const [perms, setPerms] = useState<{ location: boolean; notifications: boolean; camera: boolean }>({
    location: false,
    notifications: false,
    camera: false,
  })
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const [fired, setFired] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ServiceType | null>(null)
  const [chatTarget, setChatTarget] = useState<ServiceType | 'ALL'>('ALL')
  const [chatText, setChatText] = useState('')
  const [actionMsg, setActionMsg] = useState<(typeof chat)[number] | null>(null)
  const [copied, setCopied] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [netView, setNetView] = useState<'FABRIC' | 'NODE'>('FABRIC')
  const [mapFull, setMapFull] = useState(false)
  const [simDrift, setSimDrift] = useState(false)
  const [msgTo, setMsgTo] = useState('')
  const [now, setNow] = useState(Date.now())
  const [roomFor, setRoomFor] = useState<string | null>(null)
  const [roomText, setRoomText] = useState('')
  const [noteText, setNoteText] = useState('')

  const liveDispatched = alerts.some((a) => a.acks.some((k) => k.status === 'DISPATCHING'))
  useEffect(() => {
    if (!liveDispatched) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [liveDispatched])

  useEffect(() => {
    if (notices.length === 0) return
    const id = window.setTimeout(() => dismissNotice(notices[notices.length - 1].id), 6000)
    return () => window.clearTimeout(id)
  }, [notices])

  useEffect(() => {
    if (!simDrift) return
    const id = window.setInterval(() => {
      const { location: loc } = store.getState()
      const t = Date.now() / 1000
      moveTo(loc.lat + 0.0006 * Math.sin(t / 2), loc.lng + 0.0006 * Math.cos(t / 2))
    }, 1000)
    return () => window.clearInterval(id)
  }, [simDrift, moveTo])
  const [msgText, setMsgText] = useState('')
  const [msgPriority, setMsgPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL')
  const [nodeScan, setNodeScan] = useState(false)
  const [standbyHint, setStandbyHint] = useState(false)
  const meshStoreNodes = meshStore((s) => s.nodes)
  const setNodeEmergency = meshStore((s) => s.setNodeEmergency)
  const devices = store((s) => s.devices)
  const meshNodes = useMemo(() => {
    const byId = new globalThis.Map<string, { id: string; lat: number; lng: number; status: 'NORMAL' | 'EMERGENCY'; incidentId?: string }>(meshStoreNodes.map((n) => [n.id, n]))
    for (const d of devices) {
      const ex = byId.get(d.nodeId)
      byId.set(d.nodeId, ex ? { ...ex, lat: d.lat, lng: d.lng } : { id: d.nodeId, lat: d.lat, lng: d.lng, status: 'NORMAL' })
    }
    return [...byId.values()]
  }, [meshStoreNodes, devices])
  const pois = usePoiStore((s) => s.pois)
  const poiStatus = usePoiStore((s) => s.status)
  const fetchNearby = usePoiStore((s) => s.fetchNearby)
  const holdStart = useRef(0)
  const raf = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!holding) return
    holdStart.current = performance.now()
    const tick = () => {
      const p = Math.min(1, (performance.now() - holdStart.current) / HOLD_MS)
      setProgress(p)
      if (p >= 1) { setHolding(false); fire(); return }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [holding])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.length])

  useEffect(() => {
    if (poiStatus === 'IDLE') fetchNearby(location.lat, location.lng)
  }, [])

  useEffect(() => {
    const unsub = meshMessageBus.subscribe((msg) => {
      if (msg.to !== profile.meshNode) return
      receiveMesh({ id: msg.id, from: msg.from, to: msg.to, content: msg.content, priority: msg.priority as Message['priority'], route: msg.route, timestamp: msg.timestamp })
      addLog('MESH', `Received E2E message from ${msg.from} (${msg.content.slice(0, 24)})`)
      addNotice({ id: `mesh-in-${msg.id}`, kind: 'SYSTEM', text: `MESH MSG from ${msg.from}: ${msg.content}`, ts: Date.now() })
    })
    return unsub
  }, [profile.meshNode, receiveMesh, addLog, addNotice])

  useEffect(() => {
    return incidentBus.subscribe((e) => {
      if (e.type === 'ALERT_ACK') {
        store.getState().updateAck(e.incidentId, e.svc, {
          serviceId: e.serviceId,
          name: e.name,
          status: 'ACKED',
          etaMinutes: e.etaMinutes,
          ts: Date.now(),
        })
      } else if (e.type === 'DISPATCH_UPDATE') {
        store.getState().updateAck(e.incidentId, e.svc, {
          serviceId: e.serviceId,
          name: e.name,
          status: e.status,
          note: e.note,
          ts: Date.now(),
        })
        if (e.status === 'RESOLVED') meshStore.getState().resolveByIncident(e.incidentId)
      } else if (e.type === 'CHAT') {
        const s = store.getState()
        if (!s.chat.some((c) => c.from === e.from && c.text === e.text && Date.now() - c.ts < 5000)) {
          s.addChat({ from: e.from, text: e.text, ts: Date.now(), scope: e.scope })
        }
      } else if (e.type === 'INCIDENT_CHAT') {
        const s = store.getState()
        if (!s.chat.some((c) => c.from === e.from && c.text === e.text && c.incidentId === e.incidentId && Date.now() - c.ts < 5000)) {
          s.addChat({ from: e.from, text: e.text, ts: Date.now(), scope: e.scope, incidentId: e.incidentId })
        }
      } else if (e.type === 'INCIDENT_NOTE') {
        store.getState().addNote(e.incidentId, { from: e.from, text: e.text, ts: Date.now() })
      } else if (e.type === 'SAFETY_UPDATE') {
        store.getState().markSafety(e.incidentId, e.safe)
      } else if (e.type === 'ALERT_CANCEL') {
        store.getState().cancelAlert(e.incidentId)
      }
    })
  }, [store, meshStore])

  const [relinkNow, setRelinkNow] = useState(Date.now())
  useEffect(() => {
    if (!autoRelinkAt) return
    const id = window.setInterval(() => {
      setRelinkNow(Date.now())
      if (Date.now() >= autoRelinkAt) linkStore.getState().relinkNow()
    }, 250)
    return () => window.clearInterval(id)
  }, [autoRelinkAt])
  const relinkRemain = autoRelinkAt ? Math.max(0, Math.ceil((autoRelinkAt - relinkNow) / 1000)) : 0

  const cat = CATEGORIES.find((c) => c.id === category)!
  const trust = (() => {
    let score = 98
    if (testMode) score -= 10
    return { trustScore: score, verified: score >= 70 }
  })()
  const sendChatMsg = () => {
    const msg = chatText.trim()
    if (!msg) return
    if (chatTarget === 'ALL') sendChat(msg)
    else sendChatTo(chatTarget, msg)
  }
  const fire = async () => {
    const photo = perms.camera ? await client.capturePhoto({ cameraAllowed: true, severity: cat.sev, deviceName: profile.deviceName }) : undefined
    const id = sendAlert(cat.sev, cat.msg, { medical: medical || undefined, testMode, photo })
    setProgress(0)
    setFired(id.incidentId)
  }
  const release = () => { if (holding) { setHolding(false); setProgress(0) } }

  const grantPermission = (which: PermKey) => {
    if (which === 'location') {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => client.moveTo(pos.coords.latitude, pos.coords.longitude),
          () => { /* denied — stays on home coords */ },
          { timeout: 6000, maximumAge: 30000 },
        )
      }
      setPerms((p) => ({ ...p, location: true }))
    } else if (which === 'notifications') {
      try {
        if ('Notification' in window) void Notification.requestPermission()
      } catch { /* ignore */ }
      setPerms((p) => ({ ...p, notifications: true }))
    } else {
      try {
        navigator.mediaDevices?.getUserMedia({ video: true }).then((s) => s.getTracks().forEach((tr) => tr.stop())).catch(() => {})
      } catch { /* ignore */ }
      setPerms((p) => ({ ...p, camera: true }))
    }
  }
  const enterApp = () => {
    setOnboarded(true)
    try {
      localStorage.setItem(ONBOARD_KEY, '1')
    } catch { /* ignore */ }
    store.getState().addLog('SYSTEM', 'First-launch permissions granted — PANTOM fully operational')
    if (perms.location) client.requestLocation()
  }

  const sentAlert = fired ? alerts.find((a) => a.incidentId === fired) : null
  const connected = (['POLICE', 'HOSPITAL', 'FIRE'] as ServiceType[]).filter((t) => conn[t] === 'ONLINE').length
  const nearestPois = useMemo(
    () =>
      [...pois]
        .map((p) => ({ p, km: nodeDistanceKm(location.lat, location.lng, p.lat, p.lng) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 6),
    [pois, location]
  )
  const nearbyNodes = meshNodes
    .filter((n) => n.id !== profile.meshNode)
    .map((n) => ({ node: n, km: nodeDistanceKm(location.lat, location.lng, n.lat, n.lng) }))
    .sort((a, b) => a.km - b.km)
  const inRange = nearbyNodes.filter((x) => x.km <= MESH_RANGE_KM)
  const diagLinks = nearbyNodes.map(({ node, km }) => {
    const hops = nodeHops(km)
    return { id: node.id, hops, rssi: Math.round(-40 - km * 12), quality: Math.max(45, Math.min(97, Math.round(100 - km * 9))), relay: hops > 1 }
  })
  const pktSuccess = Math.round(((profile.packets.sent - profile.packets.lost) / profile.packets.sent) * 100)
  const threadMsgs = msgTo ? meshMsgs.filter((m) => m.to === msgTo || m.from === msgTo) : meshMsgs
  const shownMsgs = msgTo ? threadMsgs.slice().reverse() : meshMsgs.slice().reverse()
  const sendMeshMsg = () => {
    const to = msgTo.trim().toUpperCase()
    const target = meshNodes.find((n) => n.id === to)
    if (!target || target.id === profile.meshNode) return
    const km = nodeDistanceKm(location.lat, location.lng, target.lat, target.lng)
    if (km > MESH_RANGE_KM) return
    const route = findMeshRoute(meshNodes, profile.meshNode, to)
    if (!route) return
    const sent = sendMesh({ from: profile.meshNode, to, content: msgText.trim(), priority: msgPriority, directAvailable: route.path.length === 2, route: route.path })
    meshMessageBus.publish({ id: sent.id, from: sent.from, to: sent.to, content: sent.content, priority: sent.priority, route: sent.route, timestamp: sent.timestamp })
    client.sendMeshMessage({ id: sent.id, from: sent.from, to: sent.to, content: sent.content, priority: sent.priority, route: sent.route })
    if (msgPriority === 'URGENT') {
      const { incidentId } = sendAlert('HIGH', `MESH EMERGENCY — node ${to} requires emergency assistance (${route.path.length - 1} hops via ${route.path.slice(1, -1).join(' → ') || 'direct'})`)
      setNodeEmergency(to, incidentId)
    }
    setMsgText('')
    setMsgTo('')
  }
  const visibleChat = chat.filter(
    (c) =>
      !c.incidentId &&
      !(c.scope !== 'ALL' && blocked.includes(c.scope as ServiceType)) &&
      (chatTarget === 'ALL' || c.scope === chatTarget)
  )
  const combinedChat = [...visibleChat, ...meshMsgs.map((m) => ({ mesh: true, id: `mesh-${m.id}`, from: m.from, to: m.to, text: m.content, ts: m.timestamp, scope: 'ALL' as const, status: m.status, priority: m.priority }))]
    .sort((a, b) => a.ts - b.ts)
  const distTo = (svc: { lat: number; lng: number }) => {
    const km = Math.sqrt((svc.lat - location.lat) ** 2 * 110.57 ** 2 + (svc.lng - location.lng) ** 2 * (111.32 * Math.cos((location.lat * Math.PI) / 180)) ** 2)
    return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`
  }
  const responseFor = (type: ServiceType) => {
    const ts = alerts.flatMap((a) => a.acks.filter((k) => k.type === type && k.status !== 'OPEN').map((k) => k.ts - a.sentAt))
    return ts.length ? `${Math.round(ts.reduce((x, y) => x + y, 0) / ts.length)}s` : '—'
  }
  const copyMsg = async () => {
    if (!actionMsg) return
    try { await navigator.clipboard.writeText(actionMsg.text); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch { /* noop */ }
    setActionMsg(null)
  }

  const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: 'HOME', label: 'Home', icon: Home },
    { id: 'CHAT', label: 'Chat', icon: MessageSquareText },
    { id: 'HISTORY', label: 'History', icon: History },
    { id: 'SERVICES', label: 'Services', icon: Building2 },
    { id: 'NETWORK', label: 'Network', icon: Network },
    { id: 'MORE', label: 'More', icon: Settings },
  ]

  if (!onboarded) {
    return <OnboardingScreen profile={profile} perms={perms} onGrant={grantPermission} onEnter={enterApp} />
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-calm-bg text-calm-text overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] font-extrabold tracking-[0.22em]" style={{ color: profile.accent }}>{profile.deviceName}</p>
            <span className="px-1 py-px rounded text-[6.5px] font-black tracking-widest border" style={{ color: profile.accent, borderColor: `${profile.accent}55`, background: `${profile.accent}11` }}>
              NODE {profile.meshNode}
            </span>
          </div>
          <p className="text-[9px] font-mono text-calm-textMuted">{profile.userId} · {profile.model} · {profile.os}</p>
          <p className="text-[9px] font-mono text-calm-textMuted flex items-center gap-1.5">
            <span className="flex items-center gap-0.5"><Battery className="h-2.5 w-2.5" style={{ color: profile.battery < 25 ? '#DC2626' : '#22C55E' }} />{profile.battery}%</span>
            <span className="flex items-center gap-0.5"><SignalHigh className="h-2.5 w-2.5" style={{ color: '#22C55E' }} />{profile.signalDbm} dBm</span>
            <span>{profile.imei}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-black tracking-wider border', standby ? 'text-calm-textMuted border-calm-border' : 'text-calm-green border-calm-green/40 bg-calm-green/10')}>
            {standby ? 'STANDBY' : `LIVE ${connected}/3`}
          </span>
          <button
            onClick={() => {
              const s = linkStore.getState()
              if (s.linked) s.unlinkTemporarily()
              else s.relinkNow()
            }}
            className={cn('px-2 py-0.5 rounded-full text-[8px] font-black tracking-wider border', linked ? 'text-calm-green border-calm-green/40' : 'text-calm-gold border-calm-gold/40')}
          >
            {linked ? 'SYNC ALL' : relinkRemain > 0 ? `RELINK ${relinkRemain}s` : 'SYNC NONE'}
          </button>
        </div>
      </header>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 scrollbar-thin">
        {remoteAlerts.length > 0 && (
          <div className="pt-3">
            <div className="rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/40 p-2.5 flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-[#DC2626] flex-none animate-pulse" />
              <div className="min-w-0">
                <p className="text-[9px] font-black tracking-wider text-[#DC2626]">
                  EMERGENCY FROM {remoteAlerts[0].sourceId === 'USER-MOB-02' ? 'SAFEZONE-2' : 'SAFEZONE-1'} — {remoteAlerts[0].severity}
                </p>
                <p className="text-[8px] font-mono text-calm-textMuted truncate">
                  {remoteAlerts[0].incidentId} · {remoteAlerts[0].message}
                </p>
              </div>
              <span className="ml-auto flex items-center gap-1 text-[7.5px] font-mono text-calm-textDim">
                <span className="w-1.5 h-1.5 bg-[#DC2626] rounded-full animate-ping" /> LIVE
              </span>
            </div>
          </div>
        )}
        {tab === 'HOME' && (
          <div className="py-2 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(['POLICE', 'HOSPITAL', 'FIRE'] as ServiceType[]).map((t) => {
                const on = !standby && conn[t] === 'ONLINE'
                return (
                  <button key={t} onClick={() => setExpanded(expanded === t ? null : t)}
                    className="rounded-xl bg-calm-surface border shadow-sm px-2 py-2 text-left transition-all"
                    style={expanded === t ? { borderColor: SERVICE_COLOR[t] } : { borderColor: 'var(--color-calm-border)' }}>
                    <span className="flex items-center gap-1.5 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? SERVICE_COLOR[t] : '#CBD5E1' }} />
                      <span className="text-[9px] font-bold" style={{ color: SERVICE_COLOR[t] }}>{SERVICE_META[t].label}</span>
                    </span>
                    <span className={cn('text-[8px] font-mono font-semibold', on ? 'text-calm-green' : 'text-calm-textDim')}>{standby ? 'STANDBY' : on ? 'CONNECTED' : 'SYNCING…'}</span>
                  </button>
                )
              })}
            </div>

            <AnimatePresence>
              {expanded && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="rounded-xl bg-calm-surface border border-calm-border p-3">
                    {(() => {
                      const svc = services.find((s) => s.type === expanded)
                      const Icon = TYPE_ICONS[expanded]
                      return (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${SERVICE_COLOR[expanded]}18` }}>
                            <Icon className="h-4 w-4" style={{ color: SERVICE_COLOR[expanded] }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold truncate">{svc ? svc.name : `${SERVICE_META[expanded].label} dispatch`}</p>
                            <p className="text-[9px] font-mono text-calm-textMuted tabular-nums">{svc ? `load ${svc.currentLoad}/${svc.capacity} · uptime ${svc.uptime ?? 100}% · ${distTo(svc)} away` : 'discovering…'}</p>
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

            {/* Map — live port map */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[8px] font-bold tracking-widest text-calm-textMuted">
                  <Map className="h-3 w-3 text-calm-gold" /> LIVE PORT MAP
                </p>
                <div className="flex items-center gap-1.5">
                  <span className={cn('px-1.5 py-0.5 rounded-full text-[7px] font-black tracking-wider border', tracking === 'ON' || simDrift ? 'bg-calm-green/15 border-calm-green/40 text-calm-green animate-pulse' : 'bg-calm-border border-calm-border text-calm-textMuted')}>
                    {tracking === 'ON' || simDrift ? 'LIVE · MOVING' : 'LAST KNOWN'}
                  </span>
                  <button
                    onClick={() => setSimDrift(!simDrift)}
                    className={cn('px-2 py-0.5 rounded-lg text-[8px] font-black tracking-wider border active:scale-95 transition-all', simDrift ? 'bg-calm-gold text-white border-calm-gold' : 'bg-calm-surface border-calm-border text-calm-textMuted')}
                    aria-label="Simulate movement"
                  >
                    {simDrift ? 'MOVING…' : 'SIM MOVE'}
                  </button>
                  <button
                    onClick={() => setMapFull(true)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-calm-accent text-white text-[8px] font-black tracking-wider active:scale-95 transition-transform"
                    aria-label="Open full map"
                  >
                    <Maximize2 className="h-2.5 w-2.5" /> FULL
                  </button>
                </div>
              </div>
              <div className="h-56 rounded-2xl overflow-hidden border border-calm-border">
                <PortMap className="w-full h-full" client={client} meshStore={meshStore} ownNodeId={profile.meshNode} />
              </div>
            </div>

            {/* Categories */}
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => {
                const Icon = c.icon
                const active = category === c.id
                return (
                  <button key={c.id} onClick={() => setCategory(c.id)}
                    className={cn('rounded-xl py-2.5 flex flex-col items-center gap-1 border transition-all shadow-sm', active ? 'text-white' : 'bg-calm-surface border-calm-border text-calm-textMuted')}
                    style={active ? { background: c.color, borderColor: c.color } : undefined}>
                    <Icon className="h-4 w-4" />
                    <span className="text-[8px] font-bold tracking-wide">{c.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-4 gap-2">
              <a href="tel:112" className="rounded-xl bg-calm-surface border border-calm-border py-2.5 flex flex-col items-center gap-1 text-calm-textMuted active:scale-95 transition-transform">
                <Phone className="h-4 w-4 text-calm-green" /><span className="text-[8px] font-bold">CALL 112</span>
              </a>
              <button onClick={() => setTorch(!torch)} className={cn('rounded-xl border py-2.5 flex flex-col items-center gap-1 active:scale-95 transition-transform', torch ? 'bg-calm-gold/20 border-calm-gold text-calm-text' : 'bg-calm-surface border-calm-border text-calm-textMuted')}>
                <Flashlight className="h-4 w-4 text-calm-gold" /><span className="text-[8px] font-bold">TORCH</span>
              </button>
              <button onClick={() => { setSiren(!siren); if (!siren) { try { navigator.vibrate?.(600) } catch { /* noop */ } } }} className={cn('rounded-xl border py-2.5 flex flex-col items-center gap-1 active:scale-95 transition-transform', siren ? 'bg-calm-accent/20 border-calm-accent text-calm-text' : 'bg-calm-surface border-calm-border text-calm-textMuted')}>
                <Volume2 className={cn('h-4 w-4', siren && 'animate-pulse')} style={{ color: siren ? '#DC2626' : undefined }} /><span className="text-[8px] font-bold">{siren ? 'SIREN ON' : 'SIREN'}</span>
              </button>
              <button onClick={() => setTipsOpen(!tipsOpen)} className={cn('rounded-xl border py-2.5 flex flex-col items-center gap-1 active:scale-95 transition-transform', tipsOpen ? 'bg-calm-surface border-calm-textMuted text-calm-text' : 'bg-calm-surface border-calm-border text-calm-textMuted')}>
                <Lightbulb className="h-4 w-4 text-calm-gold" /><span className="text-[8px] font-bold">TIPS</span>
              </button>
            </div>

            {/* Real nearby POIs */}
            <div className="rounded-xl border border-calm-border bg-calm-surface overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-calm-border">
                <p className="flex items-center gap-1.5 text-[8px] font-bold tracking-widest text-calm-textMuted">
                  <MapPin className="h-3 w-3 text-calm-gold" /> REAL NEARBY — POLICE · HOSPITAL · FIRE
                </p>
                <button
                  onClick={() => fetchNearby(location.lat, location.lng)}
                  className={cn('px-2 py-0.5 rounded-md text-[7px] font-black tracking-wider border transition-all flex items-center gap-1', poiStatus === 'LOADING' ? 'bg-calm-gold/10 border-calm-gold/40 text-calm-gold' : 'bg-calm-bg border-calm-border text-calm-textMuted')}
                >
                  <RefreshCw className={cn('h-2.5 w-2.5', poiStatus === 'LOADING' && 'animate-spin')} />
                  {poiStatus === 'LOADING' ? 'FETCHING' : poiStatus === 'ERROR' ? 'RETRY' : 'REFRESH'}
                </button>
              </div>
              <div className="divide-y divide-calm-border/60">
                {poiStatus === 'IDLE' && <p className="px-3 py-3 text-[9px] font-mono text-calm-textDim">Fetching real nearby places…</p>}
                {poiStatus === 'LOADING' && <p className="px-3 py-3 text-[9px] font-mono text-calm-textDim animate-pulse">Contacting OpenStreetMap…</p>}
                {poiStatus === 'ERROR' && (
                  <p className="px-3 py-3 text-[9px] font-mono text-calm-textDim">No internet — could not fetch nearby places. Tap RETRY when online.</p>
                )}
                {poiStatus === 'OK' && nearestPois.length === 0 && (
                  <p className="px-3 py-3 text-[9px] font-mono text-calm-textDim">Nothing mapped within 3 km.</p>
                )}
                {poiStatus === 'OK' && nearestPois.map(({ p, km }) => {
                  const meta = POI_META[p.type]
                  return (
                    <div key={p.id} className="px-3 py-2 flex items-center gap-2.5">
                      <span className="w-2 h-2 rotate-45 flex-none rounded-[1px]" style={{ background: meta.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-calm-text truncate">{p.name}</p>
                        <p className="text-[7.5px] font-mono text-calm-textDim">{meta.label} · {p.lat.toFixed(4)}, {p.lng.toFixed(4)}</p>
                      </div>
                      <span className="font-mono text-[9px] text-calm-textMuted tabular-nums">{km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <AnimatePresence>
              {tipsOpen && (                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="rounded-xl bg-calm-surface border border-calm-border divide-y divide-calm-border">
                    {TIPS.map((tip) => (
                      <div key={tip.t} className="px-3 py-2">
                        <p className="text-[10px] font-bold text-calm-text flex items-center gap-1.5"><Info className="h-3 w-3 text-calm-gold" />{tip.t}</p>
                        <p className="text-[9px] text-calm-textMuted mt-0.5 leading-relaxed">{tip.d}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SOS */}
            <div className="flex items-center justify-center gap-5 py-3">
              <div className="text-right">
                <p className="text-[8px] font-mono text-calm-textDim tabular-nums">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
                <p className="text-[8px] font-mono text-calm-textDim flex items-center justify-end gap-1"><MapPin className="h-2.5 w-2.5" />{tracking === 'ON' ? 'LIVE TRACKING' : 'LAST KNOWN'}</p>
              </div>
              <motion.button
                onPointerDown={() => {
                  if (standby) {
                    setStandbyHint(true)
                    setTimeout(() => setStandbyHint(false), 1800)
                    return
                  }
                  setHolding(true)
                }}
                onPointerUp={release}
                onPointerLeave={release}
                whileTap={{ scale: 0.96 }}
                className={cn('relative w-24 h-24 rounded-full flex items-center justify-center select-none touch-none', standby && 'opacity-60 cursor-not-allowed')}
                aria-label="Hold to send emergency alert"
              >
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  {Array.from({ length: 12 }, (_, i) => {
                    const a = (i * 30 * Math.PI) / 180
                    const major = i % 3 === 0
                    const r1 = major ? 44 : 42.5
                    const r2 = major ? 38 : 40
                    return <line key={i} x1={50 + r1 * Math.sin(a)} y1={50 - r1 * Math.cos(a)} x2={50 + r2 * Math.sin(a)} y2={50 - r2 * Math.cos(a)} stroke={i % 3 === 0 ? '#DC2626' : '#FECACA'} strokeWidth={major ? 2 : 1} strokeLinecap="round" />
                  })}
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#FEE2E2" strokeWidth="6" />
                  <motion.circle cx="50" cy="50" r="40" fill="none" stroke="#DC2626" strokeWidth="6" strokeLinecap="round" strokeDasharray={RING_C}
                    animate={{ strokeDashoffset: RING_C * (1 - progress) }} transition={{ ease: 'linear', duration: 0.04 }} />
                  <motion.circle
                    r={3.4}
                    fill="#DC2626"
                    initial={false}
                    animate={{ cx: 50 + 40 * Math.sin(progress * 2 * Math.PI), cy: 50 - 40 * Math.cos(progress * 2 * Math.PI) }}
                    transition={{ ease: 'linear', duration: 0.04 }}
                  />
                  <motion.circle
                    r={6}
                    fill="none"
                    stroke="#DC2626"
                    strokeOpacity={0.35}
                    initial={false}
                    animate={{ cx: 50 + 40 * Math.sin(progress * 2 * Math.PI), cy: 50 - 40 * Math.cos(progress * 2 * Math.PI) }}
                    transition={{ ease: 'linear', duration: 0.04 }}
                  />
                </svg>
                <div className={cn('absolute inset-1.5 rounded-full flex flex-col items-center justify-center shadow-lg transition-colors', holding ? 'bg-calm-accent' : standbyHint ? 'bg-slate-700' : 'bg-gradient-to-b from-[#E11D48] to-[#991B1B]')}>
                  <span className="text-[10px] font-black tracking-[0.3em] text-white">{standbyHint ? '🔗' : t(lang, 'sos')}</span>
                  {holding ? <span className="text-[8px] font-bold text-white/90 tabular-nums">{Math.max(1, Math.ceil((1 - progress) * 3))}…</span>
                    : standbyHint ? <span className="text-[6px] font-semibold text-white/80 tracking-wider">{relinkRemain > 0 ? `${t(lang, 'relink')} ${relinkRemain}s` : 'SYNC ALL!'}</span>
                    : <span className="text-[6px] font-semibold text-white/70 tracking-wider">{standby ? t(lang, 'standby') : t(lang, 'hold3s')}</span>}
                </div>
              </motion.button>
              <div className="text-left">
                <p className="text-[8px] font-mono text-calm-textDim">{cat.label.toUpperCase()} READY</p>
                <p className="text-[8px] font-mono text-calm-textDim">{testMode ? t(lang, 'drillMode') : t(lang, 'liveDispatch')}</p>
                <p className={cn('text-[8px] font-mono font-bold', trust.verified ? 'text-calm-green' : 'text-calm-gold')}>
                  {trust.verified ? `✓ ${t(lang, 'verified')}` : t(lang, 'unverified')} · {t(lang, 'trust')} {trust.trustScore}
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === 'CHAT' && (
          <div className="py-2 h-full flex flex-col gap-2">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-0.5">
              {(['ALL', 'POLICE', 'HOSPITAL', 'FIRE'] as (ServiceType | 'ALL')[]).map((t) => (
                <button key={t} onClick={() => setChatTarget(t)}
                  className={cn('px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide border transition-all shrink-0', chatTarget === t ? 'text-white' : 'border-calm-border text-calm-textMuted')}
                  style={chatTarget === t ? { background: t === 'ALL' ? '#0F172A' : SERVICE_COLOR[t as ServiceType], borderColor: t === 'ALL' ? '#0F172A' : SERVICE_COLOR[t as ServiceType] } : undefined}>
                  {t === 'ALL' ? 'ALL' : SERVICE_META[t as ServiceType].label}
                </button>
              ))}
              <span className="ml-auto text-[8px] font-mono text-calm-textDim shrink-0">
                {chatTarget === 'ALL' ? 'REPLYING → ALL' : `REPLYING → ${SERVICE_META[chatTarget as ServiceType].label}`}
              </span>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-2 pr-0.5">
              {combinedChat.length === 0 && (
                <div className="rounded-xl border border-dashed border-calm-border py-8 text-center">
                  <Radio className="h-5 w-5 mx-auto text-calm-gold mb-2" />
                  <p className="text-[11px] text-calm-textMuted">No messages yet — stations reply here</p>
                </div>
              )}
              {combinedChat.map((c, i) => {
                const isMesh = (c as any).mesh === true
                if (isMesh) {
                  const m = c as unknown as { id: string; from: string; to: string; text: string; ts: number; status: string; priority: string }
                  const mine = m.to === profile.meshNode
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className={cn('flex items-end gap-1.5', mine ? 'justify-start' : 'justify-end')}>
                      {mine && (
                        <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${profile.accent}1c` }}>
                          <Wifi className="h-3 w-3" style={{ color: profile.accent }} />
                        </div>
                      )}
                      <div className={cn('max-w-[75%]', !mine && 'text-right')}>
                        <p className="text-[8px] font-mono text-calm-textDim mb-0.5 px-1" style={{ color: profile.accent }}>
                          MESH · {m.from} → {m.to}
                        </p>
                        <div className={cn('px-2.5 py-1.5 rounded-2xl text-[11px] leading-snug border', mine ? 'bg-calm-surface border-calm-border rounded-bl-sm' : 'bg-calm-surface border-dashed rounded-br-sm', m.status === 'DELIVERED' ? 'border-calm-green/50' : 'border-calm-gold/50')}>
                          {m.text}
                        </div>
                        <p className="text-[8px] font-mono text-calm-textDim mt-0.5 px-1">
                          {fmtRel(m.ts)} · <span style={{ color: m.status === 'DELIVERED' ? '#22C55E' : '#EDB40B' }}>{m.status}</span> · {m.priority}
                        </p>
                      </div>
                    </motion.div>
                  )
                }
                const chatC = c as (typeof chat)[number] & { id?: string }
                const isYou = chatC.from === senderName
                const isService = chatC.scope !== 'ALL'
                const Icon = isService ? TYPE_ICONS[chatC.scope as ServiceType] : Send
                return (
                  <motion.div key={chatC.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={cn('flex items-end gap-1.5', isYou ? 'justify-end' : 'justify-start')}>
                    {!isYou && (
                      <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${SERVICE_COLOR[chatC.scope as ServiceType] ?? '#8b909e'}1c` }}>
                        <Icon className="h-3 w-3" style={{ color: SERVICE_COLOR[chatC.scope as ServiceType] ?? '#8b909e' }} />
                      </div>
                    )}
                    <div className={cn('max-w-[75%]', isYou && 'text-right')}>
                      {!isYou && <p className="text-[8px] font-mono text-calm-textDim mb-0.5 px-1" style={{ color: SERVICE_COLOR[chatC.scope as ServiceType] }}>{chatC.from} · {chatC.scope}</p>}
                      <button onClick={() => setActionMsg(chatC)} className="block w-full text-left">
                        <div className={cn('px-2.5 py-1.5 rounded-2xl text-[11px] leading-snug border', isYou ? 'bg-calm-accent text-white border-calm-accent rounded-br-sm' : 'bg-calm-surface border-calm-border rounded-bl-sm')}>
                          {chatC.text}
                        </div>
                      </button>
                      <p className="text-[8px] font-mono text-calm-textDim mt-0.5 px-1">{fmtRel(chatC.ts)} · tap for options</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <div className="flex items-center gap-2 pb-1">
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { sendChatMsg(); setChatText('') } }}
                placeholder={chatTarget === 'ALL' ? 'Reply to all stations…' : `Reply to ${SERVICE_META[chatTarget as ServiceType].label}…`}
                className="flex-1 bg-white border border-calm-border rounded-xl px-3 py-2 text-[11px] text-calm-text placeholder:text-calm-textDim focus:outline-none focus:border-calm-textMuted shadow-sm"
              />
              <button
                onClick={() => { sendChatMsg(); setChatText('') }}
                disabled={!chatText.trim()}
                className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm', chatText.trim() ? 'bg-calm-accent text-white active:scale-95' : 'bg-calm-border text-calm-textDim cursor-not-allowed')}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {tab === 'HISTORY' && (
          <div className="py-2 space-y-2">
            <p className="text-[9px] font-black tracking-[0.2em] text-calm-textDim flex items-center gap-1.5">
              <History className="h-3 w-3" />{alerts.length} INCIDENT{alerts.length === 1 ? '' : 'S'}
            </p>
            {alerts.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: 'TOTAL', v: String(alerts.length), c: 'text-calm-text' },
                  { l: 'RESOLVED', v: String(alerts.filter((a) => a.acks.length > 0 && a.acks.every((k) => k.status === 'RESOLVED')).length), c: 'text-calm-green' },
                  { l: 'OPEN', v: String(alerts.filter((a) => a.acks.some((k) => k.status !== 'RESOLVED')).length), c: 'text-calm-gold' },
                ].map((k) => (
                  <div key={k.l} className="rounded-lg bg-calm-surface border border-calm-border px-2 py-1.5 text-center">
                    <p className="text-[7px] font-black tracking-wider text-calm-textDim">{k.l}</p>
                    <p className={cn('text-[13px] font-black tabular-nums', k.c)}>{k.v}</p>
                  </div>
                ))}
              </div>
            )}
            {alerts.length === 0 && (
              <div className="rounded-xl border border-dashed border-calm-border py-8 text-center">
                <Clock className="h-5 w-5 mx-auto text-calm-gold mb-2" />
                <p className="text-[11px] text-calm-textMuted">No alerts yet — press SOS to raise one</p>
              </div>
            )}
            {[...alerts].sort((a, b) => b.sentAt - a.sentAt).map((a) => (
              <div key={a.incidentId} className="rounded-xl bg-calm-surface border border-calm-border p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider text-white" style={{ background: SEV_COLOR[a.severity] }}>{a.severity}</span>
                  <span className="font-mono text-[9px] text-calm-textMuted tabular-nums">{a.incidentId}</span>
                  {a.testMode && <span className="px-1.5 py-0.5 rounded bg-calm-border text-calm-textMuted text-[8px] font-bold">DRILL</span>}
                  {(a.reports ?? 1) > 1 && (
                    <span className="px-1.5 py-0.5 rounded bg-calm-accent/15 text-calm-accent text-[8px] font-black" title={`${a.reports} people reported this incident`}>{a.reports} REPORTS</span>
                  )}
                  <span className="ml-auto text-[8px] font-mono text-calm-textDim">{fmtTime(a.sentAt)}</span>
                </div>
                {(a.reports ?? 1) > 1 && (
                  <p className="text-[9px] font-mono text-calm-textMuted leading-snug mb-1.5">
                    <span className="text-calm-accent font-bold">{a.reports} PEOPLE</span> reported · {(a.reporters ?? []).map((id) => DEVICE_PROFILES[id]?.deviceName || id).join(' · ')}
                  </p>
                )}
                <p className="text-[11px] text-calm-text leading-snug mb-2">{a.message}</p>
                {a.evidence?.photo && (
                  <button onClick={() => setFired(a.incidentId)} className="block w-full mb-2 rounded-xl overflow-hidden border border-calm-border relative group">
                    <img src={a.evidence.photo} alt="Incident scene evidence" className="w-full object-cover" style={{ aspectRatio: '16/8' }} />
                    <span className="absolute inset-x-0 bottom-0 px-2 py-1 text-[8px] font-black tracking-wider bg-black/55 text-calm-gold flex items-center gap-1">
                      <Camera className="h-2.5 w-2.5" /> EVIDENCE · {a.evidence.ts ? fmtTime(a.evidence.ts) : fmtTime(a.sentAt)}
                    </span>
                  </button>
                )}
                {(a.photos ?? []).length > 0 && (
                  <div className="flex gap-1.5 mb-2">
                    {(a.photos ?? []).slice(-6).map((p) => (
                      <button key={p.id} onClick={() => setFired(a.incidentId)} className="relative w-14 h-10 rounded-lg overflow-hidden border border-calm-border group shrink-0">
                        <img src={p.photo} alt={p.caption || 'scene photo'} className="w-full h-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[6px] text-white px-0.5 py-px truncate">{p.caption || p.role}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="space-y-1">
                  {a.acks.map((ack) => {
                    const st = ack.status
                    return (
                      <div key={ack.type} className="flex items-center gap-2 text-[9px] font-mono">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: SERVICE_COLOR[ack.type] }} />
                        <span className="font-bold" style={{ color: SERVICE_COLOR[ack.type] }}>{SERVICE_META[ack.type].label}</span>
                        <span className={cn('ml-auto font-bold', st === 'RESOLVED' ? 'text-calm-green' : st === 'DISPATCHING' ? 'text-calm-gold' : st === 'ACKED' ? 'text-calm-textMuted' : 'text-calm-textDim')}>
                          {st === 'DISPATCHING' ? `EN ROUTE · ETA ${ack.etaMinutes ?? '—'}m` : st}
                        </span>
                        {st !== 'OPEN' && <span className="text-calm-textDim tabular-nums">{fmtClock(ack.ts - a.sentAt)}</span>}
                      </div>
                    )
                  })}
                </div>

              {/* Live unit tracking */}
                {a.acks.filter((k) => k.status === 'DISPATCHING').length > 0 && (
                  <div className="mt-2 rounded-lg bg-calm-border/40 border border-calm-border px-2.5 py-2">
                    <p className="text-[7.5px] font-black tracking-[0.18em] text-calm-textDim mb-1.5 flex items-center gap-1">
                      <Navigation className="h-2.5 w-2.5 text-calm-gold" /> LIVE UNIT TRACKING
                    </p>
                    {a.acks.filter((k) => k.status === 'DISPATCHING').map((ack) => {
                      const etaMs = (ack.etaMinutes ?? 4) * 60 * 1000
                      const elapsed = now - ack.ts
                      const progress = Math.min(0.98, Math.max(0.04, elapsed / etaMs))
                      const remainMin = Math.max(0, Math.ceil((etaMs - elapsed) / 60000))
                      const remainSec = Math.max(0, Math.ceil((etaMs - elapsed) / 1000))
                      return (
                        <div key={ack.type} className="mb-1.5 last:mb-0">
                          <div className="flex items-center justify-between text-[8px] font-mono mb-0.5">
                            <span className="font-bold" style={{ color: SERVICE_COLOR[ack.type] }}>{SERVICE_META[ack.type].label} · {ack.etaMinutes ?? '—'} MIN ETA</span>
                            <span className="text-calm-gold tabular-nums">{Math.floor(remainSec / 60)}:{String(remainSec % 60).padStart(2, '0')}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-calm-border overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.round(progress * 100)}%`, background: 'linear-gradient(90deg, #F59E0B, #22C55E)' }} />
                          </div>
                          <p className="text-[7px] font-mono text-calm-textDim mt-0.5 tabular-nums">unit {Math.round(progress * 100)}% of the way · {remainMin}m remaining</p>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Safety / notes / actions */}
                {a.safety && (
                  <p className={cn('mt-2 rounded-lg px-2.5 py-1.5 text-[9px] font-mono flex items-center gap-1.5', a.safety === 'SAFE' ? 'bg-calm-green/10 text-calm-green border border-calm-green/40' : 'bg-calm-gold/10 text-calm-gold border border-calm-gold/40')}>
                    <Check className="h-3 w-3" />VICTIM {a.safety === 'SAFE' ? 'CONFIRMED SAFE' : 'STILL NEEDS HELP'}
                  </p>
                )}
                {(a.notes ?? []).length > 0 && (
                  <div className="mt-2 rounded-lg bg-calm-border/30 border border-calm-border px-2.5 py-1.5">
                    <p className="text-[7.5px] font-black tracking-[0.18em] text-calm-textDim mb-1">FOLLOW-UP NOTES</p>
                    {(a.notes ?? []).slice(-4).map((n, i) => (
                      <p key={i} className="text-[8.5px] font-mono text-calm-textMuted leading-snug">
                        <span className="font-bold" style={{ color: profile.accent }}>{n.from}:</span> {n.text}
                      </p>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button onClick={() => replayIncident(a.incidentId)} className="px-2.5 py-1.5 rounded-lg bg-calm-surface border border-calm-border text-[9px] font-bold text-calm-textMuted active:scale-95 transition-transform">
                    REPLAY
                  </button>
                  <button onClick={() => setFired(a.incidentId)} className="px-2.5 py-1.5 rounded-lg bg-calm-gold/15 border border-calm-gold/40 text-[9px] font-bold text-calm-text active:scale-95 transition-transform">
                    RECEIPTS
                  </button>
                  <button onClick={() => setRoomFor(roomFor === a.incidentId ? null : a.incidentId)} className={cn('px-2.5 py-1.5 rounded-lg border text-[9px] font-bold active:scale-95 transition-transform', roomFor === a.incidentId ? 'bg-calm-accent text-white border-calm-accent' : 'bg-calm-surface border-calm-border text-calm-textMuted')}>
                    INCIDENT ROOM {chat.filter((c) => c.incidentId === a.incidentId).length > 0 ? `(${chat.filter((c) => c.incidentId === a.incidentId).length})` : ''}
                  </button>
                  {a.sourceId === profile.userId && a.acks.some((k) => k.status !== 'RESOLVED') && (
                    <button onClick={() => cancelAlert(a.incidentId)} className="px-2.5 py-1.5 rounded-lg bg-[#DC2626]/15 border border-[#DC2626]/40 text-[9px] font-bold text-[#DC2626] active:scale-95 transition-transform">
                      CANCEL SOS
                    </button>
                  )}
                </div>
                {roomFor === a.incidentId && (
                  <div className="mt-2 rounded-lg bg-calm-border/40 border border-calm-border p-2">
                    <div className="max-h-32 overflow-y-auto space-y-0.5 mb-1.5 scrollbar-thin">
                      {chat.filter((c) => c.incidentId === a.incidentId).length === 0 && (
                        <p className="text-[8px] font-mono text-calm-textDim">Incident room empty — units dispatched to this incident chat here</p>
                      )}
                      {chat.filter((c) => c.incidentId === a.incidentId).map((c, i) => (
                        <p key={i} className="text-[9px] font-mono text-calm-text leading-snug">
                          <span className="font-bold" style={{ color: c.from === profile.deviceName ? profile.accent : SERVICE_COLOR[c.scope as ServiceType] ?? '#22C55E' }}>{c.from}:</span> {c.text}
                        </p>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={roomText}
                        onChange={(e) => setRoomText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && roomText.trim()) { sendIncidentChat(a.incidentId, roomText.trim()); setRoomText('') } }}
                        placeholder={`Reply in room…`}
                        className="flex-1 rounded-lg bg-white border border-calm-border px-2.5 py-1.5 text-[10px] text-calm-text placeholder:text-calm-textDim focus:outline-none focus:border-calm-textMuted"
                      />
                      <button
                        onClick={() => { if (roomText.trim()) { sendIncidentChat(a.incidentId, roomText.trim()); setRoomText('') } }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-calm-accent text-white active:scale-95 transition-transform"
                        aria-label="Send in room"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
               </div>
             ))}
           </div>
        )}

        {tab === 'SERVICES' && (
          <div className="py-2 space-y-2.5">
            <div className="rounded-xl bg-calm-surface border border-calm-border p-3">
              <p className="text-[8px] font-black tracking-[0.18em] text-calm-textDim mb-1.5 flex items-center gap-1.5"><Globe className="h-2.5 w-2.5" />NETWORK HEALTH</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { l: 'STATIONS', v: `${services.filter((s) => s.status === 'ONLINE').length}/${services.length}` },
                  { l: 'ACTIVE', v: String(alerts.filter((a) => a.acks.some((k) => k.status !== 'RESOLVED')).length) },
                  { l: 'NETWORK', v: degraded ? 'DEGRADED' : 'STABLE' },
                ].map((k) => (
                  <div key={k.l} className="rounded-lg bg-calm-border/40 px-2 py-1.5">
                    <p className="text-[7px] font-black tracking-wider text-calm-textDim">{k.l}</p>
                    <p className={cn('text-[12px] font-black tabular-nums', k.v === 'DEGRADED' ? 'text-calm-gold' : 'text-calm-text')}>{k.v}</p>
                  </div>
                ))}
              </div>
            </div>

            {(['POLICE', 'HOSPITAL', 'FIRE'] as ServiceType[]).map((t) => {
              const svc = services.find((s) => s.type === t)
              const Icon = TYPE_ICONS[t]
              const on = !standby && conn[t] === 'ONLINE'
              const activeCount = alerts.filter((a) => {
                const k = a.acks.find((x) => x.type === t)
                return k ? k.status !== 'RESOLVED' : true
              }).length
              return (
                <div key={t} className="rounded-xl bg-calm-surface border border-calm-border p-3">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${SERVICE_COLOR[t]}18` }}>
                      <Icon className="h-4 w-4" style={{ color: SERVICE_COLOR[t] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold truncate">{svc ? svc.name : `${SERVICE_META[t].label} dispatch`}</p>
                      <p className="text-[8px] font-mono text-calm-textDim">{svc?.id ?? '…'} · {on ? 'ONLINE' : standby ? 'STANDBY' : 'OFFLINE'}</p>
                    </div>
                    <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold tracking-wider', on ? 'bg-calm-green/15 text-calm-green' : 'bg-calm-border text-calm-textMuted')}>
                      {on ? 'AVAILABLE' : 'OFFLINE'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[9px] font-mono">
                    <div className="rounded-lg bg-calm-border/40 px-1 py-1.5"><p className="text-[7px] font-black tracking-wider text-calm-textDim">CAPACITY</p><p className="font-bold tabular-nums text-calm-text">{svc ? `${svc.capacity - svc.currentLoad}/${svc.capacity}` : '—'}</p></div>
                    <div className="rounded-lg bg-calm-border/40 px-1 py-1.5"><p className="text-[7px] font-black tracking-wider text-calm-textDim">ACTIVE</p><p className="font-bold tabular-nums text-calm-text">{activeCount}</p></div>
                    <div className="rounded-lg bg-calm-border/40 px-1 py-1.5"><p className="text-[7px] font-black tracking-wider text-calm-textDim">AVG RESP</p><p className="font-bold tabular-nums text-calm-text">{responseFor(t)}</p></div>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[9px] font-mono text-calm-textDim">
                    <span className="flex items-center gap-1"><Navigation className="h-2.5 w-2.5" />{svc ? distTo(svc) : '—'} away</span>
                    <span>uptime {svc?.uptime ?? 100}%</span>
                    <span className="flex items-center gap-1"><Zap className="h-2.5 w-2.5" />load {svc?.currentLoad ?? 0}</span>
                  </div>
                </div>
              )
            })}

            <div className="rounded-xl bg-calm-surface border border-calm-border divide-y divide-calm-border">
              <div className="flex items-center gap-2.5 px-3 py-2">
                <Crosshair className="h-3.5 w-3.5 text-calm-textMuted" />
                <span className="text-[10px] font-semibold flex-1">Live location sharing</span>
                <span className={cn('text-[8px] font-mono font-bold px-1.5 py-0.5 rounded', tracking === 'ON' ? 'bg-calm-green/15 text-calm-green' : 'bg-calm-border text-calm-textMuted')}>{tracking === 'ON' ? 'SHARING' : 'OFF'}</span>
                <button onClick={() => (tracking === 'ON' ? stopLiveTracking() : requestLocation())} className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-calm-accent text-white active:scale-95 transition-transform">
                  {tracking === 'ON' ? 'STOP' : 'SHARE'}
                </button>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2">
                <Waves className="h-3.5 w-3.5 text-calm-textMuted" />
                <span className="text-[10px] font-semibold flex-1">Network condition</span>
                <span className={cn('text-[8px] font-mono font-bold px-1.5 py-0.5 rounded', degraded ? 'bg-calm-gold/15 text-calm-gold' : 'bg-calm-border text-calm-textMuted')}>{degraded ? 'DEGRADED' : 'NORMAL'}</span>
                <button onClick={() => setDegraded(!degraded)} className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-calm-surface border border-calm-border active:scale-95 transition-transform">
                  {degraded ? 'FIX' : 'TEST'}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'NETWORK' && (
          <div className="py-2 space-y-2.5">
            <div className="flex items-center gap-1 p-0.5 bg-calm-border/60 rounded-xl">
              {(['FABRIC', 'NODE'] as const).map((v) => (
                <button key={v} onClick={() => setNetView(v)}
                  className={cn('flex-1 py-1.5 rounded-[10px] text-[9px] font-black tracking-widest transition-all', netView === v ? 'bg-white text-calm-text shadow-sm' : 'text-calm-textMuted')}>
                  {v}
                </button>
              ))}
            </div>

            {netView === 'FABRIC' && (
              <>
                <div className="rounded-xl border border-calm-border px-3 py-2 bg-calm-surface flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest">
                    <Zap className="h-3 w-3 text-calm-gold" /> MESH COMPOSER
                  </span>
                  <span className="flex items-center gap-1 text-[8px] font-mono text-calm-textMuted">
                    <span className="w-1.5 h-1.5 bg-calm-green rounded-full animate-pulse" /> {inRange.length}/{nearbyNodes.length} NODES IN RANGE
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[8px] font-bold tracking-widest text-calm-textMuted">DESTINATION — TYPE A NODE ID OR PICK ONE BELOW</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black tracking-widest text-calm-textDim flex-none">TO</span>
                  <input
                    value={msgTo}
                    onChange={(e) => setMsgTo(e.target.value.toUpperCase())}
                    placeholder="Node id — e.g. PNT-3A2F"
                    spellCheck={false}
                    className="flex-1 min-w-0 bg-calm-surface border border-calm-border rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-calm-text placeholder:text-calm-textDim focus:outline-none focus:border-calm-textMuted"
                  />
                  {msgTo && !meshNodes.some((n) => n.id === msgTo) && (
                    <span className="flex-none text-[7.5px] font-mono text-calm-accent">UNKNOWN NODE</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-0.5">
                  {inRange.length === 0 && (
                    <span className="text-[8px] font-mono text-calm-textMuted px-1">No nodes in range</span>
                  )}
                  {inRange.map(({ node, km }) => {
                    const hops = nodeHops(km)
                    const sel = msgTo === node.id
                    const online = devices.some((d) => d.nodeId === node.id)
                    return (
                      <button key={node.id} onClick={() => setMsgTo(sel ? '' : node.id)}
                        className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-[8px] font-mono shrink-0 transition-all',
                          sel ? 'border-calm-accent bg-calm-accent text-white' : node.status === 'EMERGENCY' ? 'border-[#DC2626] bg-[#DC2626]/10 text-[#DC2626] animate-pulse' : 'bg-calm-surface border-calm-border text-calm-text')}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', node.status === 'EMERGENCY' ? 'bg-[#DC2626]' : online ? 'bg-calm-green animate-pulse' : hops <= 1 ? 'bg-calm-green' : 'bg-calm-gold')} />
                        {node.id}
                        {online && (
                          <span className="px-1 rounded text-[6.5px] font-bold text-calm-green">{devices.find((d) => d.nodeId === node.id)?.name ?? 'ONLINE'}</span>
                        )}
                        <span className={cn('px-1 rounded text-[6.5px] font-bold', sel ? 'bg-white/20' : 'bg-calm-border/60')}>{hops} hop{hops > 1 ? 's' : ''}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="rounded-xl border border-calm-border bg-calm-surface divide-y divide-calm-border">
                  {!msgTo && meshMsgs.length === 0 && (
                    <div className="px-3 py-3 text-center">
                      <p className="text-[8px] font-mono text-calm-textDim">No mesh messages yet — your node {profile.meshNode} is ready. Messages appear here when another device is in range.</p>
                    </div>
                  )}
                  {msgTo && threadMsgs.length === 0 && (
                    <div className="px-3 py-3 text-center">
                      <p className="text-[8px] font-mono text-calm-textDim">No messages with {msgTo} yet — send the first one below</p>
                    </div>
                  )}
                  {shownMsgs.map((m) => {
                    const st = MSG_STATUS[m.status]
                    const urgent = m.priority === 'URGENT'
                    return (
                      <div key={m.id} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-none', m.status === 'RELAYING' && 'animate-pulse')} style={{ background: urgent ? '#DC2626' : st.color }} />
                          <span className="font-mono text-[8px] text-calm-textDim">{m.id}</span>
                          <span className={cn('font-mono text-[8px] font-bold', urgent ? 'text-[#DC2626]' : '')} style={urgent ? undefined : { color: st.color }}>{urgent ? 'URGENT' : st.label}</span>
                          <span className="ml-auto font-mono text-[7px] text-calm-textDim">{fmtRel(m.timestamp)}</span>
                        </div>
                        <p className="font-mono text-[10px] mt-1">{m.from} <span className="text-calm-textMuted">→</span> {m.to} <span className="text-[8px] text-calm-textDim">({m.route.length - 1} hop{m.route.length - 1 > 1 ? 's' : ''})</span></p>
                        <p className="text-[10px] text-calm-textMuted mt-0.5">{m.content}</p>
                        <p className="font-mono text-[8px] text-calm-textDim mt-1">{m.route.join(' → ')}</p>
                        <p className="text-[7px] font-mono mt-1">
                          <span className="text-calm-textDim">TTL: 10 hops</span> · <LockKeyhole className="inline h-2.5 w-2.5 text-calm-green" /> <span className="text-calm-green">E2E Encrypted</span>
                        </p>
                      </div>
                    )
                  })}
                </div>

                <div className="rounded-xl border border-calm-border bg-white p-3 shadow-sm space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-1.5 bg-calm-bg border border-calm-border rounded-lg px-2.5 py-1.5">
                      {msgTo ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meshNodes.find((n) => n.id === msgTo)?.status === 'EMERGENCY' ? '#DC2626' : '#22C55E' }} />
                          <span className="font-mono text-[10px] font-bold">{msgTo}</span>
                          <span className="text-[7px] font-mono text-calm-textDim">
                            {(() => {
                              const t = meshNodes.find((n) => n.id === msgTo)
                              if (!t) return ''
                              const km = nodeDistanceKm(location.lat, location.lng, t.lat, t.lng)
                              return `${km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(1) + 'km'} · ${nodeHops(km)} hops`
                            })()}
                          </span>
                          <button onClick={() => setMsgTo('')} className="ml-auto text-calm-textDim">✕</button>
                        </>
                      ) : (
                        <span className="text-[9px] font-mono text-calm-textDim">Select a node above…</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {(['NORMAL', 'HIGH', 'URGENT'] as const).map((p) => (
                        <button key={p} onClick={() => setMsgPriority(p)}
                          className={cn('px-2 py-1.5 rounded-lg text-[8px] font-bold border transition-all', msgPriority === p ? (p === 'URGENT' ? 'bg-[#DC2626] text-white border-[#DC2626]' : 'bg-calm-text text-white border-calm-text') : 'bg-calm-bg border-calm-border text-calm-textMuted')}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  {msgPriority === 'URGENT' && (
                    <p className="flex items-center gap-1 text-[7.5px] font-mono text-[#DC2626]">
                      <TriangleAlert className="h-2.5 w-2.5" /> URGENT RAISES A REAL ALERT — node turns red, Police/Hospital/Fire consoles get it and clear it when handled
                    </p>
                  )}
                  <textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} rows={2} placeholder="Message content…"
                    className="w-full bg-calm-bg border border-calm-border rounded-lg px-2.5 py-1.5 text-[10px] resize-none placeholder:text-calm-textDim focus:outline-none focus:border-calm-textMuted" />
                  <div className="flex items-center gap-2">
                    <span className="text-[7px] font-mono text-calm-textDim">TTL: 10 hops · E2E Encrypted</span>
                    <button
                      onClick={sendMeshMsg}
                      disabled={!msgTo.trim() || !msgText.trim()}
                      className={cn('ml-auto px-4 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all', msgTo.trim() && msgText.trim() ? 'bg-calm-accent text-white active:scale-95' : 'bg-calm-border text-calm-textDim cursor-not-allowed')}>
                      <Send className="h-3 w-3" /> SEND
                    </button>
                  </div>
                </div>
              </>
            )}

            {netView === 'NODE' && (
              <>
                <div className="rounded-xl bg-calm-surface border border-calm-border p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-calm-gold/15 border border-calm-gold/40 flex items-center justify-center">
                        <Wifi className="h-4 w-4 text-calm-gold" />
                      </div>
                      <div>
                        <div className="font-mono text-calm-gold text-[12px] font-bold">{profile.meshNode}</div>
                        <div className="text-calm-textMuted text-[8px]">PORTABLE MESH NODE · {inRange.length}/{nearbyNodes.length} LINKS · YOUR NODE</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-calm-gold/10 border border-calm-gold/40 text-calm-gold text-[7px] font-bold rounded-full">{profile.meshNode}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {([['BAND', RADIO.band], ['CHANNEL', RADIO.channel], ['TX POWER', RADIO.txPower]] as const).map(([k, v]) => (
                      <div key={k} className="bg-calm-bg border border-calm-border rounded-lg p-2">
                        <div className="text-[7px] text-calm-textMuted tracking-wide mb-0.5">{k}</div>
                        <div className="font-mono text-[12px]">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-calm-bg border border-calm-border rounded-lg p-2">
                      <div className="text-[7px] text-calm-textMuted tracking-wide mb-0.5">SIGNAL / NOISE</div>
                      <div className="font-mono text-[12px] text-calm-blue">{RADIO.snr}</div>
                    </div>
                    <div className="bg-calm-bg border border-calm-border rounded-lg p-2">
                      <div className="text-[7px] text-calm-textMuted tracking-wide mb-0.5">DUTY CYCLE</div>
                      <div className="font-mono text-[12px] text-calm-gold">{RADIO.dutyCycle}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[8px] font-bold tracking-widest text-calm-textMuted">POWER &amp; RELIABILITY</span>
                    <span className="font-mono text-[9px] text-calm-gold">BATTERY {profile.radioBattery}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-calm-border overflow-hidden mb-3">
                    <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#D97706,#16A34A)' }} initial={{ width: 0 }} animate={{ width: `${profile.radioBattery}%` }} transition={{ duration: 0.8 }} />
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {([['SENT', profile.packets.sent.toLocaleString(), '#D97706'], ['RETRIED', profile.packets.retried, '#3B82F6'], ['LOST', profile.packets.lost, '#DC2626'], ['SUCCESS', `${pktSuccess}%`, '#22C55E']] as const).map(([k, v, c]) => (
                      <div key={k} className="bg-calm-bg border border-calm-border rounded-lg py-1.5">
                        <div className="font-mono text-[11px]" style={{ color: c }}>{v}</div>
                        <div className="text-[6.5px] text-calm-textMuted tracking-wide">{k}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-[8px] font-mono text-calm-textDim">
                    <Activity className="h-2.5 w-2.5 text-calm-green" />
                    <span>firmware {RADIO.firmware}</span>
                    <span className="ml-auto">last beacon 2s ago</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[8px] font-bold tracking-widest text-calm-textMuted">LINK DIAGNOSTICS</p>
                    <span className="font-mono text-[9px] text-calm-gold">{inRange.length} / {nearbyNodes.length}</span>
                  </div>
                  <div className="rounded-xl border border-calm-border bg-calm-surface divide-y divide-calm-border">
                    {diagLinks.map((l) => (
                      <div key={l.id} className="flex items-center gap-2 px-2.5 py-1.5">
                        <span className="font-mono text-[9px] text-calm-gold w-16 flex-none">{l.id}</span>
                        {l.relay && <span className="px-1 py-0.5 bg-calm-gold/10 border border-calm-gold/30 rounded text-calm-gold text-[6.5px] font-bold flex-none">RELAY</span>}
                        <span className="text-[8px] font-mono text-calm-textDim flex-none">{l.hops} hop{l.hops > 1 ? 's' : ''}</span>
                        <span className={cn('text-[8px] font-mono w-12 flex-none text-right', l.rssi >= -55 ? 'text-calm-green' : l.rssi >= -70 ? 'text-calm-gold' : 'text-calm-accent')}>{l.rssi} dBm</span>
                        <div className="flex-1 h-1 rounded-full bg-calm-border overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${l.quality}%`, background: l.quality >= 85 ? '#16A34A' : l.quality >= 75 ? '#D97706' : '#DC2626' }} />
                        </div>
                        <span className="font-mono text-[8px] text-calm-textMuted w-8 flex-none text-right">{l.quality}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => { setNodeScan(true); setTimeout(() => setNodeScan(false), 2500) }}
                    className="flex-1 py-2 bg-calm-text text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                    <RefreshCw className={cn('h-3 w-3', nodeScan && 'animate-spin')} /> REDISCOVER
                  </button>
                  <button className="flex-1 py-2 bg-calm-surface border border-calm-border rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                    <ArrowDownRight className="h-3 w-3" /> SCAN CHANNELS
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'MORE' && (
          <div className="py-2 space-y-2.5">
            <div className="rounded-xl bg-calm-surface border border-calm-border divide-y divide-calm-border">
              <div className="px-3 py-2.5">
                <p className="text-[8px] font-black tracking-[0.18em] text-calm-textDim mb-1.5">MEDICAL PROFILE <span className="text-calm-textDim font-normal">(feeds Hospital)</span></p>
                <input value={medical} onChange={(e) => setMedical(e.target.value)} placeholder="Blood type, allergies, conditions…"
                  className="w-full rounded-lg bg-calm-border/40 border border-calm-border px-2.5 py-1.5 text-[11px] text-calm-text placeholder:text-calm-textDim focus:outline-none focus:border-calm-textMuted" />
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2">
                <Languages className="h-3.5 w-3.5 text-calm-textMuted" />
                <span className="text-[10px] font-semibold flex-1">Interface language</span>
                <button onClick={() => setLang(lang === 'EN' ? 'HI' : 'EN')} className="px-2.5 py-1 rounded-lg bg-calm-border/40 border border-calm-border text-[9px] font-black tracking-widest text-calm-text hover:border-calm-textMuted transition-colors" aria-label="Toggle language">
                  {lang === 'EN' ? 'हिंदी' : 'EN'}
                </button>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2">
                <FlaskConical className="h-3.5 w-3.5 text-calm-textMuted" />
                <span className="text-[10px] font-semibold flex-1">Drill mode (no real dispatch)</span>
                <button onClick={() => setTestMode(!testMode)} className={cn('w-9 h-5 rounded-full transition-colors', testMode ? 'bg-calm-green' : 'bg-calm-border')} aria-label="Drill mode">
                  <span className={cn('block w-4 h-4 rounded-full bg-white shadow transition-transform', testMode ? 'translate-x-4.5' : 'translate-x-0.5')} />
                </button>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2">
                <Volume2 className="h-3.5 w-3.5 text-calm-textMuted" />
                <span className="text-[10px] font-semibold flex-1">Silent mode — no audible cues</span>
                <button onClick={() => setSilent(!silent)} className={cn('w-9 h-5 rounded-full transition-colors', silent ? 'bg-calm-green' : 'bg-calm-border')} aria-label="Silent mode">
                  <span className={cn('block w-4 h-4 rounded-full bg-white shadow transition-transform', silent ? 'translate-x-4.5' : 'translate-x-0.5')} />
                </button>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2">
                <Lock className="h-3.5 w-3.5 text-calm-textMuted" />
                <span className="text-[10px] font-semibold flex-1">Blocked stations</span>
                {blocked.length > 0
                  ? <span className="flex gap-1">{blocked.map((t) => (
                      <button key={t} onClick={() => toggleBlocked(t)} className="px-1.5 py-0.5 rounded bg-calm-accent/10 text-calm-accent text-[8px] font-bold" title="Tap to unblock">
                        {SERVICE_META[t].label} ✕
                      </button>
                    ))}</span>
                  : <span className="text-[8px] font-mono text-calm-textDim">none</span>}
              </div>
            </div>

            <div className="rounded-xl bg-calm-surface border border-calm-border divide-y divide-calm-border">
              <div className="px-3 py-2.5">
                <p className="text-[8px] font-black tracking-[0.18em] text-calm-textDim mb-1.5">
                  <Smartphone className="h-3 w-3 inline mr-1 -mt-0.5" style={{ color: profile.accent }} />DEVICE IDENTITY
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] font-mono">
                  {(
                    [
                      ['DEVICE', profile.deviceName],
                      ['USER', profile.userId],
                      ['MESH NODE', profile.meshNode],
                      ['IMEI', profile.imei],
                      ['MODEL', profile.model],
                      ['OS', profile.os],
                      ['BATTERY', `${profile.battery}%`],
                      ['SIGNAL', `${profile.signalDbm} dBm`],
                      ['LOCATION', `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between border-b border-calm-border/60 pb-0.5">
                      <span className="text-calm-textDim tracking-wider">{k}</span>
                      <span className="text-calm-text">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-calm-surface border border-calm-border divide-y divide-calm-border">
              <div className="px-3 py-2.5">
                <p className="text-[8px] font-black tracking-[0.18em] text-calm-textDim mb-0.5">STATION ACCESS <span className="text-calm-gold">(TEST)</span></p>
                <p className="text-[8px] font-mono text-calm-textDim mb-2">Act as a station from this device — ACK / DISPATCH / RESOLVE</p>
                {alerts.filter((a) => a.sourceId === profile.userId && a.acks.some((k) => k.status !== 'RESOLVED')).length === 0 && (
                  <p className="text-[9px] font-mono text-calm-textDim">No live incidents from this device. Fire one from the HOME tab.</p>
                )}
                {alerts
                  .filter((a) => a.sourceId === profile.userId)
                  .map((a) => {
                    const live = a.acks.filter((k) => k.status !== 'RESOLVED')
                    if (live.length === 0) return null
                    return (
                      <div key={a.incidentId} className="px-3 py-2">
                        <p className="text-[8px] font-black tracking-wider text-calm-text mb-1 flex items-center gap-1.5">
                          {a.incidentId} <span className="text-calm-textDim font-mono">{a.severity}</span>
                        </p>
                        {live.map((k) => (
                          <div key={k.type} className="flex items-center gap-1.5 mb-1">
                            <span className="text-[8px] font-black tracking-wider w-16 flex-none" style={{ color: SERVICE_COLOR[k.type] }}>{SERVICE_META[k.type].label}</span>
                            <span className={cn('text-[8px] font-mono flex-1', k.status === 'OPEN' ? 'text-calm-gold' : k.status === 'ACKED' || k.status === 'DISPATCHING' ? 'text-calm-green' : 'text-calm-textMuted')}>
                              {k.status === 'OPEN' ? 'UNACKED' : k.status}
                            </span>
                            <button onClick={() => ackIncident(k.type, a.incidentId)} className="px-1.5 py-0.5 rounded bg-calm-accent/10 text-calm-accent text-[8px] font-black active:scale-95 transition-transform" aria-label={`Ack ${k.type}`}>ACK</button>
                            <button onClick={() => dispatchIncident(k.type, a.incidentId, 'DISPATCH')} className="px-1.5 py-0.5 rounded bg-calm-green/10 text-calm-green text-[8px] font-black active:scale-95 transition-transform" aria-label={`Dispatch ${k.type}`}>DISPATCH</button>
                            <button onClick={() => dispatchIncident(k.type, a.incidentId, 'RESOLVED')} className="px-1.5 py-0.5 rounded bg-calm-border/50 text-calm-textMuted text-[8px] font-black active:scale-95 transition-transform" aria-label={`Resolve ${k.type}`}>RESOLVE</button>
                          </div>
                        ))}
                      </div>
                    )
                  })}
              </div>
            </div>

            <div className="rounded-xl bg-calm-surface border border-calm-border divide-y divide-calm-border overflow-hidden">
              <button onClick={() => setShowMenu(!showMenu)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-semibold text-calm-text hover:bg-calm-border/30 transition-colors">
                <Ban className="h-3.5 w-3.5 text-calm-textMuted" />Blocked senders
                <span className="ml-auto text-[8px] font-mono text-calm-textDim">{blocked.length ? blocked.join(' · ') : 'none'}</span>
                <ChevronDown className={cn('h-3 w-3 transition-transform', showMenu && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {showMenu && blocked.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {blocked.map((t) => (
                      <button key={t} onClick={() => toggleBlocked(t)} className="w-full flex items-center justify-between px-4 py-2 text-[10px] hover:bg-calm-border/30">
                        <span className="flex items-center gap-1.5" style={{ color: SERVICE_COLOR[t] }}><ShieldOff className="h-3 w-3" />{SERVICE_META[t].label}</span>
                        <span className="text-[8px] font-mono text-calm-green">UNBLOCK</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button onClick={() => setConfirmClear(true)} className="w-full rounded-xl border border-calm-accent/40 bg-calm-accent/5 py-2.5 flex items-center justify-center gap-2 text-[10px] font-bold text-calm-accent active:scale-[0.98] transition-transform">
              <Trash2 className="h-3.5 w-3.5" />CLEAR ALL APP DATA
            </button>

            <div className="rounded-xl bg-calm-surface border border-calm-border p-3">
              <p className="text-[8px] font-black tracking-[0.18em] text-calm-textDim mb-1.5">ABOUT</p>
              <p className="text-[9px] text-calm-textMuted leading-relaxed">
                SAFEZONE — PANTOM mesh emergency response. One app, nine linked devices, three live dispatch stations.
                Everything you raise here flows to the CAD consoles in real time. Press SYNC ALL at the top to re-arm the network.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Response notifications */}
      <AnimatePresence>
        {notices.length > 0 && (
          <div className="absolute top-14 inset-x-3 z-50 space-y-1.5 pointer-events-none">
            {notices.map((n) => {
              const NIcon = n.kind === 'SYSTEM' ? Info : TYPE_ICONS[n.kind]
              const color = n.kind === 'SYSTEM' ? '#EDB40B' : SERVICE_COLOR[n.kind]
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: -14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="pointer-events-auto rounded-xl bg-calm-text text-white shadow-lg border-l-4 p-2.5 flex items-center gap-2.5"
                  style={{ borderLeftColor: color }}
                >
                  <NIcon className="h-3.5 w-3.5 flex-none" style={{ color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black tracking-wider" style={{ color }}>{n.kind === 'SYSTEM' ? 'SYSTEM' : SERVICE_META[n.kind].label}</p>
                    <p className="text-[9px] text-calm-bg/80 truncate">{n.text}</p>
                  </div>
                  <button onClick={() => dismissNotice(n.id)} className="text-calm-bg/50 hover:text-calm-bg text-[10px] px-1">✕</button>
                </motion.div>
              )
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Receipts overlay */}
      <AnimatePresence>
        {fired && sentAlert && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-calm-bg/98 backdrop-blur-sm flex flex-col">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold tracking-[0.22em] text-calm-accent">ALERT SENT</p>
                  <p className="text-[9px] font-mono text-calm-textMuted mt-0.5">{sentAlert.incidentId} · {sentAlert.severity} · {sentAlert.message}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-calm-green/15 flex items-center justify-center"><Check className="h-4 w-4 text-calm-green" /></div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => replayIncident(sentAlert.incidentId)} className="px-3 py-1.5 rounded-lg bg-calm-surface border border-calm-border text-[9px] font-bold text-calm-textMuted active:scale-95 transition-transform">REPLAY RESPONSE</button>
                <button onClick={() => setFired(null)} className="px-3 py-1.5 rounded-lg bg-calm-accent text-white text-[9px] font-bold active:scale-95 transition-transform">DONE</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 px-4 overflow-y-auto scrollbar-thin space-y-2.5">
              <div className="rounded-2xl bg-calm-surface border border-calm-border p-3">
                <p className="text-[8px] font-black tracking-[0.18em] text-calm-textDim mb-2">NOTIFIED STATIONS</p>
                {sentAlert.acks.map((ack) => {
                  const Icon = TYPE_ICONS[ack.type]
                  return (
                    <div key={ack.type} className="flex items-center gap-2.5 py-1.5">
                      <Icon className="h-3 w-3" style={{ color: SERVICE_COLOR[ack.type] }} />
                      <span className="text-[10px] font-bold">{SERVICE_META[ack.type].label}</span>
                      <span className="text-[8px] font-mono text-calm-textDim">{(() => { const svc = services.find((s) => s.type === ack.type); return svc ? `${distTo(svc)} away` : '' })()}</span>
                      <span className={cn('ml-auto text-[8px] font-mono', ack.status === 'RESOLVED' ? 'text-calm-green' : ack.status === 'DISPATCHING' ? 'text-calm-gold' : 'text-calm-textMuted')}>
                        {ack.status === 'RESOLVED' ? 'RESOLVED' : ack.status === 'DISPATCHING' ? `EN ROUTE · ETA ${ack.etaMinutes ?? '—'}m` : ack.status === 'ACKED' ? 'ACKNOWLEDGED' : 'WAITING FOR ACK'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[8px] font-mono text-calm-textDim px-1">
                Routed to the NEAREST {sentAlert.acks.map((k) => SERVICE_META[k.type].label).join(' / ')} station — full response timeline runs on the dispatch consoles.
              </p>

              {/* Exact emergency location */}
              {sentAlert.lat != null && sentAlert.lng != null && (
                <div className="rounded-2xl bg-calm-surface border border-calm-border p-3">
                  <p className="text-[8px] font-black tracking-[0.18em] text-calm-textDim mb-1.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-calm-gold" /> EMERGENCY LOCATION · EXACT COORDINATES
                  </p>
                  <p className="text-[11px] font-mono text-calm-text tabular-nums tracking-wide">{sentAlert.lat.toFixed(6)}, {sentAlert.lng.toFixed(6)}</p>
                  <a
                    href={`https://www.google.com/maps?q=${sentAlert.lat},${sentAlert.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-calm-gold text-calm-bg text-[9px] font-black tracking-wider active:scale-95 transition-transform"
                  >
                    <Map className="h-3.5 w-3.5" /> OPEN IN GOOGLE MAPS
                  </a>
                </div>
              )}

              {/* Scene evidence */}
              {sentAlert.evidence?.photo && (
                <div className="rounded-2xl bg-calm-surface border border-calm-border p-3">
                  <p className="text-[8px] font-black tracking-[0.18em] text-calm-textDim mb-1.5 flex items-center gap-1">
                    <Camera className="h-3 w-3 text-calm-gold" /> SCENE EVIDENCE · AUTO-CAPTURED
                  </p>
                  <img src={sentAlert.evidence.photo} alt="Incident scene evidence" className="w-full rounded-xl border border-calm-border object-cover" style={{ aspectRatio: '16/10' }} />
                  <p className="text-[8px] font-mono text-calm-textDim mt-1.5 tabular-nums">
                    {sentAlert.evidence.lat?.toFixed(4)}, {sentAlert.evidence.lng?.toFixed(4)} · {sentAlert.evidence.ts ? fmtTime(sentAlert.evidence.ts) : fmtTime(sentAlert.sentAt)}
                  </p>
                </div>
              )}

              {/* Responder scene photos */}
              {(sentAlert.photos ?? []).length > 0 && (
                <div className="rounded-2xl bg-calm-surface border border-calm-border p-3">
                  <p className="text-[8px] font-black tracking-[0.18em] text-calm-textDim mb-1.5 flex items-center gap-1">
                    <Camera className="h-3 w-3 text-calm-gold" /> SCENE EVIDENCE · RESPONDER PHOTOS
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(sentAlert.photos ?? []).slice(-9).map((p) => (
                      <div key={p.id} className="relative rounded-lg overflow-hidden border border-calm-border bg-black">
                        <img src={p.photo} alt={p.caption || 'scene photo'} className="w-full h-16 object-cover" />
                        <p className="absolute inset-x-0 bottom-0 bg-black/70 text-[6.5px] text-white px-1 py-0.5 truncate">{p.caption || `${p.role} photo`}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live unit tracking */}
              {sentAlert.acks.filter((k) => k.status === 'DISPATCHING').length > 0 && (
                <div className="rounded-2xl bg-calm-surface border border-calm-border p-3">
                  <p className="text-[8px] font-black tracking-[0.18em] text-calm-textDim mb-2 flex items-center gap-1">
                    <Navigation className="h-3 w-3 text-calm-gold" /> LIVE UNIT TRACKING
                  </p>
                  {sentAlert.acks.filter((k) => k.status === 'DISPATCHING').map((ack) => {
                    const etaMs = (ack.etaMinutes ?? 4) * 60 * 1000
                    const elapsed = now - ack.ts
                    const progress = Math.min(0.98, Math.max(0.04, elapsed / etaMs))
                    const remainSec = Math.max(0, Math.ceil((etaMs - elapsed) / 1000))
                    return (
                      <div key={ack.type} className="mb-2 last:mb-0">
                        <div className="flex items-center justify-between text-[9px] font-mono mb-1">
                          <span className="font-bold" style={{ color: SERVICE_COLOR[ack.type] }}>{SERVICE_META[ack.type].label}</span>
                          <span className="text-calm-gold tabular-nums">{Math.floor(remainSec / 60)}:{String(remainSec % 60).padStart(2, '0')} to arrival</span>
                        </div>
                        <div className="h-2 rounded-full bg-calm-border overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.round(progress * 100)}%`, background: 'linear-gradient(90deg, #F59E0B, #22C55E)' }} />
                        </div>
                        <p className="text-[7px] font-mono text-calm-textDim mt-0.5 tabular-nums">unit {Math.round(progress * 100)}% of the way</p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Safety check-in */}
              {sentAlert.acks.every((k) => k.status === 'RESOLVED') && !sentAlert.safety && (
                <div className="rounded-2xl bg-calm-surface border border-calm-border p-3">
                  <p className="text-[8px] font-black tracking-[0.18em] text-calm-textDim mb-1.5 flex items-center gap-1">
                    <Check className="h-3 w-3 text-calm-green" /> EMERGENCY CLOSED — ARE YOU SAFE?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => reportSafety(sentAlert.incidentId, true)} className="flex-1 py-2 rounded-lg bg-calm-green text-white text-[9px] font-black active:scale-95 transition-transform">
                      ✓ I'M SAFE
                    </button>
                    <button onClick={() => reportSafety(sentAlert.incidentId, false)} className="flex-1 py-2 rounded-lg bg-[#DC2626] text-white text-[9px] font-black active:scale-95 transition-transform">
                      STILL NEED HELP
                    </button>
                  </div>
                </div>
              )}
              {sentAlert.safety && (
                <p className={cn('rounded-2xl px-3 py-2 text-[9px] font-mono border flex items-center gap-1.5', sentAlert.safety === 'SAFE' ? 'bg-calm-green/10 border-calm-green/40 text-calm-green' : 'bg-calm-gold/10 border-calm-gold/40 text-calm-gold')}>
                  <Check className="h-3 w-3" />CHECK-IN: {sentAlert.safety === 'SAFE' ? 'victim confirmed safe' : 'victim still needs help'}
                </p>
              )}

              {/* Follow-up note */}
              <div className="rounded-2xl bg-calm-surface border border-calm-border p-3">
                <p className="text-[8px] font-black tracking-[0.18em] text-calm-textDim mb-1.5">FOLLOW-UP NOTE</p>
                {(sentAlert.notes ?? []).length > 0 && (
                  <div className="mb-1.5 space-y-0.5">
                    {(sentAlert.notes ?? []).slice(-4).map((n, i) => (
                      <p key={i} className="text-[9px] font-mono text-calm-textMuted">
                        <span className="font-bold" style={{ color: profile.accent }}>{n.from}:</span> {n.text}
                      </p>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && noteText.trim()) { sendNote(sentAlert.incidentId, noteText.trim()); setNoteText('') } }}
                    placeholder="Add note for responding units…"
                    className="flex-1 rounded-lg bg-calm-bg border border-calm-border px-2.5 py-1.5 text-[10px] text-calm-text placeholder:text-calm-textDim focus:outline-none focus:border-calm-textMuted"
                  />
                  <button onClick={() => { if (noteText.trim()) { sendNote(sentAlert.incidentId, noteText.trim()); setNoteText('') } }} className="px-3 py-1.5 rounded-lg bg-calm-accent text-white text-[9px] font-black active:scale-95 transition-transform">
                    SEND
                  </button>
                </div>
              </div>

              {/* Cancel SOS */}
              {sentAlert.sourceId === profile.userId && sentAlert.acks.some((k) => k.status !== 'RESOLVED') && (
                <button onClick={() => { cancelAlert(sentAlert.incidentId); setFired(null) }} className="w-full py-2 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/40 text-[9px] font-black tracking-wider text-[#DC2626] active:scale-[0.98] transition-transform">
                  CANCEL SOS — FALSE ALARM, STAND UNITS DOWN
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message action sheet */}
      <AnimatePresence>
        {actionMsg && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActionMsg(null)} className="absolute inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
            <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white border-t border-calm-border p-3 pb-4">
              <div className="w-10 h-1 rounded-full bg-calm-border mx-auto mb-3" />
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium font-mono truncate">{actionMsg.from}</p>
                  <p className="text-[9px] text-calm-textMuted truncate">{actionMsg.text}</p>
                </div>
                {copied && <span className="text-[9px] font-mono text-calm-green animate-pulse-signal">COPIED</span>}
              </div>
              <div className="space-y-1">
                <button onClick={copyMsg} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] text-calm-text hover:bg-calm-border/40 transition-colors">
                  <Copy className="h-4 w-4 text-calm-gold" /> Copy text
                </button>
                <button onClick={() => { removeChat(actionMsg.id); setActionMsg(null) }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] text-calm-text hover:bg-calm-border/40 transition-colors">
                  <Trash2 className="h-4 w-4 text-calm-accent" /> Delete message
                </button>
                {actionMsg.scope !== 'ALL' && actionMsg.from !== senderName && (
                  <button onClick={() => { toggleBlocked(actionMsg.scope as ServiceType); setActionMsg(null) }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] text-calm-text hover:bg-calm-border/40 transition-colors">
                    <Ban className="h-4 w-4 text-calm-accent" /> Block {SERVICE_META[actionMsg.scope as ServiceType].label}
                  </button>
                )}
                <button onClick={() => { clearChat(); setActionMsg(null) }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] text-calm-text hover:bg-calm-border/40 transition-colors">
                  <Trash2 className="h-4 w-4 text-calm-textMuted" /> Clear all messages
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Clear-all confirm */}
      <AnimatePresence>
        {confirmClear && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmClear(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-xs bg-white border border-calm-border rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-calm-accent/10 flex items-center justify-center"><Trash2 className="h-5 w-5 text-calm-accent" /></div>
                <div>
                  <h3 className="font-bold text-[15px]">Clear all app data</h3>
                  <p className="text-[11px] text-calm-textMuted">Remove all {alerts.length} alerts, {chat.length} messages and logs?</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmClear(false)} className="flex-1 py-2.5 border border-calm-border rounded-lg text-[11px] font-semibold active:scale-[0.98] transition-transform">Cancel</button>
                <button onClick={() => { clearChat(); clearAlerts(); setConfirmClear(false) }} className="flex-1 py-2.5 bg-calm-accent text-white rounded-lg text-[11px] font-bold active:scale-[0.98] transition-transform">Clear All</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom tabs */}
      <nav className="flex items-center border-t border-calm-border bg-white/95 backdrop-blur px-2 pb-1.5">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 flex flex-col items-center gap-0.5 py-1.5 active:scale-95 transition-transform">
              <Icon className={cn('h-4 w-4', active ? '' : 'text-calm-textDim')} style={active ? { color: profile.accent } : undefined} />
              <span className={cn('text-[7.5px] font-bold tracking-wide', active ? '' : 'text-calm-textMuted')} style={active ? { color: profile.accent } : undefined}>{t.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Torch / siren overlays */}
      {torch && <div className="absolute inset-0 z-40 bg-[#FFF8DC] mix-blend-multiply pointer-events-none" />}
      {siren && (
        <motion.div className="absolute inset-0 z-30 pointer-events-none border-4 border-calm-accent/60" animate={{ opacity: [0.2, 0.8, 0.2] }} transition={{ duration: 0.9, repeat: Infinity }}>
          <span className="absolute top-2 right-3 text-[9px] font-black tracking-widest text-calm-accent">EMERGENCY SIREN</span>
        </motion.div>
      )}

      {/* Full-screen port map inside the device */}
      {mapFull && (
        <motion.div
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          className="absolute inset-0 z-50 flex flex-col bg-calm-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Port map full screen on device"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-calm-border bg-calm-surface">
            <span className="flex items-center gap-1.5 text-[9px] font-black tracking-widest">
              <Map className="h-3.5 w-3.5 text-calm-gold" /> PORT MAP — FULL DEVICE
            </span>
            <button onClick={() => setMapFull(false)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-calm-border/40 border border-calm-border text-[8px] font-black tracking-wider text-calm-textMuted hover:text-calm-text transition-colors" aria-label="Close full map">
              <X className="h-3 w-3" /> CLOSE
            </button>
          </div>
          <div className="flex-1 min-h-0 p-1.5">
            <PortMap className="w-full h-full" client={client} meshStore={meshStore} ownNodeId={profile.meshNode} />
          </div>
        </motion.div>
      )}
    </div>
  )
}