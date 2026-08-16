'use client'

import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NodePillProps {
  id: string
  quality: number
  isRelay: boolean
  delay?: number
}

export function NodePill({ id, quality, isRelay, delay = 0 }: NodePillProps) {
  const getQualityColor = (q: number) => {
    if (q >= 90) return 'bg-pantom-green border-pantom-green/30 text-pantom-green'
    if (q >= 80) return 'bg-pantom-gold/10 border-pantom-gold/30 text-pantom-gold'
    if (q >= 70) return 'bg-pantom-blue/10 border-pantom-blue/30 text-pantom-blue'
    return 'bg-pantom-red/10 border-pantom-red/30 text-pantom-red'
  }

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: delay / 1000, type: 'spring', stiffness: 200 }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-mono',
        getQualityColor(quality)
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="font-medium">{id}</span>
      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-current/20">
        {quality}%
      </span>
      {isRelay && (
        <RotateCcw className="h-3 w-3 opacity-70" aria-label="Relay node" />
      )}
    </motion.span>
  )
}