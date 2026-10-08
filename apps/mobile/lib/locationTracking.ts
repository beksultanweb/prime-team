import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import * as Device from 'expo-device'
import { AppState, Platform } from 'react-native'
import { getAccessToken, getDefaultSite, refreshStoredAccessToken } from './auth'
import { callFrappe, MobileLoginError } from './mobileLogin'
import { SiteInformation } from '../types/SiteInformation'
import { isLocationWindow, LOCATION_INTERVAL, locationPoint, locationSlot, LocationPoint, pendingPoints } from './locationPolicy'

export const LOCATION_TASK = 'prime-team-location-v1'
const CONFIG_KEY = 'prime-team-location-config-v1'
const QUEUE_KEY = 'prime-team-location-queue-v1'
const DEVICE_KEY = 'prime-team-installation-v1'
const API = '/api/method/prime_core.mobile_location.'
type Attendance = { status: string, action?: string, last_action?: string, confirming?: boolean }
type Config = { site: SiteInformation, user: string, notice_hash: string, last_slot: number, last_capture: number, presence?: string, attendance?: Attendance }
export type LocationStatus = { available: boolean, consented: boolean, user: string, notice: string, notice_hash: string,
    in_window: boolean, timezone: string, interval_ms: number, start_hour: number, end_hour: number, gps_attendance?: boolean }
export type LocalLocationState = { enabled: boolean, last_capture: number, pending: number, error: string, background: boolean, presence: string, attendance?: Attendance }
let sequence: Promise<unknown> = Promise.resolve()
let errorMessage = ''
const listeners = new Set<() => void>()
let backgroundPermission = false
let generation = 0
let activeTick: AbortController | null = null
const cancelTick = () => { generation += 1; activeTick?.abort() }
const emit = () => listeners.forEach(fn => fn())
export const subscribeLocation = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
const authenticationFailure = (e: unknown) => {
    const error = e as { status?: number, code?: string }
    return [401, 403].includes(error?.status || 0) || ['invalid_grant', 'invalid_client', 'unauthorized_client'].includes(error?.code || '')
}
const serialize = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = sequence.then(fn)
    sequence = result.catch(() => {})
    return result
}
async function config(): Promise<Config | null> {
    const value = await SecureStore.getItemAsync(CONFIG_KEY)
    if (!value) return null
    try { return JSON.parse(value) } catch { await SecureStore.deleteItemAsync(CONFIG_KEY); return null }
}
async function queue(): Promise<LocationPoint[]> {
    const value = await SecureStore.getItemAsync(QUEUE_KEY)
    try { return pendingPoints(JSON.parse(value || '[]')) } catch { return [] }
}
const saveConfig = (value: Config) => SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(value))
async function deviceMetadata() {
    let id = await SecureStore.getItemAsync(DEVICE_KEY)
    if (!id) {
        id = Crypto.randomUUID()
        await SecureStore.setItemAsync(DEVICE_KEY, id)
    }
    // App installation, not IMEI/MAC/advertising ID; client claims are not attestation.
    return { id, platform: Platform.OS, model: (Device.modelName || '').slice(0, 100) }
}
async function stopNative() {
    if (Platform.OS !== 'web' && await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK)
    }
}
async function clearLocal() {
    // Remove the authorization first, so even a late OS callback cannot save.
    await SecureStore.deleteItemAsync(CONFIG_KEY)
    await SecureStore.deleteItemAsync(QUEUE_KEY)
    try { await stopNative() } finally { backgroundPermission = false; emit() }
}

export async function getLocalLocationState(site: SiteInformation): Promise<LocalLocationState> {
    if (Platform.OS === 'web') return { enabled: false, last_capture: 0, pending: 0, error: 'Доступно только в мобильном приложении.', background: false, presence: 'UNKNOWN' }
    const value = await config()
    const same = value?.site.url === site.url && value.site.sitename === site.sitename
    return { enabled: !!same, last_capture: same ? value.last_capture : 0,
        pending: same ? (await queue()).length : 0, error: errorMessage, background: backgroundPermission,
        presence: same && Date.now() - value.last_capture <= 10 * 60 * 1000 ? value.presence || 'UNKNOWN' : 'UNKNOWN',
        attendance: same ? value.attendance : undefined }
}
export async function getLocationStatus(site: SiteInformation): Promise<LocationStatus> {
    const token = await refreshStoredAccessToken(site)
    return callFrappe<LocationStatus>(site.url + API + 'get_status', { token: token.accessToken })
}

