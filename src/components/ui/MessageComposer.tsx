'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Mic, Paperclip, Smile, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageComposerProps {
  onSend: (msg: { to: string; priority: string; content: string }) => void
  className?: string
}

const PRIORITIES = [
  { value: 'NORMAL', label: 'Normal', color: 'text-pantom-textMuted' },
  { value: 'HIGH', label: 'High', color: 'text-pantom-blue' },
  { value: 'URGENT', label: 'Urgent', color: 'text-pantom-gold' },
  { value: 'EMERGENCY', label: 'Emergency', color: 'text-pantom-red' },
]

export function MessageComposer({ onSend, className }: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT' | 'EMERGENCY'>('NORMAL')
  const [to, setTo] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [content])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !to.trim()) return
    
    const messageData = {
      to: to.trim(),
      priority,
      content: content.trim(),
      from: 'PNT-7K9M',
      id: `MSG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      timestamp: Date.now(),
      route: ['PNT-7K9M', 'PNT-3A2F', to.trim()],
    }

    // Store in localStorage for Screen4 to receive
    localStorage.setItem('pantom_latest_message', JSON.stringify(messageData))
    
    // Also dispatch storage event for cross-tab
    window.dispatchEvent(new StorageEvent('storage', { 
      key: 'pantom_message_sent', 
      newValue: JSON.stringify(messageData) 
    }))

    onSend(messageData)
    setContent('')
    setTo('')
  }

  return (
    <form onSubmit={handleSubmit} className={cn('pointer-events-auto', className)}>
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1">
          <input
            type="text"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="Destination Node ID (e.g., PNT-4B9L)"
            className="w-full px-3 py-2 bg-pantom-bg/80 border border-pantom-border rounded-xl text-pantom-text text-[13px] font-mono placeholder-pantom-textDim focus:border-pantom-gold focus:outline-none focus:ring-1 focus:ring-pantom-gold transition-all"
            aria-label="Destination node"
          />
        </div>

        <select
          value={priority}
          onChange={e => setPriority(e.target.value as any)}
          className="px-3 py-2 bg-pantom-bg/80 border border-pantom-border rounded-xl text-pantom-text text-[11px] font-medium focus:border-pantom-gold focus:outline-none focus:ring-1 focus:ring-pantom-gold transition-all cursor-pointer"
          aria-label="Message priority"
        >
          {PRIORITIES.map(p => (
            <option key={p.value} value={p.value} className="bg-pantom-surface">{p.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Message content…"
          rows={1}
          className="flex-1 px-3 py-2 bg-pantom-bg/80 border border-pantom-border rounded-xl text-pantom-text text-[13px] placeholder-pantom-textDim focus:border-pantom-gold focus:outline-none focus:ring-1 focus:ring-pantom-gold transition-all resize-none min-h-[44px] max-h-[120px]"
          aria-label="Message content"
        />

        <button
          type="submit"
          disabled={!content.trim() || !to.trim()}
          className={cn(
            'p-3 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
            content.trim() && to.trim()
              ? 'bg-pantom-gold text-pantom-bg hover:shadow-glow-gold'
              : 'bg-pantom-border text-pantom-textDim cursor-not-allowed'
          )}
          aria-label="Send message"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-1 mt-2 text-[12px] text-pantom-textDim">
        <span className="px-2 py-1 bg-pantom-bg/50 border border-pantom-border rounded text-pantom-textMuted font-mono">
          TTL: 10 hops
        </span>
        <span className="px-2 py-1 bg-pantom-bg/50 border border-pantom-border rounded text-pantom-textMuted font-mono">
          E2E Encrypted
        </span>
        <span className="flex-1" />
        <div className="flex items-center gap-1">
          <button type="button" className="p-2 text-pantom-textMuted hover:text-pantom-gold transition-colors" aria-label="Attach file"><Paperclip className="h-4 w-4" /></button>
          <button type="button" className="p-2 text-pantom-textMuted hover:text-pantom-gold transition-colors" aria-label="Voice message"><Mic className="h-4 w-4" /></button>
          <button type="button" className="p-2 text-pantom-textMuted hover:text-pantom-gold transition-colors" aria-label="Emoji"><Smile className="h-4 w-4" /></button>
          <button type="button" className="p-2 text-pantom-textMuted hover:text-pantom-gold transition-colors" aria-label="More options"><MoreHorizontal className="h-4 w-4" /></button>
        </div>
      </div>
    </form>
  )
}