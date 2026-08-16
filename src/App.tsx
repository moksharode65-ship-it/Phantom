import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Screen1 } from '@/screens/Screen1'
import { Screen2 } from '@/screens/Screen2'
import { Screen3 } from '@/screens/Screen3'
import { Screen4 } from '@/screens/Screen4'
import { Screen5 } from '@/screens/Screen5'
import { Screen6 } from '@/screens/Screen6'
import { Screen7 } from '@/screens/Screen7'
import { Screen8 } from '@/screens/Screen8'
import { Screen9 } from '@/screens/Screen9'
import { UserApp } from '@/screens/UserApp'
import { createDevice, DEVICE_KEYS, type DeviceContext } from '@/lib/deviceContext'
import { PhoneMockup } from '@/components/PhoneMockup'
import { PhoneLinks, LinkBadge } from '@/components/LinkOverlay'

function PhoneRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-4 px-6 ${className ?? ''}`}>
      {children}
    </div>
  )
}

function DevicePhone({ device, delay }: { device: DeviceContext; delay: number }) {
  return (
    <div className="relative" data-phone-link>
      <LinkBadge store={device.linkStore} />
      <PhoneMockup
        screen={<UserApp device={device} />}
        className="animate-fade-slide-up"
        style={{ animationDelay: `${delay}ms` }}
        deviceColor="black"
      />
    </div>
  )
}

export default function App() {
  const [fabric, setFabric] = useState(false)
  const [devices] = useState(() => DEVICE_KEYS.map((appId) => createDevice(appId)))

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
      {fabric ? 'FABRIC ON — DISPATCH BOARD' : 'FABRIC — DISPATCH BOARD OFF'}
    </button>
  )

  return (
    <div className="relative h-screen w-full bg-pantom-bg font-sans antialiased overflow-hidden">
      <div className="absolute inset-0 bg-pantom-bg/85 z-[1]" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(237,180,11,0.06)_0%,transparent_70%),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(0,212,126,0.04)_0%,transparent_60%),radial-gradient(ellipse_50%_60%_at_0%_50%,rgba(184,119,255,0.04)_0%,transparent_50%)] z-[1]" aria-hidden="true" />

      {/* <SyncHub /> */}
      <PhoneLinks />
      {fabricToggle}

      {/* Desktop: all devices (auto) + (FABRIC option: 3 service consoles) */}
      <div className="hidden md:flex relative z-20 w-full h-full flex-col items-center gap-4 py-4 overflow-y-auto overscroll-contain">
        <div className="my-auto flex flex-col items-center gap-4">
          <PhoneRow>
            {devices.map((d, i) => (
              <DevicePhone key={d.appId} device={d} delay={200 + i * 100} />
            ))}
          </PhoneRow>
          {fabric && (
            <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-[620px] rounded-2xl overflow-hidden border border-pantom-border bg-pantom-surface/40 shadow-[0_0_30px_rgba(237,180,11,0.08)]"><Screen6 /></div>
              <div className="h-[620px] rounded-2xl overflow-hidden border border-pantom-border bg-pantom-surface/40 shadow-[0_0_30px_rgba(237,180,11,0.08)]"><Screen7 /></div>
              <div className="h-[620px] rounded-2xl overflow-hidden border border-pantom-border bg-pantom-surface/40 shadow-[0_0_30px_rgba(237,180,11,0.08)]"><Screen8 /></div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: same lineup, stacked */}
      <div className="md:hidden relative z-20 flex flex-col items-center gap-5 py-6 px-4 overflow-y-auto">
        {devices.map((d, i) => (
          <DevicePhone key={d.appId} device={d} delay={200 + i * 100} />
        ))}
        {fabric && (
          <div className="w-full grid grid-cols-1 gap-4">
            <div className="h-[560px] rounded-2xl overflow-hidden border border-pantom-border bg-pantom-surface/40"><Screen6 /></div>
            <div className="h-[560px] rounded-2xl overflow-hidden border border-pantom-border bg-pantom-surface/40"><Screen7 /></div>
            <div className="h-[560px] rounded-2xl overflow-hidden border border-pantom-border bg-pantom-surface/40"><Screen8 /></div>
          </div>
        )}
      </div>

      {/* Hidden screens — kept mounted, not removed (toggle by removing `hidden`) */}
      <div className="hidden">
        <div data-phone-link><PhoneMockup screen={<Screen1 />} deviceColor="titanium" /></div>
        <div data-phone-link><PhoneMockup screen={<Screen2 />} deviceColor="titanium" /></div>
        <div data-phone-link><PhoneMockup screen={<Screen3 />} deviceColor="titanium" /></div>
        <div data-phone-link><PhoneMockup screen={<Screen5 />} deviceColor="black" /></div>
        <div data-phone-link><PhoneMockup screen={<Screen9 />} deviceColor="black" /></div>
        <div data-phone-link><PhoneMockup screen={<Screen4 />} deviceColor="titanium" /></div>
      </div>
    </div>
  )
}