async function ensureNative() {
    if (!isLocationWindow()) { await stopNative(); return }
    backgroundPermission = false
    if (!(await Location.getBackgroundPermissionsAsync()).granted || !(await TaskManager.isAvailableAsync())) { await stopNative(); return }
    if (!(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: LOCATION_INTERVAL, distanceInterval: 0,
            deferredUpdatesInterval: LOCATION_INTERVAL, deferredUpdatesDistance: 0,
            pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true,
            foregroundService: { notificationTitle: 'Prime Team: геопозиция',
                notificationBody: 'Запись с 07:00 до 21:00. Выключить можно в профиле.', killServiceOnDestroy: true },
        })
    }
    backgroundPermission = true
}

export const enableLocationTracking = (site: SiteInformation, status: LocationStatus) => serialize(async () => {
    if (Platform.OS === 'web' || !status.available) throw new Error('Геопозиция недоступна.')
    // This method is called only after the user accepts the visible disclosure.
    const foreground = await Location.requestForegroundPermissionsAsync()
    if (!foreground.granted) throw new Error('Разрешите геопозицию в настройках телефона. Вход и чаты доступны без неё.')
    await Location.requestBackgroundPermissionsAsync() // denial leaves a working foreground mode
    const token = await refreshStoredAccessToken(site)
    const accepted = await callFrappe<LocationStatus>(site.url + API + 'enable_tracking', {
        token: token.accessToken, params: { accept: '1', notice_hash: status.notice_hash },
    })
    await clearLocal()
    await saveConfig({ site, user: accepted.user, notice_hash: accepted.notice_hash, last_slot: -1, last_capture: 0 })
    errorMessage = ''
    try { await ensureNative() }
    catch { backgroundPermission = false; errorMessage = 'Фоновый режим не запустился. Геопозиция доступна при открытом приложении.' }
    emit()
})

export const disableLocationTracking = (site: SiteInformation) => {
    cancelTick()
    return serialize(async () => {
    await clearLocal() // immediate local stop, even offline; then revoke server permission
    try {
        const token = await getAccessToken(site.sitename)
        if (token) await callFrappe(site.url + API + 'disable_tracking', { token: token.accessToken, params: {} })
        errorMessage = ''
    } catch { errorMessage = 'Сбор на этом телефоне остановлен. Не удалось отозвать серверное согласие; повторите выключение при наличии связи.' }
    emit()
    })
}

// Called before logout/site/account change. Does not revoke consent on other devices.
export const stopLocationLocally = (siteName?: string) => {
    cancelTick()
    return serialize(async () => {
    const value = await config()
    if (!siteName || value?.site.sitename === siteName) {
        await clearLocal(); errorMessage = ''; emit()
    }
    })
}

