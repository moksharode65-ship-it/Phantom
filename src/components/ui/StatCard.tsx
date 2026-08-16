'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  trend?: string
  trendPositive?: boolean
  delay?: number
}

export function StatCard({ icon, label, value, trend, trendPositive, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5 }}
      className={cn(
        'relative p-3 bg-pantom-surface/80 backdrop-blur border rounded-2xl',
        'bg-gradient-to-br from-pantom-surface/90 to-pantom-surface/50'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-pantom-gold">{icon}</div>
        {trend && (
          <span className={cn(
            'text-[11px] font-semibold px-2 py-0.5 rounded',
            trendPositive ? 'bg-pantom-green/20 text-pantom-green' : 'bg-pantom-red/20 text-pantom-red'
          )}>
            {trend}
          </span>
        )}
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-none mb-1">{value}</div>
      <div className="text-[11px] text-pantom-textMuted tracking-wide uppercase">{label}</div>
    </motion.div>
  )
}