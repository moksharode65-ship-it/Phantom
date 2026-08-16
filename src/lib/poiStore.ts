import { create } from 'zustand'
import { nodeDistanceKm } from '@/lib/meshStore'

export type PoiType = 'police' | 'hospital' | 'fire'

export interface Poi {
  id: string
  name: string
  lat: number
  lng: number
  type: PoiType
}

export const POI_META: Record<PoiType, { label: string; color: string }> = {
  police: { label: 'POLICE', color: '#0099ff' },
  hospital: { label: 'HOSPITAL', color: '#00d47e' },
  fire: { label: 'FIRE', color: '#EDB40B' },
}

const OVERPASS = 'https://overpass-api.de/api/interpreter'

export function buildOverpassQuery(lat: number, lng: number, radiusKm: number) {
  return `[out:json][timeout:25];(node[amenity=police](around:${radiusKm * 1000},${lat},${lng});node[amenity=hospital](around:${radiusKm * 1000},${lat},${lng});node[amenity=fire_station](around:${radiusKm * 1000},${lat},${lng}););out;`
}

interface PoiState {
  pois: Poi[]
  status: 'IDLE' | 'LOADING' | 'OK' | 'ERROR'
  lastRefreshed: number | null
  fetchNearby: (lat: number, lng: number, radiusKm?: number) => Promise<void>
}

export function poiDistanceKm(lat: number, lng: number, poi: Poi) {
  return nodeDistanceKm(lat, lng, poi.lat, poi.lng)
}

export const usePoiStore = create<PoiState>()((set, get) => ({
  pois: [],
  status: 'IDLE',
  lastRefreshed: null,
  fetchNearby: async (lat, lng, radiusKm = 3) => {
    if (get().status === 'LOADING') return
    if (get().status === 'OK' && Date.now() - (get().lastRefreshed ?? 0) < 60000) return
    set({ status: 'LOADING' })
    try {
      const q = buildOverpassQuery(lat, lng, radiusKm)
      const res = await fetch(`${OVERPASS}?data=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error(`overpass ${res.status}`)
      const data = await res.json()
      const pois: Poi[] = (data.elements ?? [])
        .filter((el: { lat?: number; lon?: number; tags?: Record<string, string> }) => el.lat != null && el.lon != null && el.tags?.amenity != null)
        .map((el: { id: number; lat: number; lon: number; tags?: Record<string, string> }) => ({
          id: `poi-${el.id}`,
          name: el.tags?.name || `${POI_META[el.tags!.amenity as PoiType]?.label ?? 'SERVICE'} STATION`,
          lat: el.lat,
          lng: el.lon,
          type: (el.tags!.amenity === 'police' ? 'police' : el.tags!.amenity === 'hospital' ? 'hospital' : 'fire') as PoiType,
        }))
      set({ pois, status: 'OK', lastRefreshed: Date.now() })
    } catch {
      set({ status: 'ERROR' })
    }
  },
}))
