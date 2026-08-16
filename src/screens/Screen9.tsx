'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Radio, Siren, HeartPulse, Flame, User, CheckCheck, Antenna, MoreVertical, Copy, Trash2, Ban, ShieldOff, Lock } from 'lucide-react'
import { PhoneNav, PhoneNavProvider, ScreenBackground } from '@/components'
import { cn } from '@/lib/utils'
import { useEmergencyStore, SERVICE_META, type ServiceType, type ChatEntry } from '@/lib/emergencyStore'
import { useEmergencyClient } from '@/hooks/useEmergencyClient'

const TYPE_ICONS = {
  POLICE: Siren,
  HOSPITAL: HeartPulse,
  FIRE: Flame,
} as const

const formatTime = (ts: number) => {
  const d = new Date(ts)
  const diff = Date.now() - ts
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function Screen9() {
  const chat = useEmergencyStore((s) => s.chat)
  const conn = useEmergencyStore((s) => s.conn)
  const blocked = useEmergencyStore((s) => s.blocked)
  const toggleBlocked = useEmergencyStore((s) => s.toggleBlocked)
  const removeChat = useEmergencyStore((s) => s.removeChat)
  const clearChat = useEmergencyStore((s) => s.clearChat)
  const [target, setTarget] = useState<ServiceType | 'ALL'>('ALL')
  const [text, setText] = useState('')
  const [actionTarget, setActionTarget] = useState<ChatEntry | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { sendChat, sendChatTo } = useEmergencyClient()

  const visible = chat.filter((c) => !(c.scope !== 'ALL' && blocked.includes(c.scope as ServiceType)))
  const incoming = visible.filter((c) => c.from !== 'SAFEZONE-1')
  const recentIncoming = incoming.filter((c) => Date.now() - c.ts < 30000).length
  const onlineCount = (['POLICE', 'HOSPITAL', 'FIRE'] as ServiceType[]).filter((t) => conn[t] === 'ONLINE').length

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [visible.length])

  const send = () => {
    const msg = text.trim()
    if (!msg) return
    if (target === 'ALL') sendChat(msg)
    else sendChatTo(target, msg)
    setText('')
  }

  const copyText = async () => {
    if (!actionTarget) return
    try {
      await navigator.clipboard.writeText(actionTarget.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch { /* clipboard unavailable */ }
    setActionTarget(null)
  }

  const blockSender = () => {
    if (!actionTarget || actionTarget.scope === 'ALL' || actionTarget.from === 'SAFEZONE-1') return
    toggleBlocked(actionTarget.scope as ServiceType)
    setActionTarget(null)
  }

  const actionIsService = actionTarget != null && actionTarget.scope !== 'ALL' && actionTarget.from !== 'SAFEZONE-1'

  return (
    <div className="relative w-full h-full flex flex-col bg-pantom-bg">
      <ScreenBackground />
      <PhoneNavProvider><PhoneNav /></PhoneNavProvider>

      <header className="flex items-center justify-between px-4 py-3 border-b border-pantom-border/50 animate-fade-slide-down delay-200 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-pantom-gold/15 flex items-center justify-center">
            <Antenna className="h-4 w-4 text-pantom-gold" />
          </div>
          <div>
            <p className="text-pantom-textMuted text-[13px] font-medium tracking-wide">PORT RADIO</p>
            <p className="text-[9px] font-mono text-pantom-textDim flex items-center gap-1">
              <Radio className="h-2.5 w-2.5 text-pantom-green" />
              {onlineCount}/3 stations reachable
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {recentIncoming > 0 && (
            <span className="px-2 py-0.5 bg-pantom-green/20 text-pantom-green text-[10px] font-bold rounded-full animate-pulse-signal">
              {recentIncoming} NEW
            </span>
          )}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-lg text-pantom-textMuted hover:text-pantom-gold hover:bg-pantom-border/30 transition-all"
            aria-label="Message options"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute right-3 top-16 z-20 w-56 rounded-xl bg-pantom-surface border border-pantom-border shadow-2xl overflow-hidden"
          >
            <button
              onClick={() => { clearChat(); setShowMenu(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[11px] text-pantom-text hover:bg-pantom-border/30 transition-colors text-left"
            >
              <Trash2 className="h-3.5 w-3.5 text-pantom-red" />
              Clear all messages
            </button>
            <div className="px-3 py-1.5 border-t border-pantom-border/30">
              <p className="text-[9px] font-mono text-pantom-textDim mb-1 flex items-center gap-1">
                <Ban className="h-2.5 w-2.5 text-pantom-gold" /> BLOCKED STATIONS
              </p>
              {blocked.length === 0 && (
                <p className="text-[10px] text-pantom-textMuted py-1">None blocked — tap a message and choose BLOCK.</p>
              )}
              {blocked.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleBlocked(t)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] hover:bg-pantom-border/30 transition-colors"
                >
                  <span className="flex items-center gap-1.5" style={{ color: SERVICE_META[t].color }}>
                    <ShieldOff className="h-3 w-3" />{SERVICE_META[t].label}
                  </span>
                  <span className="text-[9px] font-mono text-pantom-green">UNBLOCK</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {blocked.length > 0 && (
        <div className="px-3 py-1.5 bg-pantom-red/10 border-b border-pantom-red/20 flex items-center justify-between">
          <span className="text-[9px] font-mono text-pantom-red flex items-center gap-1">
            <Lock className="h-2.5 w-2.5" />BLOCKED: {blocked.map((t) => SERVICE_META[t].label).join(' · ')}
          </span>
          <button
            onClick={() => setShowMenu(true)}
            className="text-[9px] font-mono text-pantom-gold underline underline-offset-2"
          >
            MANAGE
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 scrollbar-thin">
        {visible.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <Radio className="h-6 w-6 text-pantom-gold/60 mb-3" />
            <p className="text-[11px] text-pantom-textMuted leading-relaxed">
              Messages from the port stations appear here.
            </p>
            <p className="text-[9px] text-pantom-textDim font-mono mt-1">
              Tune in to POLICE · HOSPITAL · FIRE
            </p>
          </div>
        )}

        {visible.map((c, i) => {
          const isYou = c.from === 'SAFEZONE-1'
          const isService = c.scope !== 'ALL'
          const meta = isService ? SERVICE_META[c.scope as ServiceType] : null
          const Icon = isService ? TYPE_ICONS[c.scope as ServiceType] : User
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn('flex items-end gap-1.5', isYou ? 'justify-end' : 'justify-start')}
            >
              {!isYou && (
                <div
                  className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center"
                  style={{ background: `${meta ? meta.color : '#8b909e'}1c` }}
                >
                  <Icon className="h-3 w-3" style={{ color: meta ? meta.color : '#8b909e' }} />
                </div>
              )}
              <div className={cn('max-w-[70%]', isYou && 'text-right')}>
                {!isYou && (
                  <p className="text-[8px] font-mono text-pantom-textDim mb-0.5 px-1 flex items-center gap-1">
                    <span style={{ color: meta?.color }}>{c.from}</span>
                    {isService && <span className="text-pantom-gold/70">· {c.scope}</span>}
                  </p>
                )}
                <button
                  onClick={() => setActionTarget(c)}
                  className="block w-full text-left group"
                  title="Message options"
                >
                  <div
                    className={cn(
                      'px-2.5 py-1.5 rounded-2xl text-[11px] leading-snug border transition-colors',
                      isYou
                        ? 'bg-pantom-gold/15 text-pantom-text border-pantom-gold/30 rounded-br-sm group-hover:border-pantom-gold/60'
                        : 'bg-pantom-border/30 text-pantom-textMuted border-pantom-border/40 rounded-bl-sm group-hover:border-pantom-gold/40'
                    )}
                  >
                    {c.text}
                  </div>
                </button>
                <p className="text-[8px] font-mono text-pantom-textDim mt-0.5 px-1">
                  {formatTime(c.ts)}
                  {isYou && <CheckCheck className="h-2.5 w-2.5 inline ml-1 text-pantom-green" />}
                  {i >= visible.length - 1 && isService && (
                    <span className="ml-1 text-pantom-gold/70 group-hover:opacity-100 opacity-0 transition-opacity">· tap for options</span>
                  )}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>

      <AnimatePresence>
        {actionTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionTarget(null)}
              className="absolute inset-0 z-30 bg-black/50 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-pantom-surface border-t border-pantom-border p-3 pb-4"
            >
              <div className="w-10 h-1 rounded-full bg-pantom-border mx-auto mb-3" />
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${actionTarget.from === 'SAFEZONE-1' ? '#8b909e' : (SERVICE_META[actionTarget.scope as ServiceType]?.color || '#8b909e')}1c` }}>
                  {actionTarget.from === 'SAFEZONE-1'
                    ? <User className="h-3.5 w-3.5 text-pantom-textMuted" />
                    : (() => {
                        const Icon = TYPE_ICONS[actionTarget.scope as ServiceType] || Radio
                        return <Icon className="h-3.5 w-3.5" style={{ color: SERVICE_META[actionTarget.scope as ServiceType]?.color }} />
                      })()}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-pantom-text truncate">{actionTarget.from === 'SAFEZONE-1' ? 'Your message' : actionTarget.from}</p>
                  <p className="text-[9px] text-pantom-textDim font-mono truncate">{actionTarget.text}</p>
                </div>
                {copied && <span className="ml-auto text-[9px] font-mono text-pantom-green animate-pulse-signal">COPIED</span>}
              </div>

              <div className="space-y-1">
                <button
                  onClick={copyText}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] text-pantom-text hover:bg-pantom-border/30 transition-colors"
                >
                  <Copy className="h-4 w-4 text-pantom-gold" /> Copy text
                </button>
                <button
                  onClick={() => { removeChat(actionTarget.id); setActionTarget(null) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] text-pantom-text hover:bg-pantom-border/30 transition-colors"
                >
                  <Trash2 className="h-4 w-4 text-pantom-red" /> Delete message
                </button>
                {actionIsService && (
                  <button
                    onClick={blockSender}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] text-pantom-text hover:bg-pantom-border/30 transition-colors"
                  >
                    <Ban className="h-4 w-4 text-pantom-red" />
                    Block {SERVICE_META[actionTarget.scope as ServiceType].label}
                  </button>
                )}
                <button
                  onClick={() => { clearChat(); setActionTarget(null) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] text-pantom-text hover:bg-pantom-border/30 transition-colors"
                >
                  <Trash2 className="h-4 w-4 text-pantom-textMuted" /> Clear all messages
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="px-3 py-2 border-t border-pantom-border/50 bg-pantom-bg/80 backdrop-blur">
        <div className="flex items-center gap-1 mb-2 overflow-x-auto scrollbar-thin">
          {(['ALL', 'POLICE', 'HOSPITAL', 'FIRE'] as (ServiceType | 'ALL')[]).map((t) => {
            const color = t === 'ALL' ? '#EDB40B' : SERVICE_META[t as ServiceType].color
            const isBlocked = t !== 'ALL' && blocked.includes(t as ServiceType)
            return (
              <button
                key={t}
                onClick={() => setTarget(t)}
                className={cn(
                  'px-2 py-1 rounded-full text-[9px] font-bold tracking-wide border transition-all shrink-0',
                  target === t ? 'text-pantom-bg' : 'border-pantom-border/50 text-pantom-textMuted',
                  isBlocked && !(target === t) && 'opacity-40 line-through'
                )}
                style={target === t ? { background: color, borderColor: color } : undefined}
              >
                {t === 'ALL' ? 'ALL' : SERVICE_META[t as ServiceType].label}
              </button>
            )
          })}
          {target !== 'ALL' && (
            <span className="text-[8px] font-mono text-pantom-gold/80 ml-auto">
              REPLYING â†’ {SERVICE_META[target as ServiceType].label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={target === 'ALL' ? 'Reply to all stations…' : `Reply to ${SERVICE_META[target as ServiceType].label}…`}
            className="flex-1 bg-pantom-border/30 border border-pantom-border/50 rounded-lg px-3 py-2 text-[12px] text-pantom-text placeholder:text-pantom-textDim focus:outline-none focus:border-pantom-gold/50"
          />
          <button
            onClick={send}
            disabled={!text.trim()}
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center transition-all shrink-0',
              text.trim()
                ? 'bg-pantom-gold text-pantom-bg hover:shadow-glow-gold'
                : 'bg-pantom-border/40 text-pantom-textDim cursor-not-allowed'
            )}
            aria-label="Send reply"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}