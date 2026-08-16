'use client'

import { Zap } from 'lucide-react'
import { PhoneNav, PhoneNavProvider } from '@/components'
import { ScreenBackground, MessageComposer, DeliveryTimeline, PortMap } from '@/components'
import { useMessageStore, type Message } from '@/lib/messageStore'

const demoMessages: Message[] = [
  { id: 'MSG-928173', from: 'PNT-7K9M', to: 'PNT-4B9L', content: 'Network status check', priority: 'NORMAL', route: ['PNT-7K9M', 'PNT-3A2F', 'PNT-4B9L'], directAvailable: false, status: 'DELIVERED', timestamp: Date.now() - 120000, acks: ['NODE_RECV', 'RELAY_CONFIRM', 'E2E_CONFIRM'] },
  { id: 'MSG-928174', from: 'PNT-7K9M', to: 'PNT-1Z6Q', content: 'High priority relay test', priority: 'HIGH', route: ['PNT-7K9M', 'PNT-1Z6Q'], directAvailable: true, status: 'DELIVERED', timestamp: Date.now() - 45000, acks: ['NODE_RECV', 'E2E_CONFIRM'] },
  { id: 'MSG-928175', from: 'PNT-7K9M', to: 'PNT-9H3R', content: 'Urgent: route optimization needed', priority: 'URGENT', route: ['PNT-7K9M', 'PNT-8K1M', 'PNT-2E7Y', 'PNT-9H3R'], directAvailable: false, status: 'RELAYING', timestamp: Date.now() - 8000, acks: ['NODE_RECV', 'RELAY_CONFIRM'] },
]

export function Screen2() {
  const { messages: storedMessages, sendMessage } = useMessageStore()

  return (
    <div className="relative w-full h-full flex flex-col bg-pantom-bg overflow-hidden">
      <ScreenBackground />
      <PhoneNavProvider><PhoneNav /></PhoneNavProvider>

      <header className="flex items-center justify-between px-4 py-3 border-b border-pantom-border/50 z-10">
        <div className="flex items-center gap-2">
          <span className="text-pantom-textMuted text-[13px] font-medium tracking-wide">PORT MAP</span>
          <Zap className="h-4 w-4 text-pantom-gold" />
        </div>
        <div className="flex items-center gap-1 text-[11px] text-pantom-textMuted">
          <span className="w-1.5 h-1.5 bg-pantom-green rounded-full animate-pulse-signal" /> LIVE
        </div>
      </header>

      <main className="flex-1 min-h-0 relative z-10 p-3">
        <PortMap className="w-full h-full" />
      </main>

      <footer className="relative z-10 flex flex-col">
        <div className="flex-1 min-h-0 overflow-hidden border-t border-pantom-border/50 bg-pantom-surface/60 backdrop-blur">
          <DeliveryTimeline messages={storedMessages.length ? storedMessages : demoMessages} />
        </div>
        <div className="p-3 border-t border-pantom-border/50 bg-pantom-surface/80 backdrop-blur">
          <MessageComposer onSend={(msg) => {
            sendMessage({
              from: 'PNT-7K9M',
              to: msg.to,
              content: msg.content,
              priority: msg.priority as Message['priority'],
              directAvailable: false,
            })
          }} />
        </div>
      </footer>
    </div>
  )
}