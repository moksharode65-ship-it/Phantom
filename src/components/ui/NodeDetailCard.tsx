'use client'

import { motion } from 'framer-motion'
import { Battery, Cpu, HardDrive, Wifi, Shield, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NodeDetailCardProps {
  node: {
    id: string
    type: string
    maxConnections: number
    activeConnections: number
    battery: number
    uptime: string
    messagesSent: number
    messagesRelayed: number
    reliability: number
    version: string
  }
  isSelf: boolean
  delay?: number
  className?: string
}

export function NodeDetailCard({ node, isSelf, delay = 0, className }: NodeDetailCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5 }}
      className={cn('p-4 bg-pantom-surface/80 backdrop-blur border border-pantom-border/50 rounded-2xl', className)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-pantom-gold/10 border border-pantom-gold/30 flex items-center justify-center">
            <Wifi className="h-6 w-6 text-pantom-gold" />
          </div>
          <div>
            <div className="font-mono text-pantom-gold text-[14px] font-bold">{node.id}</div>
            <div className="text-pantom-textMuted text-[11px]">{node.type}</div>
          </div>
        </div>
        {isSelf && (
          <span className="px-2 py-1 bg-pantom-gold/10 border border-pantom-gold/30 text-pantom-gold text-[10px] font-semibold rounded-full">
            YOUR NODE
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-pantom-bg/50 border border-pantom-border rounded-xl p-3">
          <div className="flex items-center gap-2 text-[11px] text-pantom-textMuted mb-1">
            <Battery className="h-3.5 w-3.5" /> BATTERY
          </div>
          <div className="font-mono text-2xl text-white">{node.battery}%</div>
        </div>
        <div className="bg-pantom-bg/50 border border-pantom-border rounded-xl p-3">
          <div className="flex items-center gap-2 text-[11px] text-pantom-textMuted mb-1">
            <Cpu className="h-3.5 w-3.5" /> UPTIME
          </div>
          <div className="font-mono text-xl text-white">{node.uptime}</div>
        </div>
        <div className="bg-pantom-bg/50 border border-pantom-border rounded-xl p-3">
          <div className="flex items-center gap-2 text-[11px] text-pantom-textMuted mb-1">
            <Shield className="h-3.5 w-3.5" /> RELIABILITY
          </div>
          <div className="font-mono text-2xl text-pantom-green">{node.reliability}%</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-pantom-bg/50 border border-pantom-border rounded-xl p-3">
          <div className="text-[10px] text-pantom-textMuted tracking-wide mb-1">SENT</div>
          <div className="font-mono text-xl text-pantom-gold">{node.messagesSent.toLocaleString()}</div>
        </div>
        <div className="bg-pantom-bg/50 border border-pantom-border rounded-xl p-3">
          <div className="text-[10px] text-pantom-textMuted tracking-wide mb-1">RELAYED</div>
          <div className="font-mono text-xl text-pantom-blue">{node.messagesRelayed.toLocaleString()}</div>
        </div>
        <div className="bg-pantom-bg/50 border border-pantom-border rounded-xl p-3">
          <div className="text-[10px] text-pantom-textMuted tracking-wide mb-1">VERSION</div>
          <div className="font-mono text-[11px] text-pantom-textDim">{node.version}</div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-pantom-textMuted">
        <span className="flex items-center gap-1">
          <RotateCcw className="h-3.5 w-3.5" />
          {node.activeConnections}/{node.maxConnections} CONNECTIONS
        </span>
        <span className="flex items-center gap-1">
          <HardDrive className="h-3.5 w-3.5" />
          {Math.round(node.reliability * 0.1)} GB CACHED
        </span>
      </div>
    </motion.div>
  )
}