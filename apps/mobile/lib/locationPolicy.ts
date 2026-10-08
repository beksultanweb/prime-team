// Timezone is a business policy, never the device's local timezone.
export const LOCATION_TIMEZONE = 'Asia/Almaty'
export const LOCATION_INTERVAL = 5 * 60 * 1000
export const MAX_PENDING_POINTS = 1
export type LocationPoint = { timestamp: number, latitude: number, longitude: number, accuracy: number }

export function isLocationWindow(timestamp = Date.now()): boolean {
    if (!Number.isFinite(timestamp)) return false
    const hour = Number(new Intl.DateTimeFormat('en-GB', {
        timeZone: LOCATION_TIMEZONE, hour: '2-digit', hourCycle: 'h23',
    }).format(new Date(timestamp)))
    return hour >= 7 && hour < 21
}
export const locationSlot = (timestamp: number) => Math.floor(timestamp / LOCATION_INTERVAL)

export function locationPoint(location: {
    timestamp: number, mocked?: boolean,
    coords: { latitude: number, longitude: number, accuracy: number | null },
}, now = Date.now()): LocationPoint | null {
    const { latitude, longitude, accuracy } = location.coords
    if (location.mocked || accuracy === null || accuracy < 0 || accuracy > 1000 ||
        ![location.timestamp, latitude, longitude, accuracy].every(Number.isFinite) ||
        Math.abs(now - location.timestamp) > 60_000 || !isLocationWindow(location.timestamp) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
    return { timestamp: Math.trunc(location.timestamp), latitude: Number(latitude.toFixed(7)),
        longitude: Number(longitude.toFixed(7)), accuracy: Number(accuracy.toFixed(1)) }
}

export function pendingPoints(points: LocationPoint[], now = Date.now()): LocationPoint[] {
    const seen = new Set<number>()
    return [...points].sort((a, b) => a.timestamp - b.timestamp).filter(point => {
        const slot = locationSlot(point.timestamp)
        if (!isLocationWindow(point.timestamp) || point.timestamp < now - 10 * 60 * 1000 ||
            point.timestamp > now + 30_000 || seen.has(slot)) return false
        seen.add(slot)
        return true
    }).slice(-MAX_PENDING_POINTS)
}
