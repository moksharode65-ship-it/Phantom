import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/emergencyClient', () => ({
  setAllLinked: vi.fn(),
  emergencyClient: { setLinked: vi.fn() },
}))

import { setAllLinked, emergencyClient } from '@/lib/emergencyClient'
import { createLinkStore, useLinkStore, AUTO_RELINK_S } from '@/lib/linkStore'

describe('linkStore auto-relink', () => {
  beforeEach(() => {
    useLinkStore.setState({ linked: true, showLines: false, autoRelinkAt: null })
    vi.clearAllMocks()
  })

  it('starts linked with no pending relink', () => {
    const s = useLinkStore.getState()
    expect(s.linked).toBe(true)
    expect(s.autoRelinkAt).toBeNull()
  })

  it('unlinkTemporarily disconnects the fabric and schedules auto-relink', () => {
    const before = Date.now()
    useLinkStore.getState().unlinkTemporarily()
    const s = useLinkStore.getState()
    expect(s.linked).toBe(false)
    expect(emergencyClient.setLinked).toHaveBeenCalledWith(false)
    expect(s.autoRelinkAt).not.toBeNull()
    expect(s.autoRelinkAt! - before).toBeGreaterThanOrEqual(AUTO_RELINK_S * 1000 - 5)
    expect(s.autoRelinkAt! - before).toBeLessThanOrEqual(AUTO_RELINK_S * 1000 + 5)
  })

  it('relinkNow reconnects and clears the timer', () => {
    useLinkStore.getState().unlinkTemporarily()
    useLinkStore.getState().relinkNow()
    const s = useLinkStore.getState()
    expect(s.linked).toBe(true)
    expect(s.autoRelinkAt).toBeNull()
    expect(emergencyClient.setLinked).toHaveBeenLastCalledWith(true)
  })

  it('setLinked does not touch the auto-relink timer', () => {
    useLinkStore.getState().unlinkTemporarily()
    const at = useLinkStore.getState().autoRelinkAt
    useLinkStore.getState().setLinked(false)
    expect(useLinkStore.getState().autoRelinkAt).toBe(at)
  })

  it('falls back to setAllLinked when no client is bound', () => {
    const bare = createLinkStore()
    bare.getState().unlinkTemporarily()
    expect(setAllLinked).toHaveBeenCalledWith(false)
  })
})
