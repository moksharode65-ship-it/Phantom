'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Message } from '@/lib/messageStore'

interface RouteVisualizationProps {
  messages: Message[]
  activeMessage: Message | null
  selfNodeId: string
}

export function RouteVisualization({ messages, activeMessage, selfNodeId }: RouteVisualizationProps) {
  const [layout, setLayout] = useState<Record<string, { x: number; y: number }>>({})

  useEffect(() => {
    const allNodes = new Set<string>()
    messages.forEach(m => {
      allNodes.add(m.from)
      m.route.forEach(n => allNodes.add(n))
    })
    const nodes = Array.from(allNodes).filter(n => n !== selfNodeId)
    const positions: Record<string, { x: number; y: number }> = {}

    positions[selfNodeId] = { x: 0, y: 0 }

    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
      const radius = 140 + (i % 3) * 30
      positions[node] = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      }
    })

    setLayout(positions)
  }, [messages, selfNodeId])

  if (Object.keys(layout).length === 0) return null

  const msg = activeMessage || messages[0]

  return (
    <div className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`-180 -180 360 360`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,7 L10,3.5 Z" fill="#EDB40B" />
          </marker>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <AnimatePresence mode="wait">
          {msg.route.slice(0, -1).map((fromId, i) => {
            const toId = msg.route[i + 1]
            const from = layout[fromId]
            const to = layout[toId]
            if (!from || !to) return null

            const isDirect = i === 0 && msg.directAvailable
            const isActive = msg.status === 'TRANSMITTING' || msg.status === 'RELAYING'
            const pathLength = Math.hypot(to.x - from.x, to.y - from.y)

            return (
              <motion.path
                key={`${fromId}-${toId}`}
                initial={{ pathLength: 0, pathOffset: 1, opacity: 0 }}
                animate={{ pathLength: 1, pathOffset: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, delay: i * 0.15, ease: 'easeOut' }}
                d={`M${from.x},${from.y} L${to.x},${to.y}`}
                stroke={isDirect ? '#00d47e' : '#EDB40B'}
                strokeWidth={isDirect ? 3 : 2}
                strokeDasharray={pathLength}
                strokeDashoffset={isActive ? 0 : pathLength}
                fill="none"
                markerEnd="url(#arrowhead)"
                style={{
                  filter: isActive ? 'url(#glow)' : undefined,
                  animation: isActive ? 'routeTrace 1.2s linear infinite' : undefined,
                }}
              />
            )
          })}
        </AnimatePresence>

        {msg.directAvailable && msg.route.length === 2 && (
          <motion.circle
            initial={{ r: 0, opacity: 0 }}
            animate={{ r: 28, opacity: 0.15 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            cx={layout[msg.from]?.x || 0}
            cy={layout[msg.from]?.y || 0}
            fill="#00d47e"
            className="pointer-events-none"
          />
        )}
      </svg>

      <div className="absolute inset-0 w-full h-full" style={{ transform: 'translate(-50%, -50%)' }}>
        {Object.entries(layout).map(([nodeId, pos]) => {
          const isSelf = nodeId === selfNodeId
          const isInRoute = msg.route.includes(nodeId)
          const routeIndex = msg.route.indexOf(nodeId)

          return (
            <motion.div
              key={nodeId}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: isSelf ? 0 : 0.2, type: 'spring', stiffness: 200 }}
              style={{
                left: `calc(50% + ${pos.x}px)`,
                top: `calc(50% + ${pos.y}px)`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute"
            >
              {isInRoute && (
                <motion.div
                  animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: routeIndex * 0.2 }}
                  className="absolute inset-0 rounded-full border-2 pointer-events-none"
                  style={{
                    borderColor: isSelf ? '#EDB40B' : (msg.directAvailable && routeIndex === 1 ? '#00d47e' : '#EDB40B'),
                  }}
                />
              )}

              <div
                className={cn(
                  'relative rounded-full border-2 flex items-center justify-center transition-all',
                  isSelf ? 'w-10 h-10 border-pantom-gold bg-pantom-gold/10' :
                  isInRoute ? 'w-8 h-8 border-pantom-gold bg-pantom-gold/10' :
                  'w-6 h-6 border-pantom-border bg-pantom-surface/50'
                )}
                style={{
                  borderColor: isSelf ? '#EDB40B' :
                    msg.directAvailable && routeIndex === 1 ? '#00d47e' :
                    isInRoute ? '#EDB40B' : 'rgba(255,255,255,0.15)',
                  boxShadow: isSelf ? '0 0 20px -5px rgba(237,180,11,0.5)' :
                    isInRoute ? '0 0 15px -3px rgba(237,180,11,0.4)' : 'none',
                }}
              >
                {isSelf && <span className="text-[9px] font-bold text-pantom-gold">SELF</span>}
                {isInRoute && !isSelf && (
                  <span className="text-[8px] font-medium text-pantom-gold">
                    {routeIndex === 0 ? '→' : routeIndex === msg.route.length - 1 ? '✓' : '⟳'}
                  </span>
                )}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="absolute top-[calc(100% + 6px)] left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono text-pantom-textMuted"
              >
                {nodeId}
              </motion.div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}