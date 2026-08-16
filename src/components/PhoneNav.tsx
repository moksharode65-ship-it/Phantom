'use client'

import { useState, createContext, useContext, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const MenuContext = createContext<{ isOpen: boolean; toggle: () => void } | null>(null)

export function PhoneNavProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <MenuContext.Provider value={{ isOpen, toggle: () => setIsOpen(!isOpen) }}>
      {children}
    </MenuContext.Provider>
  )
}

export function PhoneNav() {
  const { isOpen, toggle } = useContext(MenuContext)!
  return (
    <>
      <nav className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-5 h-14 mt-[20px]">
        <div className="flex items-center gap-2">
          <svg className="h-7 w-auto text-pantom-gold" viewBox="0 0 120 40" fill="none" aria-hidden="true">
            <path d="M0 30 L15 10 L30 30 M30 10 L30 30 M30 30 L45 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M55 10 L55 30 M55 20 L70 20 M70 10 L70 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <path d="M80 30 Q80 10 95 10 Q110 10 110 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
            <path d="M100 10 L100 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <span className="text-[13px] font-medium text-pantom-textMuted tracking-wide uppercase hidden sm:block">FABRIC</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggle}
            className="h-10 w-10 flex items-center justify-center transition-all"
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <X className="h-5 w-5 text-white" strokeWidth={2.5} />
            ) : (
              <>
                <div className="w-[21px] h-[2px] bg-white rounded-full mb-[5px]" />
                <div className="w-[10px] h-[2px] bg-white rounded-full" />
              </>
            )}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(160deg, #1a0000 0%, #8B0000 40%, #E10600 100%)',
            }}
            onClick={toggle}
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
          >
            <motion.nav
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex flex-col items-center gap-8 text-center"
            >
              {['Biography', 'Statistics', 'Career'].map((item, i) => (
                <motion.a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-3xl sm:text-4xl font-bold tracking-tight text-white hover:text-pantom-gold transition-colors"
                  style={{
                    transitionDelay: `${0.1 + i * 0.08}s`,
                  }}
                  onClick={toggle}
                >
                  {item}
                </motion.a>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}