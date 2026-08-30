import { LocateFixed, LoaderCircle } from 'lucide-react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { Mission } from '../types/mission'

export type MapLocation = {
  latitude: number
  longitude: number
}

type MissionMapProps = {
  focusUserLocationRequest: number
  isLocating: boolean
  locationMessage: string
  missions: Mission[]
  onLocate: () => void
  onOpen: (mission: Mission) => void
  onSelect: (mission: Mission) => void
  origin: MapLocation
  originAccuracyMeters: number | null
  showOrigin: boolean
  selectedMission: Mission | null
}

const geoapifyApiKey = import.meta.env.VITE_GEOAPIFY_API_KEY
const privacyRadiusMeters = 100
const privacySourceId = 'mission-privacy-zones'
const privacyFillLayerId = 'mission-privacy-zones-fill'
const privacyLineLayerId = 'mission-privacy-zones-line'

const geoapifyRasterStyle: maplibregl.StyleSpecification | undefined = geoapifyApiKey
  ? {
      version: 8,
      sources: {
        geoapify: {
          type: 'raster',
          tiles: [`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(geoapifyApiKey)}`],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors · © Geoapify',
        },
      },
      layers: [{ id: 'geoapify', type: 'raster', source: 'geoapify' }],
    }
  : undefined

function circleCoordinates(latitude: number, longitude: number, radiusMeters: number) {
  const points: [number, number][] = []
  const latitudeRadius = radiusMeters / 111_320
  const longitudeRadius = radiusMeters / (111_320 * Math.cos((latitude * Math.PI) / 180))
  for (let index = 0; index <= 48; index += 1) {
    const angle = (index / 48) * Math.PI * 2
    points.push([
      longitude + longitudeRadius * Math.cos(angle),
      latitude + latitudeRadius * Math.sin(angle),
    ])
  }
  return points
}

function privacyZoneCollection(missions: Mission[]) {
  return {
    type: 'FeatureCollection' as const,
    features: missions.flatMap((mission) => {
      if (mission.approximateLatitude == null || mission.approximateLongitude == null) return []
      return [{
        type: 'Feature' as const,
        properties: { urgent: mission.isUrgent },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[circleCoordinates(mission.approximateLatitude, mission.approximateLongitude, privacyRadiusMeters)]].flat(),
        },
      }]
    }),
  }
}

