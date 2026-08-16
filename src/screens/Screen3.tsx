'use client'

import { Shield, Wifi, RefreshCw, TriangleAlert, Radio, Cpu, Activity, Zap } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { PhoneNav, PhoneNavProvider } from '@/components'
import { ScreenBackground, EmergencyPanel } from '@/components'
import { cn } from '@/lib/utils'

const RADIO = {
  band: '915 MHz',
  channel: 12,
  txPower: '22 dBm',
  snr: '9.4 dB',
  dutyCycle: '3.2%',
  firmware: 'PANTOM v0.9.4-alpha',
}

const PACKETS = { sent: 1247, retried: 38, lost: 5 }

const LINKS = [
  { id: 'PNT-3A2F', hops: 1, rssi: -42, quality: 94, relay: true },
  { id: 'PNT-8K1M', hops: 1, rssi: -48, quality: 91, relay: true },
  { id: 'PNT-4B9L', hops: 1, rssi: -55, quality: 87, relay: false },
  { id: 'PNT-1Z6Q', hops: 1, rssi: -51, quality: 84, relay: true },
  { id: 'PNT-9H3R', hops: 2, rssi: -62, quality: 82, relay: false },
  { id: 'PNT-2E7Y', hops: 2, rssi: -67, quality: 79, relay: true },
  { id: 'PNT-6W4V', hops: 3, rssi: -71, quality: 76, relay: false },
  { id: 'PNT-5T8U', hops: 2, rssi: -69, quality: 73, relay: true },
]

const successPct = Math.round((PACKETS.sent - PACKETS.lost) / PACKETS.sent * 100)

function rssiColor(rssi: number) {
  if (rssi >= -55) return 'text-pantom-green'
  if (rssi >= -70) return 'text-pantom-gold'
  return 'text-pantom-red'
}