async function tick(locations: Location.LocationObject[] | undefined, signal: AbortSignal) {
    const value = await config()
    if (!value) { await stopNative(); return }
    if ((await getDefaultSite()) !== value.site.sitename) { await clearLocal(); return }
    // No acquisition, queuing or saving outside the daily window, including delayed callbacks.
    if (!isLocationWindow()) {
        await stopNative(); await SecureStore.deleteItemAsync(QUEUE_KEY); emit(); return
    }
    const foreground = await Location.getForegroundPermissionsAsync()
    if (!foreground.granted) { errorMessage = 'Разрешение на геопозицию отозвано.'; await clearLocal(); return }
    const queued = await queue()
    if (!queued.length && locationSlot(Date.now()) <= value.last_slot) { await ensureNative(); return }
    let token
    try {
        token = await refreshStoredAccessToken(value.site, undefined, signal)
        const status = await callFrappe<LocationStatus>(value.site.url + API + 'get_status', { token: token.accessToken, signal })
        if (signal.aborted) return
        if (!status.available || !status.consented || status.user !== value.user || status.notice_hash !== value.notice_hash) {
            errorMessage = 'Отслеживание остановлено: проверьте согласие и настройки в профиле.'
            await clearLocal(); return
        }
    } catch (e) {
        if (signal.aborted) return
        if (authenticationFailure(e)) {
            errorMessage = 'Отслеживание остановлено. Войдите снова и проверьте согласие.'
            await clearLocal(); return
        }
        // Only the latest fix is retained, encrypted; no offline route/history.
        errorMessage = 'Нет связи: на телефоне временно сохранена только последняя геопозиция.'
    }
    if (signal.aborted) return
    if (!isLocationWindow()) { await stopNative(); return }
    if (await Location.hasServicesEnabledAsync()) {
        if (!locations && AppState.currentState === 'active' && locationSlot(Date.now()) > value.last_slot) {
            // No stale last-known fix and no parallel acquisition. Native callback may arrive later.
            let timer: ReturnType<typeof setTimeout> | undefined
            try {
                const current = await Promise.race([
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                    new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 15_000) }),
                ])
                locations = current ? [current] : []
                if (!current) errorMessage = 'Не удалось получить свежую геопозицию. Повторим позже.'
            } finally { if (timer) clearTimeout(timer) }
        }
        if (isLocationWindow()) {
            for (const location of [...(locations || [])].sort((a, b) => a.timestamp - b.timestamp)) {
                const point = locationPoint(location)
                if (!point || locationSlot(point.timestamp) <= value.last_slot) continue
                queued.push(point)
                value.last_slot = locationSlot(point.timestamp); value.last_capture = point.timestamp
            }
        }
    } else { errorMessage = 'Геопозиция телефона выключена.' }
    if (signal.aborted) return
    const pending = pendingPoints(queued)
    await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(pending))
    await saveConfig(value) // persist before upload; failed acknowledgement retries exactly the same slots
    if (pending.length && token) {
        try {
            const result = await callFrappe<{ presence: string, attendance?: Attendance }>(value.site.url + API + 'record_points', {
                token: token.accessToken, signal, params: { notice_hash: value.notice_hash,
                    points: JSON.stringify(pending), device: JSON.stringify(await deviceMetadata()) },
            })
            if (signal.aborted) return
            value.presence = ['IN', 'OUT'].includes(result.presence) ? result.presence : 'UNKNOWN'
            if (result.attendance) value.attendance = result.attendance
            await saveConfig(value)
            await SecureStore.deleteItemAsync(QUEUE_KEY)
            errorMessage = ''
        } catch (e) {
            if (signal.aborted) return
            if (e instanceof MobileLoginError && [400, 401, 403, 417].includes(e.status)) {
                errorMessage = 'Отслеживание остановлено: сервер отклонил геопозицию. Проверьте время, вход и согласие.'
                await clearLocal(); return
            }
            errorMessage = 'Не удалось отправить геопозиции. Повторим при восстановлении связи.'
        }
    }
    await ensureNative()
    emit()
}

export const locationTick = (locations?: Location.LocationObject[]) => {
    const requestedGeneration = generation
    return serialize(async () => {
        if (requestedGeneration !== generation) return
        const controller = new AbortController()
        activeTick = controller
        try { await tick(locations, controller.signal) }
        catch { if (!controller.signal.aborted) { errorMessage = 'Не удалось обновить геопозицию. Проверьте разрешения и подключение.'; emit() } }
        finally { if (activeTick === controller) activeTick = null }
    })
}

// Must be registered at module scope, before React mounts or headless OS execution begins.
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(LOCATION_TASK)) {
    TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
        if (error) { errorMessage = 'Фоновая геопозиция недоступна. Проверьте разрешения.'; emit(); return }
        await locationTick(data?.locations || [])
    })
}
