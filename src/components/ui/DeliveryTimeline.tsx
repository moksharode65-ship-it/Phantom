'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCheck, Clock, Zap, RotateCcw, AlertTriangle, Shield, MessageSquare } from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'

interface MessageFlow {
  id: string
  from: string
  to: string
  priority: string
  route: string[]
  status: string
  timestamp: number
  acks: string[]
}

interface DeliveryTimelineProps {
  messages: MessageFlow[]
  selfNodeId?: string
}

const STATUS_CONFIG = {
  DELIVERED: { icon: CheckCheck, color: 'text-pantom-green', label: 'DELIVERED' },
  TRANSMITTING: { icon: Zap, color: 'text-pantom-gold animate-pulse-signal', label: 'SENDING' },
  RELAYING: { icon: RotateCcw, color: 'text-pantom-blue animate-spin', label: 'RELAYING' },
  QUEUED: { icon: Clock, color: 'text-pantom-textMuted', label: 'QUEUED' },
  FAILED: { icon: AlertTriangle, color: 'text-pantom-red', label: 'FAILED' },
  STORED: { icon: Shield, color: 'text-pantom-blue', label: 'STORED' },
}

export function DeliveryTimeline({ messages }: DeliveryTimelineProps) {
  return (
    <div className="max-h-48 overflow-y-auto pr-1 space-y-2" role="list" aria-label="Message history">
      <AnimatePresence mode="popLayout">
        {messages.slice(0, 8).map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, x: -20, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: 20, height: 0 }}
            transition={{ delay: i * 0.03, duration: 0.3 }}
            className="relative flex items-start gap-3 p-3 bg-pantom-surface/60 backdrop-blur border border-pantom-border/50 rounded-xl"
            role="listitem"
          >
            <div className="relative flex flex-col items-center flex-shrink-0">
              <div className={cn('w-2 h-2 rounded-full border-2 border-pantom-surface', STATUS_CONFIG[msg.status as keyof typeof STATUS_CONFIG]?.color || 'text-pantom-textMuted')} />
              {i < messages.length - 1 && (
                <div className="w-0.5 h-full bg-pantom-border mt-1 flex-1" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className={cn('h-3.5 w-3.5', STATUS_CONFIG[msg.status as keyof typeof STATUS_CONFIG]?.color || 'text-pantom-textMuted')} />
                <span className="font-mono text-pantom-gold text-[11px]">{msg.id}</span>
                <span className="text-pantom-textMuted text-[10px]">•</span>
                <span className={cn('text-[10px] font-medium uppercase tracking-wide', STATUS_CONFIG[msg.status as keyof typeof STATUS_CONFIG]?.color || 'text-pantom-textMuted')}>
                  {STATUS_CONFIG[msg.status as keyof typeof STATUS_CONFIG]?.label || msg.status}
                </span>
                <span className="text-pantom-textMuted text-[10px]">•</span>
                <span className="text-[10px] text-pantom-textDim font-mono">{formatTime(msg.timestamp)}</span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-pantom-textMuted font-mono flex-wrap">
                <span className="text-pantom-gold">{msg.from}</span>
                <span>→</span>
                <span className="text-pantom-green">{msg.to}</span>
                <span className="text-pantom-textDim">({msg.route.length - 1} hop{msg.route.length > 2 ? 's' : ''})</span>
              </div>

              <div className="mt-1.5 flex items-center gap-1 overflow-x-auto pb-1" role="img" aria-label={`Route: ${msg.route.join(' → ')}`}>
                {msg.route.map((node, idx) => (
                  <span key={node} className={cn(
                    'flex items-center gap-1 whitespace-nowrap',
                    idx === 0 ? 'text-pantom-gold' : idx === msg.route.length - 1 ? 'text-pantom-green' : 'text-pantom-text'
                  )}>
                    {node}
                    {idx < msg.route.length - 1 && <span className="text-pantom-gold/50">→</span>}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex-shrink-0">
              <span className={cn(
                'px-2 py-0.5 rounded text-[9px] font-semibold tracking-wide border',
                msg.priority === 'EMERGENCY' && 'bg-pantom-red/20 text-pantom-red border-pantom-red/30',
                msg.priority === 'URGENT' && 'bg-pantom-gold/20 text-pantom-gold border-pantom-gold/30',
                msg.priority === 'HIGH' && 'bg-pantom-blue/20 text-pantom-blue border-pantom-blue/30',
                msg.priority === 'NORMAL' && 'bg-pantom-border text-pantom-textMuted border-pantom-border',
              )}>
                {msg.priority}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}