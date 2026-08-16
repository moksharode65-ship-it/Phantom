'use client'

import type { ServiceType } from '@/lib/emergencyStore'

const WS_BASE = (import.meta.env.VITE_WS_URL as string | undefined)?.trim().replace(/\/+$/, '')

function httpBase(): string {
  if (WS_BASE) return WS_BASE.startsWith('wss://') ? `https://${WS_BASE.slice(6)}` : `http://${WS_BASE.slice(5)}`
  return 'http://localhost:8080'
}

export type PushState = 'unsupported' | 'idle' | 'denied' | 'on'

const supported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buf = new ArrayBuffer(rawData.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < rawData.length; ++i) view[i] = rawData.charCodeAt(i)
  return buf
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const sub = await navigator.serviceWorker
    .getRegistration()
    .then((r) => r?.pushManager.getSubscription())
    .catch(() => null)
  return sub ? 'on' : 'idle'
}

export async function enablePushAlerts(type: ServiceType, label: string): Promise<{ ok: boolean; reason?: string }> {
  if (!supported()) return { ok: false, reason: 'unsupported' }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: 'denied' }
  let key: string
  try {
    const res = await fetch(`${httpBase()}/vapid-key`)
    if (!res.ok) return { ok: false, reason: 'no-vapid' }
    key = (await res.json()).publicKey
  } catch {
    return { ok: false, reason: 'no-vapid' }
  }
  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })
    }
    const body = { subscription: sub.toJSON(), label }
    const res = await fetch(`${httpBase()}/${type.toLowerCase()}/api/push-subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { ok: false, reason: 'server' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'subscribe-failed' }
  }
}

export async function disablePushAlerts(type: ServiceType): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription().catch(() => null)
  if (!sub) return
  await fetch(`${httpBase()}/${type.toLowerCase()}/api/push-unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}