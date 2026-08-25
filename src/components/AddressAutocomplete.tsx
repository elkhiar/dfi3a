import { CheckCircle2, LoaderCircle, MapPin, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

export type AddressSelection = {
  formatted: string
  latitude: number
  longitude: number
  city: string
  generalArea: string
}

type GeoapifyResult = {
  formatted?: string
  lat?: number
  lon?: number
  city?: string
  suburb?: string
  district?: string
  county?: string
  state?: string
}

type Props = {
  onSelect: (selection: AddressSelection | null) => void
  selection: AddressSelection | null
}

const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined

export function AddressAutocomplete({ onSelect, selection }: Props) {
  const [query, setQuery] = useState(selection?.formatted ?? '')
  const [suggestions, setSuggestions] = useState<GeoapifyResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const search = query.trim()
    if (!apiKey || search.length < 3 || search === selection?.formatted) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setIsLoading(true)
      const params = new URLSearchParams({
        text: search,
        format: 'json',
        limit: '5',
        lang: 'fr',
        filter: 'countrycode:ma',
        bias: 'proximity:-7.5898,33.5731',
        apiKey,
      })

      void fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('address_search_failed')
          return response.json() as Promise<{ results?: GeoapifyResult[] }>
        })
        .then((payload) => setSuggestions(payload.results ?? []))
        .catch((error) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setErrorMessage('La recherche d’adresse est momentanément indisponible.')
        })
        .finally(() => setIsLoading(false))
    }, 350)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query, selection?.formatted])

  const choose = (result: GeoapifyResult) => {
    if (!result.formatted || result.lat == null || result.lon == null) return
    const nextSelection: AddressSelection = {
      formatted: result.formatted,
      latitude: result.lat,
      longitude: result.lon,
      city: result.city || result.county || result.state || 'Maroc',
      generalArea: result.suburb || result.district || result.city || result.county || 'Zone indiquée',
    }
    setQuery(nextSelection.formatted)
    setSuggestions([])
    setErrorMessage('')
    onSelect(nextSelection)
  }

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-semibold">
          <span>Adresse du rendez-vous</span><span className="text-[10px] font-bold uppercase tracking-wide text-rose-500">Obligatoire</span>
        </span>
        <span className="relative block">
          <Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
          <input
            autoComplete="street-address"
            className="min-h-13 w-full rounded-[18px] border border-slate-300 bg-white pl-12 pr-11 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            onChange={(event) => {
              setQuery(event.target.value)
              setSuggestions([])
              setErrorMessage('')
              onSelect(null)
            }}
            placeholder="Rechercher une adresse ou un lieu au Maroc"
            required
            value={query}
          />
          {isLoading && <LoaderCircle aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-sky-500" size={19} />}
          {!isLoading && selection && <CheckCircle2 aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600" size={19} />}
        </span>
      </label>

      {!apiKey && <p className="mt-2 rounded-[14px] bg-amber-50 p-3 text-xs leading-5 text-amber-800">La recherche d’adresse sera activée dès que la clé Geoapify sera ajoutée.</p>}
      {errorMessage && <p className="mt-2 text-xs text-rose-600" role="alert">{errorMessage}</p>}

      {suggestions.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-lg">
          {suggestions.map((suggestion, index) => (
            <button className="flex w-full items-start gap-3 border-b border-slate-100 p-3 text-left last:border-0 hover:bg-sky-50" key={`${suggestion.formatted}-${index}`} onClick={() => choose(suggestion)} type="button">
              <MapPin aria-hidden="true" className="mt-0.5 shrink-0 text-sky-500" size={18} />
              <span className="text-sm leading-5 text-slate-700">{suggestion.formatted}</span>
            </button>
          ))}
        </div>
      )}

      {selection && <div className="mt-3 rounded-[16px] bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-800">Adresse exacte enregistrée en privé</p><p className="mt-1 text-xs leading-5 text-emerald-700">Les personnes non inscrites verront seulement une zone approximative de 100 mètres autour du lieu.</p></div>}
      <p className="mt-2 text-[10px] text-slate-400">Recherche d’adresse fournie par Geoapify · données OpenStreetMap et partenaires.</p>
    </div>
  )
}
