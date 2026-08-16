'use client'

import { cn } from '@/lib/utils'

interface ConnectionQualityBarsProps {
  quality: number
  className?: string
  showLabel?: boolean
}

export function ConnectionQualityBars({ quality, className, showLabel = false }: ConnectionQualityBarsProps) {
  const bars = 5
  const activeBars = Math.round((quality / 100) * bars)

  const getBarColor = (_index: number) => {
    if (quality >= 90) return 'bg-pantom-green'
    if (quality >= 75) return 'bg-pantom-gold'
    if (quality >= 60) return 'bg-pantom-blue'
    return 'bg-pantom-red'
  }

  return (
    <div className={cn('flex items-end gap-1', className)} role="img" aria-label={`Signal quality: ${quality}%`}>
      {[...Array(bars)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-t transition-all duration-300',
            i < activeBars ? getBarColor(i) : 'bg-pantom-border'
          )}
          style={{
            height: `${12 + i * 4}px`,
            transitionDelay: `${i * 30}ms`,
          }}
        />
      ))}
      {showLabel && (
        <span className="ml-2 text-[11px] font-mono text-pantom-textMuted">{quality}%</span>
      )}
    </div>
  )
}