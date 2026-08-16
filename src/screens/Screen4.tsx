'use client'

import { MessageSquare, CheckCheck, Mail, Bell, Trash2, MoreVertical, Copy, Ban, ShieldOff, Lock } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PhoneNav, PhoneNavProvider } from '@/components'
import { ScreenBackground } from '@/components'
import { cn } from '@/lib/utils'
import { useMessageStore, type Message } from '@/lib/messageStore'
import { useLinkStore } from '@/lib/linkStore'

const PRIORITY_CONFIG = {
  NORMAL: { color: 'text-pantom-textMuted', bg: 'bg-pantom-border/20', border: 'border-pantom-border', icon: Mail },
  HIGH: { color: 'text-pantom-blue', bg: 'bg-pantom-blue/20', border: 'border-pantom-blue', icon: Mail },
  URGENT: { color: 'text-pantom-gold', bg: 'bg-pantom-gold/20', border: 'border-pantom-gold', icon: Bell },
  EMERGENCY: { color: 'text-pantom-red', bg: 'bg-pantom-red/20', border: 'border-pantom-red', icon: Bell },
}

const formatTime = (ts: number) => {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function Screen4() {
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [actionTarget, setActionTarget] = useState<Message | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const { 
    receivedMessages, 
    markAsRead, 
    markAllAsRead,
    removeMessage,
    toggleBlockSender,
    blockedSenders,
    clearHistory 
  } = useMessageStore()

  const linked = useLinkStore((s) => s.linked)

  const visible = receivedMessages.filter((m) => !blockedSenders.includes(m.from))
  const visibleUnread = visible.filter((m) => m.status === 'RECEIVED').length

  const copyText = async () => {
    if (!actionTarget) return
    try {
      await navigator.clipboard.writeText(actionTarget.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch { /* clipboard unavailable */ }
    setActionTarget(null)
  }

  const deleteMessage = () => {
    if (!actionTarget) return
    removeMessage(actionTarget.id)
    setActionTarget(null)
  }

  const blockSender = () => {
    if (!actionTarget || actionTarget.from === 'YOU') return
    toggleBlockSender(actionTarget.from)
    setActionTarget(null)
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-pantom-bg">
      <ScreenBackground />
      <PhoneNavProvider><PhoneNav /></PhoneNavProvider>

      <header className="flex items-center justify-between px-5 py-4 border-b border-pantom-border/50 animate-fade-slide-down delay-200 z-10">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-pantom-gold" />
          <span className="text-pantom-textMuted text-[13px] font-medium tracking-wide">INBOX</span>
        </div>
        <div className="flex items-center gap-2">
          {visibleUnread > 0 && (
            <span className="px-2 py-0.5 bg-pantom-gold text-pantom-bg text-[10px] font-bold rounded-full animate-pulse-signal">
              {visibleUnread}
            </span>
          )}
          <span className="text-pantom-textMuted text-[11px]">PNT-4B9L</span>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-pantom-textMuted hover:text-pantom-gold transition-colors"
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
            className="absolute right-3 top-16 z-30 w-56 rounded-xl bg-pantom-surface border border-pantom-border shadow-2xl overflow-hidden"
          >
            <button
              onClick={() => { markAllAsRead(); setShowMenu(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[11px] text-pantom-text hover:bg-pantom-border/30 transition-colors text-left"
            >
              <CheckCheck className="h-3.5 w-3.5 text-pantom-green" />
              Mark all as read
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowClearConfirm(true) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[11px] text-pantom-text hover:bg-pantom-border/30 transition-colors text-left"
            >
              <Trash2 className="h-3.5 w-3.5 text-pantom-red" />
              Clear all messages
            </button>
            <div className="px-3 py-1.5 border-t border-pantom-border/30">
              <p className="text-[9px] font-mono text-pantom-textDim mb-1 flex items-center gap-1">
                <Ban className="h-2.5 w-2.5 text-pantom-gold" /> BLOCKED SENDERS
              </p>
              {blockedSenders.length === 0 && (
                <p className="text-[10px] text-pantom-textMuted py-1">None blocked — tap a message and choose BLOCK.</p>
              )}
              {blockedSenders.map((from) => (
                <button
                  key={from}
                  onClick={() => toggleBlockSender(from)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] hover:bg-pantom-border/30 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-mono text-pantom-textMuted">
                    <ShieldOff className="h-3 w-3 text-pantom-red" />{from}
                  </span>
                  <span className="text-[9px] font-mono text-pantom-green">UNBLOCK</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {blockedSenders.length > 0 && (
        <div className="px-4 py-1.5 bg-pantom-red/10 border-b border-pantom-red/20 flex items-center justify-between">
          <span className="text-[9px] font-mono text-pantom-red flex items-center gap-1">
            <Lock className="h-2.5 w-2.5" />BLOCKED: {blockedSenders.join(' · ')}
          </span>
          <button
            onClick={() => setShowMenu(true)}
            className="text-[9px] font-mono text-pantom-gold underline underline-offset-2"
          >
            MANAGE
          </button>
        </div>
      )}

      <main className="flex-1 relative overflow-hidden z-10">
        {visible.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-fade-slide-up delay-400">
            <div className="w-20 h-20 rounded-full bg-pantom-surface border border-pantom-border/50 flex items-center justify-center mb-4 animate-pulse-signal">
              <MessageSquare className="h-10 w-10 text-pantom-textMuted" />
            </div>
            <p className="text-pantom-text text-lg font-medium mb-1">No Messages Yet</p>
            <p className="text-pantom-textMuted text-sm max-w-xs">
              Messages sent from the network will appear here instantly. Send a message from the center phone to test.
            </p>
            <div className="mt-6 flex items-center gap-3 text-pantom-gold/50 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-pantom-green rounded-full" /> Listening</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-pantom-gold rounded-full animate-pulse" /> Port 460</span>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 border-b border-pantom-border/50 bg-pantom-surface/40 backdrop-blur flex items-center justify-between">
              <p className="text-pantom-textMuted text-[11px] font-medium tracking-wide">
                {visibleUnread} unread · {visible.length} total
              </p>
              <div className={cn('flex items-center gap-1 text-[10px] font-mono', linked ? 'text-pantom-gold/70' : 'text-pantom-textDim')}>
                <span className={cn('w-1.5 h-1.5 rounded-full', linked ? 'bg-pantom-green animate-pulse' : 'bg-pantom-textDim')} />
                <span>{linked ? 'Live' : 'Standby'}</span>
              </div>
            </div>
            {!linked && (
              <div className="px-4 py-1.5 bg-pantom-gold/10 border-b border-pantom-gold/20 flex items-center justify-between">
                <span className="text-[9px] font-mono text-pantom-gold">UNLINKED — MESH TRAFFIC PAUSED</span>
                <span className="text-[9px] font-mono text-pantom-textDim">SYNC NONE</span>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 animate-fade-slide-up delay-400">
              {visible.map((msg, i) => {
                const config = PRIORITY_CONFIG[msg.priority]
                const Icon = config.icon
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => markAsRead(msg.id)}
                    className={cn(
                      'relative p-3 rounded-xl border transition-all cursor-pointer',
                      config.border,
                      msg.status === 'RECEIVED'
                        ? 'ring-1 ring-pantom-gold/50 bg-pantom-gold/5'
                        : 'bg-pantom-surface/30 hover:bg-pantom-surface/50'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={cn('font-mono text-[12px] flex items-center gap-1.5', config.color)}>
                        <Icon className="h-3 w-3" />
                        {msg.from}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded', config.color, config.bg)}>
                          {msg.priority}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActionTarget(msg) }}
                          className="p-1 text-pantom-textDim hover:text-pantom-gold transition-colors"
                          aria-label="Message options"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                    <p className="text-pantom-text text-[12px] leading-snug mb-2 line-clamp-2">{msg.content}</p>
                    <div className="flex items-center gap-3 text-[10px] text-pantom-textMuted">
                      <span className="flex items-center gap-1">
                        <CheckCheck className="h-3 w-3 text-pantom-green" />
                        Delivered
                      </span>
                      <span className="font-mono">{formatTime(msg.timestamp)}</span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-pantom-blue" />
                        {msg.route.length - 1} hops
                      </span>
                      {msg.status === 'RECEIVED' && (
                        <span className="w-2 h-2 bg-pantom-gold rounded-full animate-pulse-signal ml-auto" />
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {actionTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionTarget(null)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-md rounded-t-2xl bg-pantom-surface border-t border-pantom-border p-3 pb-4"
            >
              <div className="w-10 h-1 rounded-full bg-pantom-border mx-auto mb-3" />
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-pantom-border/30">
                  <MessageSquare className="h-3.5 w-3.5 text-pantom-textMuted" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-pantom-text font-mono truncate">{actionTarget.from}</p>
                  <p className="text-[9px] text-pantom-textDim truncate">{actionTarget.content}</p>
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
                  onClick={() => { markAsRead(actionTarget.id); setActionTarget(null) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] text-pantom-text hover:bg-pantom-border/30 transition-colors"
                >
                  <CheckCheck className="h-4 w-4 text-pantom-green" /> Mark as read
                </button>
                <button
                  onClick={deleteMessage}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] text-pantom-text hover:bg-pantom-border/30 transition-colors"
                >
                  <Trash2 className="h-4 w-4 text-pantom-red" /> Delete message
                </button>
                {actionTarget.from !== 'YOU' && (
                  <button
                    onClick={blockSender}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] text-pantom-text hover:bg-pantom-border/30 transition-colors"
                  >
                    <Ban className="h-4 w-4 text-pantom-red" /> Block {actionTarget.from}
                  </button>
                )}
                <button
                  onClick={() => { setActionTarget(null); setShowClearConfirm(true) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] text-pantom-text hover:bg-pantom-border/30 transition-colors"
                >
                  <Trash2 className="h-4 w-4 text-pantom-textMuted" /> Clear all messages
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {showClearConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowClearConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-sm bg-pantom-surface border border-pantom-border rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-pantom-red/20 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-pantom-red" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Clear History</h3>
                <p className="text-pantom-textMuted text-sm">Remove all {receivedMessages.length} messages?</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 bg-pantom-surface border border-pantom-border text-pantom-text font-semibold rounded-lg transition-all hover:border-pantom-gold"
              >
                Cancel
              </button>
              <button
                onClick={() => { clearHistory(); setShowClearConfirm(false); }}
                className="flex-1 py-2.5 bg-pantom-red text-white font-semibold rounded-lg transition-all hover:bg-pantom-redDim"
              >
                Clear All
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}