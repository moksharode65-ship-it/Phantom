import { create } from 'zustand'

export type Lang = 'EN' | 'HI'

const STRINGS: Record<Lang, Record<string, string>> = {
  EN: {
    sos: 'SOS',
    hold3s: 'HOLD 3S',
    standby: 'STANDBY',
    verified: 'VERIFIED',
    unverified: 'UNVERIFIED',
    trust: 'TRUST',
    drillMode: 'DRILL MODE',
    liveDispatch: 'LIVE DISPATCH',
    relink: 'AUTO RELINK',
    emergency: 'EMERGENCY',
  },
  HI: {
    sos: 'एसओएस',
    hold3s: '3 सेकंड दबाएं',
    standby: 'स्टैंडबाय',
    verified: 'सत्यापित',
    unverified: 'असत्यापित',
    trust: 'विश्वास',
    drillMode: 'अभ्यास मोड',
    liveDispatch: 'लाइव डिस्पैच',
    relink: 'ऑटो रीलिंक',
    emergency: 'आपातकाल',
  },
}

export function t(lang: Lang, key: string) {
  return STRINGS[lang][key] ?? STRINGS.EN[key] ?? key
}

interface I18nState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export function createI18nStore(persistKey?: string) {
  let initial: Lang = 'EN'
  if (persistKey && typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(persistKey)
      if (saved === 'EN' || saved === 'HI') initial = saved
    } catch {
      // ignore
    }
  }
  return create<I18nState>()((set) => ({
    lang: initial,
    setLang: (lang) => {
      if (persistKey && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(persistKey, lang)
        } catch {
          // ignore
        }
      }
      set({ lang })
    },
  }))
}

export const useI18n = createI18nStore('pantom-device-a-lang')