export function Screen3() {
  const [emergencyMode, setEmergencyMode] = useState(false)

  return (
    <div className="relative w-full h-full flex flex-col bg-pantom-bg">
      <ScreenBackground />
      <PhoneNavProvider><PhoneNav /></PhoneNavProvider>

      <header className="flex items-center justify-between px-5 py-4 border-b border-pantom-border/50 animate-fade-slide-down delay-200 z-10">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-pantom-gold" />
          <span className="text-pantom-textMuted text-[13px] font-medium tracking-wide">NODE DETAIL</span>
        </div>
        <button
          onClick={() => setEmergencyMode(!emergencyMode)}
          className={`px-3 py-1.5 rounded text-[11px] font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
            emergencyMode
              ? 'bg-pantom-red text-white shadow-glow-red'
              : 'bg-pantom-surface border border-pantom-border text-pantom-textMuted hover:border-pantom-gold hover:text-pantom-gold'
          }`}
          aria-pressed={emergencyMode}
        >
          <TriangleAlert className="h-3.5 w-3.5" />
          {emergencyMode ? 'EMERGENCY ACTIVE' : 'EMERGENCY MODE'}
        </button>
      </header>

      {emergencyMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center p-5"
          style={{ background: 'linear-gradient(160deg, #1a0000 0%, #8B0000 40%, #E10600 100%)' }}
        >
          <EmergencyPanel onDismiss={() => setEmergencyMode(false)} />
        </motion.div>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 z-10">
        {/* Device */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="p-4 bg-pantom-surface/80 backdrop-blur border border-pantom-border/50 rounded-2xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-pantom-gold/10 border border-pantom-gold/30 flex items-center justify-center">
                <Wifi className="h-6 w-6 text-pantom-gold" />
              </div>
              <div>
                <div className="font-mono text-pantom-gold text-[14px] font-bold">PNT-7K9M</div>
                <div className="text-pantom-textMuted text-[11px]">PORTABLE MESH NODE · 8/12 LINKS</div>
              </div>
            </div>
            <span className="px-2 py-1 bg-pantom-gold/10 border border-pantom-gold/30 text-pantom-gold text-[10px] font-semibold rounded-full">
              YOUR NODE
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-pantom-bg/50 border border-pantom-border rounded-xl p-3">
              <div className="flex items-center gap-2 text-[11px] text-pantom-textMuted mb-1">
                <Radio className="h-3.5 w-3.5" /> BAND
              </div>
              <div className="font-mono text-xl text-white">{RADIO.band}</div>
            </div>
            <div className="bg-pantom-bg/50 border border-pantom-border rounded-xl p-3">
              <div className="flex items-center gap-2 text-[11px] text-pantom-textMuted mb-1">
                <Cpu className="h-3.5 w-3.5" /> CHANNEL
              </div>
              <div className="font-mono text-xl text-white">{RADIO.channel}</div>
            </div>
            <div className="bg-pantom-bg/50 border border-pantom-border rounded-xl p-3">
              <div className="flex items-center gap-2 text-[11px] text-pantom-textMuted mb-1">
                <Zap className="h-3.5 w-3.5" /> TX POWER
              </div>
              <div className="font-mono text-xl text-white">{RADIO.txPower}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-pantom-bg/50 border border-pantom-border rounded-xl p-3">
              <div className="text-[10px] text-pantom-textMuted tracking-wide mb-1">SIGNAL / NOISE</div>
              <div className="font-mono text-xl text-pantom-blue">{RADIO.snr}</div>
            </div>
            <div className="bg-pantom-bg/50 border border-pantom-border rounded-xl p-3">
              <div className="text-[10px] text-pantom-textMuted tracking-wide mb-1">DUTY CYCLE</div>
              <div className="font-mono text-xl text-pantom-gold">{RADIO.dutyCycle}</div>
            </div>
          </div>
        </motion.div>

        {/* Battery & packets */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="p-4 bg-pantom-surface/80 backdrop-blur border border-pantom-border/50 rounded-2xl"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-pantom-textMuted tracking-wide font-medium">POWER &amp; RELIABILITY</span>
            <span className="font-mono text-[12px] text-pantom-gold">BATTERY 73%</span>
          </div>
          <div className="h-2 rounded-full bg-pantom-border/60 overflow-hidden mb-4">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg,#EDB40B,#00d47e)' }}
              initial={{ width: 0 }}
              animate={{ width: '73%' }}
              transition={{ delay: 0.7, duration: 1, ease: 'easeOut' }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center mb-3">
            <div className="bg-pantom-bg/50 border border-pantom-border rounded-lg py-2">
              <div className="font-mono text-lg text-pantom-gold">{PACKETS.sent.toLocaleString()}</div>
              <div className="text-[9px] text-pantom-textMuted tracking-wide">SENT</div>
            </div>
            <div className="bg-pantom-bg/50 border border-pantom-border rounded-lg py-2">
              <div className="font-mono text-lg text-pantom-blue">{PACKETS.retried}</div>
              <div className="text-[9px] text-pantom-textMuted tracking-wide">RETRIED</div>
            </div>
            <div className="bg-pantom-bg/50 border border-pantom-border rounded-lg py-2">
              <div className="font-mono text-lg text-pantom-red">{PACKETS.lost}</div>
              <div className="text-[9px] text-pantom-textMuted tracking-wide">LOST</div>
            </div>
            <div className="bg-pantom-bg/50 border border-pantom-border rounded-lg py-2">
              <div className="font-mono text-lg text-pantom-green">{successPct}%</div>
              <div className="text-[9px] text-pantom-textMuted tracking-wide">SUCCESS</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-pantom-textMuted">
            <Activity className="h-3 w-3 text-pantom-green" />
            <span>firmware {RADIO.firmware}</span>
            <span className="ml-auto text-pantom-textDim">last beacon 2s ago</span>
          </div>
        </motion.div>

        {/* Link diagnostics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] tracking-widest text-pantom-textMuted">LINK DIAGNOSTICS</p>
            <span className="font-mono text-[10px] text-pantom-gold">8 / 12</span>
          </div>
          <div className="rounded-xl border border-pantom-border/60 bg-pantom-surface/50 overflow-hidden">
            {LINKS.map((l, i) => (
              <div
                key={l.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2',
                  i < LINKS.length - 1 && 'border-b border-pantom-border/40'
                )}
              >
                <span className="font-mono text-[11px] text-pantom-gold w-20 flex-none">{l.id}</span>
                {l.relay && (
                  <span className="px-1.5 py-0.5 bg-pantom-gold/10 border border-pantom-gold/20 rounded text-pantom-gold text-[8px] font-bold flex-none">
                    RELAY
                  </span>
                )}
                <span className="text-[10px] font-mono text-pantom-textDim flex-none">{l.hops} hop{l.hops > 1 ? 's' : ''}</span>
                <span className={cn('text-[10px] font-mono w-14 flex-none text-right', rssiColor(l.rssi))}>{l.rssi} dBm</span>
                <div className="flex-1 h-1 rounded-full bg-pantom-border/60 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${l.quality}%`, background: l.quality >= 85 ? '#00d47e' : l.quality >= 75 ? '#EDB40B' : '#E10600' }} />
                </div>
                <span className="font-mono text-[10px] text-pantom-textMuted w-9 flex-none text-right">{l.quality}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Actions */}
      <footer className="px-4 py-3 border-t border-pantom-border/50 bg-pantom-surface/60 backdrop-blur animate-fade-slide-up delay-800 z-10">
        <div className="flex gap-2">
          <button className="flex-1 py-2.5 bg-pantom-gold text-pantom-bg font-semibold rounded-lg flex items-center justify-center gap-2 transition-all hover:shadow-glow-gold text-sm">
            <RefreshCw className="h-3.5 w-3.5" /> REDISCOVER
          </button>
          <button className="flex-1 py-2.5 bg-pantom-surface border border-pantom-border text-pantom-text font-semibold rounded-lg flex items-center justify-center gap-2 transition-all hover:border-pantom-gold hover:text-pantom-gold text-sm">
            <Wifi className="h-3.5 w-3.5" /> SCAN CHANNELS
          </button>
        </div>
      </footer>
    </div>
  )
}