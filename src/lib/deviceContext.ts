import { createEmergencyStore, useEmergencyStore, type EmergencyStore } from '@/lib/emergencyStore'
import { createEmergencyClient, emergencyClient, type EmergencyClient } from '@/lib/emergencyClient'
import { createMessageStore, useMessageStore, type MessageStore } from '@/lib/messageStore'
import { createLinkStore, useLinkStore, type LinkStore } from '@/lib/linkStore'
import { createMeshStore, useMeshStore, type MeshStore } from '@/lib/meshStore'
import { createI18nStore, useI18n } from '@/lib/i18n'
import { DEVICE_PROFILES, type DeviceProfile } from '@/lib/deviceProfiles'

export interface DeviceContext {
  appId: string
  profile: DeviceProfile
  store: EmergencyStore
  client: EmergencyClient
  messageStore: MessageStore
  linkStore: LinkStore
  meshStore: MeshStore
  langStore: ReturnType<typeof createI18nStore>
}

export function createDevice(appId: string): DeviceContext {
  const profile = DEVICE_PROFILES[appId]
  if (!profile) throw new Error(`Unknown device profile: ${appId}`)
  const key = appId.toLowerCase()
  const persistKey = `pantom-device-${key}`

  // Device A owns the module singletons so the FABRIC consoles (which share them) stay consistent.
  if (appId === 'A') {
    return {
      appId,
      profile,
      store: useEmergencyStore,
      client: emergencyClient,
      messageStore: useMessageStore,
      linkStore: useLinkStore,
      meshStore: useMeshStore,
      langStore: useI18n,
    }
  }

  const store = createEmergencyStore({ defaultLocation: profile.home, persistKey })
  const client = createEmergencyClient(store, { senderName: profile.deviceName, sourceId: profile.userId })
  const messageStore = createMessageStore(`pantom-message-storage-${key}`)
  const linkStore = createLinkStore(client)
  const others = Object.values(DEVICE_PROFILES).filter((p) => p.appId !== appId)
  const extra: [string, number, number][] = others.map((p) => [
    p.meshNode,
    p.home.lat - profile.home.lat,
    p.home.lng - profile.home.lng,
  ])
  const meshStore = createMeshStore(profile.home.lat, profile.home.lng, profile.meshNode, extra)
  const langStore = createI18nStore(`${persistKey}-lang`)
  return { appId, profile, store, client, messageStore, linkStore, meshStore, langStore }
}

export const DEVICE_KEYS = Object.keys(DEVICE_PROFILES)
