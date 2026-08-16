import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Screen6 } from '@/screens/Screen6'
import { Screen7 } from '@/screens/Screen7'
import { Screen8 } from '@/screens/Screen8'
import { UserApp } from '@/screens/UserApp'
import { createPhoneDevice } from '@/lib/deviceContext'

export default function App() {
  const [fabric, setFabric] = useState(false)
  const [device] = useState(() => createPhoneDevice())

  const fabricToggle = (
    <button
      onClick={() => setFabric((v) => !v)}
      className={cn(
        'fixed top-3 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em] border transition-all flex items-center gap-2',
        fabric
          ? 'bg-pantom-gold/15 border-pantom-gold/60 text-pantom-gold shadow-[0_0_24px_rgba(237,180,11,0.25)]'
          : 'bg-pantom-surface/70 border-pantom-border text-pantom-textMuted hover:border-pantom-textMuted'
      )}
      aria-pressed={fabric}
      aria-label="Toggle fabric dispatch board"
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', fabric ? 'bg-pantom-gold animate-pulse' : 'bg-pantom-textMuted')} />
      {fabric ? 'FABRIC ON — DISPATCH BOARD' : 'FABRIC — DISPATCH BOARD'}
    </button>
  )

  return (
    <div className="relative h-screen w-full bg-pantom-bg font-sans antialiased overflow-hidden">
      <div className="absolute inset-0 bg-pantom-bg/85 z-[1]" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(237,180,11,0.06)_0%,transparent_70%),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(0,212,126,0.04)_0%,transparent_60%),radial-gradient(ellipse_50%_60%_at_0%_50%,rgba(184,119,255,0.04)_0%,transparent_50%)] z-[1]" aria-hidden="true" />

      <div className="relative z-10 h-full w-full">
        <UserApp device={device} />
      </div>

      {fabricToggle}

      {fabric && (
        <div className="fixed inset-0 z-30 bg-pantom-bg/95 backdrop-blur-sm overflow-y-auto p-3 md:p-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className="h-[560px] md:h-[calc(100vh-2rem)] rounded-2xl overflow-hidden border border-pantom-border bg-pantom-surface/40 shadow-[0_0_30px_rgba(237,180,11,0.08)]">
            <Screen6 />
          </div>
          <div className="h-[560px] md:h-[calc(100vh-2rem)] rounded-2xl overflow-hidden border border-pantom-border bg-pantom-surface/40 shadow-[0_0_30px_rgba(237,180,11,0.08)]">
            <Screen7 />
          </div>
          <div className="h-[560px] md:h-[calc(100vh-2rem)] rounded-2xl overflow-hidden border border-pantom-border bg-pantom-surface/40 shadow-[0_0_30px_rgba(237,180,11,0.08)]">
            <Screen8 />
          </div>
        </div>
      )}
    </div>
  )
}