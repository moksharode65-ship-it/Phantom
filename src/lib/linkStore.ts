import { create, type UseBoundStore, type StoreApi } from 'zustand'
import { setAllLinked, emergencyClient, type EmergencyClient } from '@/lib/emergencyClient'

export const AUTO_RELINK_S = 8

export interface LinkState {
  linked: boolean
  showLines: boolean
  autoRelinkAt: number | null
  setLinked: (v: boolean) => void
  setShowLines: (v: boolean) => void
  unlinkTemporarily: () => void
  relinkNow: () => void
}

export type LinkStore = UseBoundStore<StoreApi<LinkState>>

export function createLinkStore(client?: EmergencyClient) {
  return create<LinkState>()((set) => ({
    linked: true,
    showLines: false,
    autoRelinkAt: null,
    setLinked: (v) => set({ linked: v }),
    setShowLines: (v) => set({ showLines: v }),
    unlinkTemporarily: () => {
      if (client) client.setLinked(false)
      else setAllLinked(false)
      set({ linked: false, autoRelinkAt: Date.now() + AUTO_RELINK_S * 1000 })
    },
    relinkNow: () => {
      if (client) client.setLinked(true)
      else setAllLinked(true)
      set({ linked: true, autoRelinkAt: null })
    },
  }))
}

export const useLinkStore = createLinkStore(emergencyClient)
