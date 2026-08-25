export const MOROCCO_TIME_ZONE = 'Africa/Casablanca'

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MOROCCO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function zonedParts(date: Date) {
  return Object.fromEntries(
    partsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
}

function timeZoneOffsetMilliseconds(date: Date) {
  const parts = zonedParts(date)
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ) - Math.floor(date.getTime() / 1000) * 1000
}

export function parseMoroccoDateTimeInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return new Date(Number.NaN)

  const [, year, month, day, hour, minute] = match.map(Number)
  const wallClockTime = Date.UTC(year, month - 1, day, hour, minute)
  let instant = wallClockTime

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextInstant = wallClockTime - timeZoneOffsetMilliseconds(new Date(instant))
    if (nextInstant === instant) break
    instant = nextInstant
  }

  const result = new Date(instant)
  const parts = zonedParts(result)
  if (
    parts.year !== year || parts.month !== month || parts.day !== day
    || parts.hour !== hour || parts.minute !== minute
  ) return new Date(Number.NaN)

  return result
}

export function toMoroccoDateTimeInput(value: string) {
  const parts = zonedParts(new Date(value))
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}