export function MissionMap({
  focusUserLocationRequest,
  isLocating,
  locationMessage,
  missions,
  onLocate,
  onOpen,
  onSelect,
  origin,
  originAccuracyMeters,
  showOrigin,
  selectedMission,
}: MissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const missionMarkersRef = useRef<maplibregl.Marker[]>([])
  const originMarkerRef = useRef<maplibregl.Marker | null>(null)
  const initialOriginRef = useRef(origin)

  useEffect(() => {
    if (!containerRef.current || !geoapifyRasterStyle) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: geoapifyRasterStyle,
      center: [initialOriginRef.current.longitude, initialOriginRef.current.latitude],
      zoom: 11,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    return () => {
      missionMarkersRef.current.forEach((marker) => marker.remove())
      missionMarkersRef.current = []
      originMarkerRef.current?.remove()
      originMarkerRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const updateMap = () => {
      missionMarkersRef.current.forEach((marker) => marker.remove())
      missionMarkersRef.current = []
      originMarkerRef.current?.remove()
      originMarkerRef.current = null

      if (showOrigin) {
        const originElement = document.createElement('div')
        const accuracyLabel = originAccuracyMeters == null ? '' : `, précision ${Math.round(originAccuracyMeters)} mètres`
        originElement.setAttribute('aria-label', `Votre position actuelle${accuracyLabel}`)
        originElement.style.width = '20px'
        originElement.style.height = '20px'
        originElement.style.borderRadius = '999px'
        originElement.style.background = '#0ea5e9'
        originElement.style.border = '4px solid white'
        originElement.style.boxShadow = '0 0 0 8px rgb(14 165 233 / 20%), 0 2px 8px rgb(15 23 42 / 35%)'
        originMarkerRef.current = new maplibregl.Marker({ element: originElement })
          .setLngLat([origin.longitude, origin.latitude])
          .addTo(map)
      }

      const bounds = new maplibregl.LngLatBounds()
      for (const mission of missions) {
        if (mission.approximateLatitude == null || mission.approximateLongitude == null) continue
        const markerButton = document.createElement('button')
        markerButton.type = 'button'
        markerButton.setAttribute('aria-label', `Sélectionner ${mission.title}, position approximative`)
        markerButton.style.width = selectedMission?.id === mission.id ? '42px' : '36px'
        markerButton.style.height = selectedMission?.id === mission.id ? '42px' : '36px'
        markerButton.style.borderRadius = '999px 999px 999px 4px'
        markerButton.style.transform = 'rotate(-45deg)'
        markerButton.style.border = '4px solid white'
        markerButton.style.background = selectedMission?.id === mission.id ? '#334155' : mission.isUrgent ? '#f43f5e' : '#0ea5e9'
        markerButton.style.boxShadow = '0 4px 12px rgb(15 23 42 / 30%)'
        markerButton.style.cursor = 'pointer'
        markerButton.addEventListener('click', () => onSelect(mission))
        missionMarkersRef.current.push(new maplibregl.Marker({ element: markerButton, anchor: 'bottom' })
          .setLngLat([mission.approximateLongitude, mission.approximateLatitude])
          .addTo(map))
        bounds.extend([mission.approximateLongitude, mission.approximateLatitude])
      }

      const zoneData = privacyZoneCollection(missions)
      const source = map.getSource(privacySourceId) as maplibregl.GeoJSONSource | undefined
      if (source) {
        source.setData(zoneData)
      } else {
        map.addSource(privacySourceId, { type: 'geojson', data: zoneData })
        map.addLayer({
          id: privacyFillLayerId,
          type: 'fill',
          source: privacySourceId,
          paint: {
            'fill-color': ['case', ['boolean', ['get', 'urgent'], false], '#fb7185', '#38bdf8'],
            'fill-opacity': 0.14,
          },
        })
        map.addLayer({
          id: privacyLineLayerId,
          type: 'line',
          source: privacySourceId,
          paint: {
            'line-color': ['case', ['boolean', ['get', 'urgent'], false], '#f43f5e', '#0284c7'],
            'line-width': 1.5,
            'line-dasharray': [2, 2],
          },
        })
      }

      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 58, maxZoom: 13, duration: 450 })
    }

    if (map.isStyleLoaded()) updateMap()
    else map.once('load', updateMap)
    return () => { map.off('load', updateMap) }
  }, [missions, onSelect, origin, originAccuracyMeters, selectedMission, showOrigin])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !showOrigin || focusUserLocationRequest === 0) return
    map.easeTo({ center: [origin.longitude, origin.latitude], zoom: 15, duration: 700 })
  }, [focusUserLocationRequest, origin, showOrigin])

  if (!geoapifyApiKey) {
    return <div className="mt-4 rounded-[24px] bg-rose-50 p-6 text-center text-sm font-semibold text-rose-700">La carte est temporairement indisponible.</div>
  }

  return (
    <section className="relative mt-4 h-[470px] overflow-hidden rounded-[24px] border border-sky-100 bg-sky-50" aria-label="Carte des missions">
      <div className="size-full" ref={containerRef} />
      <button className="absolute left-3 top-3 z-10 flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-sky-700 shadow-lg disabled:opacity-60" disabled={isLocating} onClick={onLocate} type="button">
        {isLocating ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : <LocateFixed aria-hidden="true" size={18} />}
        {isLocating ? 'Localisation…' : 'Me situer'}
      </button>
      <div className="absolute bottom-3 left-3 z-10 rounded-full bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-md">
        <span className="mr-1.5 inline-block size-3 rounded-full border border-dashed border-sky-600 bg-sky-200/60 align-[-2px]" />Zone indicative ±100 m
      </div>
      {locationMessage && <p className="absolute left-3 right-3 top-16 z-10 rounded-[14px] bg-amber-50/95 p-3 text-xs leading-5 text-amber-800 shadow" role="status">{locationMessage}</p>}
      {selectedMission && (
        <button className="absolute inset-x-3 bottom-14 z-10 flex gap-3 rounded-[18px] bg-white p-3 text-left shadow-lg" onClick={() => onOpen(selectedMission)} type="button">
          <img alt="" className="size-16 rounded-[14px] object-cover" src={selectedMission.coverImageUrl} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{selectedMission.title}</span><span className="mt-1 block text-xs text-slate-500">{selectedMission.generalArea}</span><span className="mt-1 block text-xs font-bold text-sky-600">{selectedMission.points} pts</span></span>
        </button>
      )}
    </section>
  )
}
