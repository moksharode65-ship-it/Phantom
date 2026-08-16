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

const PHONE_PERSIST_KEY = 'pantom-phone-profile'
const PHONE_PALETTE: { hex: string; deep: string }[] = [
  { hex: '#DC2626', deep: '#991B1B' },
  { hex: '#2563EB', deep: '#1D4ED8' },
  { hex: '#16A34A', deep: '#14532D' },
  { hex: '#7C3AED', deep: '#5B21B6' },
  { hex: '#D97706', deep: '#92400E' },
]

function randomToken(len: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function generatePhoneProfile(): DeviceProfile {
  const token = randomToken(4)
  const accent = PHONE_PALETTE[token.charCodeAt(0) % PHONE_PALETTE.length]
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const model = /iPhone/i.test(ua) ? 'iPhone' : /Android/i.test(ua) ? 'Android' : 'Desktop'
  const os = /iPhone/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : 'Web'
  return {
    appId: 'phone',
    deviceName: `PHONE-${token}`,
    userId: `USER-${token}`,
    meshNode: `PNT-${token}`,
    imei: `91000-0099-${token}`,
    model,
    os,
    battery: 45 + Math.floor(Math.random() * 50),
    signalDbm: -(45 + Math.floor(Math.random() * 25)),
    radioBattery: 45 + Math.floor(Math.random() * 40),
    packets: { sent: 0, retried: 0, lost: 0 },
    accent: accent.hex,
    accentDeep: accent.deep,
    home: { lat: 19.076, lng: 72.8777 },
    medical: '',
    bio: '',
    blood: 'O+',
  }
}

function loadPhoneProfile(): DeviceProfile {
  try {
    const raw = localStorage.getItem(PHONE_PERSIST_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved?.deviceName) return saved
    }
  } catch {
    // fall through and regenerate
  }
  const profile = generatePhoneProfile()
  try {
    localStorage.setItem(PHONE_PERSIST_KEY, JSON.stringify(profile))
  } catch {
    // private mode — identity lives for this session only
  }
  return profile
}

// Real-device entry: every phone that opens the app becomes its own user
// automatically (identity persists per browser via localStorage). Uses the
// module singletons so the FABRIC dispatch consoles stay in sync with this phone.
export function createPhoneDevice(): DeviceContext {
  const profile = loadPhoneProfile()
  emergencyClient.setIdentity(profile.deviceName, profile.userId)
  const meshStore = createMeshStore(profile.home.lat, profile.home.lng, profile.meshNode, [])
  const messageStore = createMessageStore('pantom-phone-messages')
  const langStore = createI18nStore('pantom-phone-lang')
  return {
    appId: profile.appId,
    profile,
    store: useEmergencyStore,
    client: emergencyClient,
    messageStore,
    linkStore: useLinkStore,
    meshStore,
    langStore,
  }
}
