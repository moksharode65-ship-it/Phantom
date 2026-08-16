'use client'

import { motion } from 'framer-motion'
import { X, AlertTriangle, Zap, Shield, RotateCcw, CheckCheck } from 'lucide-react'

interface EmergencyPanelProps {
  onDismiss: () => void
}

const EMERGENCY_STEPS = [
  { id: 'discovery', label: 'AGGRESSIVE DISCOVERY', icon: Zap, detail: 'Scanning all channels • Beacon interval: 100ms' },
  { id: 'redundancy', label: 'HIGH REDUNDANCY ROUTING', icon: RotateCcw, detail: 'Maintaining 3 backup paths per destination' },
  { id: 'persistence', label: 'MESSAGE PERSISTENCE', icon: Shield, detail: 'Store-and-forward enabled • TTL: 255 hops' },
  { id: 'recovery', label: 'FAST FAILOVER', icon: CheckCheck, detail: 'Route recovery < 200ms • Pre-computed backups' },
]

export function EmergencyPanel({ onDismiss }: EmergencyPanelProps) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="w-full max-w-lg"
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-7 w-7 text-pantom-gold" />
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">EMERGENCY MODE</h2>
              <p className="text-pantom-gold/80 text-[13px] font-medium">MAXIMUM RESILIENCE PROTOCOL</p>
            </div>
          </div>
          <p className="text-pantom-textMuted text-[13px] ml-10">
            Network prioritizes delivery over efficiency. All nodes cooperate for critical message survival.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="p-2 text-pantom-textMuted hover:text-white transition-colors"
          aria-label="Dismiss emergency mode"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {EMERGENCY_STEPS.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
            className="flex items-start gap-3 p-4 bg-pantom-redBg/50 border border-pantom-red/30 rounded-xl"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(237,180,11,0.15)' }}>
              <step.icon className="h-5 w-5 text-pantom-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white text-[13px] tracking-wide">{step.label}</div>
              <div className="text-pantom-textMuted text-[12px] mt-0.5">{step.detail}</div>
            </div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
              className="w-2 h-2 rounded-full bg-pantom-gold"
            />
          </motion.div>
        ))}
      </div>

      <div className="bg-pantom-redBg/50 border border-pantom-red/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-pantom-gold font-medium text-[11px] tracking-wide">LIVE SIMULATION</span>
          <span className="text-[11px] font-mono text-pantom-textMuted">NODES: 10,482</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-3 bg-pantom-bg/50 rounded-lg">
            <div className="text-3xl font-bold text-pantom-gold font-mono">21,390</div>
            <div className="text-[11px] text-pantom-textMuted">ACTIVE ROUTES</div>
          </div>
          <div className="p-3 bg-pantom-bg/50 rounded-lg">
            <div className="text-3xl font-bold text-pantom-green font-mono">97%</div>
            <div className="text-[11px] text-pantom-textMuted">NETWORK HEALTH</div>
          </div>
          <div className="p-3 bg-pantom-bg/50 rounded-lg">
            <div className="text-3xl font-bold text-pantom-red font-mono">31</div>
            <div className="text-[11px] text-pantom-textMuted">FAILED NODES</div>
          </div>
          <div className="p-3 bg-pantom-bg/50 rounded-lg">
            <div className="text-3xl font-bold text-pantom-green font-mono">48</div>
            <div className="text-[11px] text-pantom-textMuted">RECOVERED ROUTES</div>
          </div>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="w-full mt-6 py-3 bg-white text-pantom-bg font-semibold rounded-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
      >
        <X className="h-4 w-4" strokeWidth={2} />
        RETURN TO NETWORK
      </button>
    </motion.div>
  )
}