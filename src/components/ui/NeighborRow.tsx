'use client'

import { motion } from 'framer-motion'
import { RotateCcw, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConnectionQualityBars } from './ConnectionQualityBars'

interface NeighborRowProps {
  node: {
    id: string
    quality: number
    relay: boolean
    hops: number
    lastSeen: string
    rssi: number
  }
  index: number
  delay?: number
}

export function NeighborRow({ node, index, delay = 0 }: NeighborRowProps) {
  const isEven = index % 2 === 0

  return (
    <motion.div
      initial={{ opacity: 0, x: isEven ? -30 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5, ease: 'easeOut' }}
      className="flex items-center gap-3 p-3 bg-pantom-surface/60 backdrop-blur border border-pantom-border/50 rounded-xl transition-all hover:border-pantom-gold/30 hover:bg-pantom-surface/80"
    >
      <div className="w-20 flex-shrink-0">
        <span className="font-mono text-pantom-gold text-[12px]">{node.id}</span>
      </div>

      <div className="flex-1 min-w-0">
        <ConnectionQualityBars quality={node.quality} showLabel />
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-pantom-textMuted">
          {node.relay && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-pantom-gold/10 border border-pantom-gold/20 rounded text-pantom-gold">
              <RotateCcw className="h-2.5 w-2.5" /> RELAY
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: node.hops === 1 ? '#00d47e' : node.hops === 2 ? '#EDB40B' : '#0099ff' }} />
            {node.hops} HOP{node.hops > 1 ? 'S' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" /> {node.lastSeen}
          </span>
          <span className="font-mono">{node.rssi} dBm</span>
        </div>
      </div>

      <div className="flex-shrink-0 w-16 text-right">
        <span className={cn(
          'inline-flex items-center justify-end gap-1 text-[10px] font-medium',
          node.quality >= 85 ? 'text-pantom-green' : node.quality >= 70 ? 'text-pantom-gold' : 'text-pantom-red'
        )}>
          {node.quality >= 85 ? <TrendingUp className="h-3 w-3" /> : node.quality >= 70 ? <span>—</span> : <TrendingDown className="h-3 w-3" />}
          <span className="font-mono">{node.quality >= 85 ? 'STABLE' : node.quality >= 70 ? 'OK' : 'WEAK'}</span>
        </span>
      </div>
    </motion.div>
  )
}