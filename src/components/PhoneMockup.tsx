'use client'

import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PhoneMockupProps {
  screen: ReactNode
  className?: string
  style?: React.CSSProperties
  deviceColor?: 'black' | 'titanium' | 'white'
  showButtons?: boolean
}

export const PhoneMockup = forwardRef<HTMLDivElement, PhoneMockupProps>(
  ({ screen, className, deviceColor = 'black', showButtons = true, ...props }, ref) => {
    const frameRef = useRef<HTMLDivElement>(null)
    const screenRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)

    useEffect(() => {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width
          const height = entry.contentRect.height
          setScale(Math.min(width / 390, height / 848))
        }
      })
      if (screenRef.current) ro.observe(screenRef.current)
      return () => ro.disconnect()
    }, [])

    const frameColors = {
      black: 'bg-black',
      titanium: 'bg-neutral-900',
      white: 'bg-neutral-100',
    }

    const frameBorders = {
      black: 'ring-white/10',
      titanium: 'ring-white/15',
      white: 'ring-neutral-300/50',
    }

    // iPhone 16 Pro dimensions: 71.9mm × 150.0mm (ratio ~19.5:9 ≈ 2.087)
    // Screen: 2622 × 1206 @ 460 PPI
    
    return (
      <div ref={ref} className={cn('flex flex-col items-center', className)} {...props}>
        <div
          ref={frameRef}
          className={cn(
            'relative rounded-[24px]',
            frameColors[deviceColor],
            'p-[6px]',
            'shadow-phone',
            'phone-frame',
            'ring-1',
            frameBorders[deviceColor]
          )}
          style={{ 
            width: '360px', 
            height: '754px',
            maxWidth: '100vw',
            maxHeight: '90vh',
          }}
        >
          <div className="absolute inset-0 rounded-[24px] ring-1 ring-white/15" aria-hidden="true" />

          <div
            ref={screenRef}
            className="relative w-full h-full rounded-[20px] overflow-hidden bg-pantom-bg"
            style={{ 
              width: '100%',
              height: '100%',
            }}
          >
            <div className="absolute top-[2.5%] left-1/2 -translate-x-1/2 w-[28%] h-[3.5%] bg-black rounded-[12px] z-50" aria-hidden="true" />

            <div
              style={{
                width: '390px',
                height: '848px',
                transformOrigin: 'top left',
                transform: `scale(${scale})`,
              }}
            >
              {screen}
            </div>
          </div>

          {showButtons && (
            <>
              <div className="absolute left-[-3px] top-[19%] w-[3px] h-[4.5%] bg-neutral-700 rounded-r" aria-hidden="true" />
              <div className="absolute left-[-3px] top-[26%] w-[3px] h-[7.3%] bg-neutral-700 rounded-r" aria-hidden="true" />
              <div className="absolute left-[-3px] top-[35.5%] w-[3px] h-[7.3%] bg-neutral-700 rounded-r" aria-hidden="true" />
              <div className="absolute right-[-3px] top-[30.8%] w-[3px] h-[11.4%] bg-neutral-700 rounded-l" aria-hidden="true" />
            </>
          )}
        </div>

        <div className="mt-3 w-full h-6 bg-gradient-to-t from-pantom-bg/60 to-transparent rounded-[20px] opacity-30 blur" aria-hidden="true" />
      </div>
    )
  }
)

PhoneMockup.displayName = 'PhoneMockup'