import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { Mission } from '../types/mission'

export type MapLocation = {
  latitude: number
  longitude: number
}

type MissionMapProps = {
  missions: Mission[]
  onOpen: (mission: Mission) => void
  onSelect: (mission: Mission) => void
  origin: MapLocation
  selectedMission: Mission | null
}

const geoapifyApiKey = import.meta.env.VITE_GEOAPIFY_API_KEY

export function MissionMap({ missions, onOpen, onSelect, origin, selectedMission }: MissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const missionMarkersRef = useRef<maplibregl.Marker[]>([])
  const originMarkerRef = useRef<maplibregl.Marker | null>(null)
  const initialOriginRef = useRef(origin)

  useEffect(() => {
    if (!containerRef.current || !geoapifyApiKey) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${encodeURIComponent(geoapifyApiKey)}`,
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

      const originElement = document.createElement('div')
      originElement.setAttribute('aria-label', 'Votre zone de recherche')
      originElement.style.width = '18px'
      originElement.style.height = '18px'
      originElement.style.borderRadius = '999px'
      originElement.style.background = '#38bdf8'
      originElement.style.border = '4px solid white'
      originElement.style.boxShadow = '0 2px 8px rgb(15 23 42 / 35%)'
      originMarkerRef.current = new maplibregl.Marker({ element: originElement })
        .setLngLat([origin.longitude, origin.latitude])
        .addTo(map)

      const bounds = new maplibregl.LngLatBounds()
      bounds.extend([origin.longitude, origin.latitude])

      for (const mission of missions) {
        if (mission.approximateLatitude == null || mission.approximateLongitude == null) continue

        const markerButton = document.createElement('button')
        markerButton.type = 'button'
        markerButton.setAttribute('aria-label', `Sélectionner ${mission.title}`)
        markerButton.style.width = selectedMission?.id === mission.id ? '44px' : '38px'
        markerButton.style.height = selectedMission?.id === mission.id ? '44px' : '38px'
        markerButton.style.borderRadius = '999px 999px 999px 4px'
        markerButton.style.transform = 'rotate(-45deg)'
        markerButton.style.border = '4px solid white'
        markerButton.style.background = selectedMission?.id === mission.id ? '#334155' : mission.isUrgent ? '#f43f5e' : '#0ea5e9'
        markerButton.style.boxShadow = '0 4px 12px rgb(15 23 42 / 30%)'
        markerButton.style.cursor = 'pointer'
        markerButton.addEventListener('click', () => onSelect(mission))

        const marker = new maplibregl.Marker({ element: markerButton, anchor: 'bottom' })
          .setLngLat([mission.approximateLongitude, mission.approximateLatitude])
          .addTo(map)
        missionMarkersRef.current.push(marker)
        bounds.extend([mission.approximateLongitude, mission.approximateLatitude])
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 54, maxZoom: 13, duration: 500 })
      }
    }

    if (map.loaded()) updateMap()
    else map.once('load', updateMap)

    return () => {
      map.off('load', updateMap)
    }
  }, [missions, onSelect, origin, selectedMission])

  if (!geoapifyApiKey) {
    return <div className="mt-4 rounded-[24px] bg-rose-50 p-6 text-center text-sm font-semibold text-rose-700">La carte est temporairement indisponible.</div>
  }

  return (
    <section className="relative mt-4 h-[430px] overflow-hidden rounded-[24px] border border-sky-100 bg-sky-50" aria-label="Carte des missions">
      <div className="size-full" ref={containerRef} />
      {selectedMission && (
        <button
          className="absolute inset-x-3 bottom-3 z-10 flex gap-3 rounded-[18px] bg-white p-3 text-left shadow-lg"
          onClick={() => onOpen(selectedMission)}
          type="button"
        >
          <img alt="" className="size-16 rounded-[14px] object-cover" src={selectedMission.coverImageUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{selectedMission.title}</span>
            <span className="mt-1 block text-xs text-slate-500">{selectedMission.generalArea}</span>
            <span className="mt-1 block text-xs font-bold text-sky-600">{selectedMission.points} pts</span>
          </span>
        </button>
      )}
    </section>
  )
}
