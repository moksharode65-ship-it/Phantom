'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Wifi, WifiOff, Link2, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLinkStore, type LinkStore } from '@/lib/linkStore'

const TOPOLOGY: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
]

interface Point { x: number; y: number }

function useVisiblePhoneCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const measure = () => {
      const nodes = Array.from(document.querySelectorAll('[data-phone-link]'))
      setCount(nodes.filter((n) => {
        const r = n.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }).length)
    }
    measure()
    const id = window.setInterval(measure, 400)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [])

  return count
}

export function SyncHub() {
  const linked = useLinkStore((s) => s.linked)
  const showLines = useLinkStore((s) => s.showLines)
  const autoRelinkAt = useLinkStore((s) => s.autoRelinkAt)
  const deviceCount = useVisiblePhoneCount()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!autoRelinkAt) return
    setNow(Date.now())
    const id = window.setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= autoRelinkAt) useLinkStore.getState().relinkNow()
    }, 250)
    return () => window.clearInterval(id)
  }, [autoRelinkAt])

  const remain = autoRelinkAt ? Math.max(0, Math.ceil((autoRelinkAt - now) / 1000)) : 0

  const toggle = () => {
    const s = useLinkStore.getState()
    if (s.linked) s.unlinkTemporarily()
    else s.relinkNow()
  }

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50">
      <motion.button
        onClick={toggle}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={cn(
          'flex items-center gap-2.5 px-4 py-2 rounded-full border backdrop-blur-md shadow-2xl transition-all',
          linked
            ? 'bg-pantom-bg/90 border-pantom-green/40 hover:border-pantom-green/70'
            : 'bg-pantom-bg/90 border-pantom-red/40 hover:border-pantom-red/70'
        )}
      >
        <span className={cn('relative flex h-2 w-2', linked && 'animate-ping-slow')}>
          <span
            className={cn(
              'inline-flex h-full w-full rounded-full opacity-75',
              linked ? 'bg-pantom-green' : 'bg-pantom-red'
            )}
          />
        </span>
        <span className="text-[11px] font-bold tracking-widest">
          <span className={linked ? 'text-pantom-green' : 'text-pantom-red'}>
            {linked ? 'NETWORK SYNCED' : remain > 0 ? `AUTO RELINKING IN ${remain}s` : 'NETWORK STANDBY'}
          </span>
        </span>
        <span className="text-[10px] font-mono text-pantom-textMuted">
          {deviceCount} DEVICES {linked ? 'LINKED' : 'UNLINKED'}
        </span>
        <span className={cn('flex items-center gap-1 text-[9px] font-bold tracking-wider rounded-full px-2 py-0.5 border', linked ? 'text-pantom-green border-pantom-green/40' : 'text-pantom-red border-pantom-red/40')}>
          {linked ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
          {linked ? 'SYNC ALL' : `AUTO ${remain}s`}
        </span>
        <button
          onClick={() => useLinkStore.getState().setShowLines(!useLinkStore.getState().showLines)}
          className={cn('flex items-center gap-1 text-[9px] font-bold tracking-wider rounded-full px-2 py-0.5 border transition-all', showLines ? 'text-pantom-gold border-pantom-gold/50 bg-pantom-gold/10' : 'text-pantom-textMuted border-pantom-border hover:border-pantom-gold/50 hover:text-pantom-gold')}
          aria-pressed={showLines}
          title={showLines ? 'Hide connection lines' : 'Show connection lines'}
        >
          {showLines ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
          {showLines ? 'LINES ON' : 'LINES OFF'}
        </button>
      </motion.button>
    </div>
  )
}

function usePhoneCenters(): Point[] {
  const [centers, setCenters] = useState<Point[]>([])

  useEffect(() => {
    const measure = () => {
      const nodes = Array.from(document.querySelectorAll('[data-phone-link]')).filter((n) => {
        const r = n.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      setCenters(nodes.map((n) => {
        const r = n.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      }))
    }
    measure()
    const id = window.setInterval(measure, 400)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [])

  return centers
}

export function PhoneLinks({ stores = [useLinkStore] }: { stores?: LinkStore[] }) {
  const linkedStates = stores.map((s) => s((st) => st.linked))
  const showLineStates = stores.map((s) => s((st) => st.showLines))
  const linked = linkedStates.some(Boolean)
  const showLines = showLineStates.some(Boolean)
  const centers = usePhoneCenters()

  if (!linked || !showLines) return null

  const lines = TOPOLOGY
    .filter(([a, b]) => centers[a] && centers[b])
    .map(([a, b]) => ({ a: centers[a], b: centers[b] }))

  return (
    <svg className="fixed inset-0 z-30 pointer-events-none hidden md:block" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#EDB40B" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#00d47e" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {lines.map(({ a, b }, i) => (
        <g key={i}>
          <line
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="url(#linkGrad)"
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.5}
            filter="url(#linkGlow)"
          />
          <motion.line
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="#EDB40B"
            strokeWidth={1}
            strokeDasharray="7 9"
            strokeLinecap="round"
            initial={false}
            animate={{ strokeDashoffset: [0, -32] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear', delay: i * 0.12 }}
            opacity={0.85}
          />
          <motion.circle
            r={2.6}
            fill="#EDB40B"
            initial={false}
            animate={{ cx: [a.x, b.x], cy: [a.y, b.y] }}
            transition={{ duration: 1.7, repeat: Infinity, ease: 'linear', delay: i * 0.35 }}
          />
        </g>
      ))}
      <filter id="linkGlow">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </svg>
  )
}

export function LinkBadge({ store = useLinkStore }: { store?: LinkStore }) {
  const linked = store((s) => s.linked)
  return (
    <div
      className={cn(
        'absolute top-2 right-2 z-40 flex items-center gap-1 px-1.5 py-0.5 rounded-full border backdrop-blur-sm transition-all',
        linked ? 'bg-pantom-green/15 border-pantom-green/40' : 'bg-pantom-border/40 border-pantom-border/60'
      )}
    >
      <Link2 className={cn('h-2.5 w-2.5', linked ? 'text-pantom-green' : 'text-pantom-textDim')} />
      <span className={cn('text-[7px] font-mono font-bold tracking-wider', linked ? 'text-pantom-green' : 'text-pantom-textDim')}>
        {linked ? 'LINKED' : 'STANDALONE'}
      </span>
    </div>
  )
}