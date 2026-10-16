const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

function load(file, imports, globals = {}) {
    const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const module = { exports: {} }
    vm.runInNewContext(output, { module, exports: module.exports, require: name => {
        if (!(name in imports)) throw new Error('Unexpected dependency: ' + name)
        return imports[name]
    }, Date, Intl, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, ...globals })
    return module.exports
}
const policy = load('lib/locationPolicy.ts', {})
const stamp = value => Date.parse('2026-10-08T' + value + '+05:00')
const site = { url: 'https://dev.example.test', sitename: 'development.localhost', client_id: 'synthetic-client' }
const status = { available: true, consented: true, user: 'synthetic@example.invalid', notice: 'Synthetic disclosure', notice_hash: 'synthetic-hash' }

function fixture(platform = 'ios') {
    let now = stamp('07:00:10'), started = false, task
    const storage = new Map(), requests = [], native = { reads: 0, starts: 0, stops: 0 }
    const state = { defaultSite: site.sitename, foreground: true, background: true, offline: false,
        authenticated: true, consented: true, user: status.user, pendingStatus: null }
    const DateMock = class extends Date { static now() { return now } }
    const point = () => ({ timestamp: now, coords: { latitude: 0, longitude: 0, accuracy: 25 } })
    class MobileLoginError extends Error { constructor(message, code) { super(message); this.status = code } }
    const imports = {
        'expo-location': {
            Accuracy: { Balanced: 3 },
            requestForegroundPermissionsAsync: async () => ({ granted: state.foreground }),
            requestBackgroundPermissionsAsync: async () => ({ granted: state.background }),
            getForegroundPermissionsAsync: async () => { native.permissions = (native.permissions || 0) + 1; return { granted: state.foreground } },
            getBackgroundPermissionsAsync: async () => ({ granted: state.background }),
            hasServicesEnabledAsync: async () => true,
            hasStartedLocationUpdatesAsync: async () => started,
            startLocationUpdatesAsync: async (_, options) => { started = true; native.starts++; native.options = options },
            stopLocationUpdatesAsync: async () => { started = false; native.stops++ },
            getCurrentPositionAsync: async () => { native.reads++; if (state.positionFailure) throw new Error('position unavailable'); return point() },
        },
        'expo-task-manager': { isAvailableAsync: async () => true, isTaskDefined: () => false, defineTask: (_, handler) => { task = handler } },
        'expo-crypto': { randomUUID: () => '550e8400-e29b-41d4-a716-446655440000' },
        'expo-device': { modelName: 'Synthetic Phone' },
        'expo-secure-store': {
            getItemAsync: async key => storage.get(key) || null,
            setItemAsync: async (key, value) => storage.set(key, value),
            deleteItemAsync: async key => storage.delete(key),
        },
        'react-native': { Platform: { OS: platform }, AppState: { get currentState() { return state.appState || 'active' } } },
        './auth': { getDefaultSite: async () => state.defaultSite,
            getAccessToken: async () => ({ accessToken: 'synthetic-token' }),
            refreshStoredAccessToken: async () => { native.refreshes = (native.refreshes || 0) + 1; return { accessToken: 'synthetic-token' } } },
        './locationPolicy': load('lib/locationPolicy.ts', {}, { Date: DateMock }),
        './mobileLogin': { MobileLoginError, callFrappe: async (url, options) => {
            requests.push({ url, options })
            if (url.endsWith('get_status')) {
                if (state.pendingStatus) await state.pendingStatus
                if (!state.authenticated) throw new MobileLoginError('denied', 401)
                if (state.offline) throw new Error('offline')
                return { ...status, user: state.user, consented: state.consented, notice_hash: state.notice_hash || status.notice_hash, attendance: state.attendance }
            }
            if (url.endsWith('enable_tracking')) return status
            if (url.endsWith('disable_tracking')) return { disabled: true }
            if (state.offline || state.uploadFailure) throw new Error('offline')
            return { acknowledged: JSON.parse(options.params.points).length }
        } },
    }
    const tracking = load('lib/locationTracking.ts', imports, { Date: DateMock })
    return { tracking, state, native, storage, requests, now: value => { now = stamp(value) }, point,
        reload: () => load('lib/locationTracking.ts', imports, { Date: DateMock }),
        background: async locations => {
            state.appState = 'background'
            try { await task({ data: { locations } }) } finally { state.appState = 'active' }
        },
        uploads: () => requests.filter(item => item.url.endsWith('record_points')) }
}

test('offline callback bursts persist the five-minute attempt budget across headless reload', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    f.state.offline = true
    await f.background([f.point()])
    const count = f.requests.length, refreshes = f.native.refreshes
    await f.background([])
    await f.background([f.point()])
    await f.reload().locationTick([f.point()])
    assert.equal(f.requests.length, count)
    assert.equal(f.native.refreshes, refreshes)
    assert.equal(f.native.reads, 0)
    assert.equal((await f.tracking.getLocalLocationState(site)).pending, 1)
})

test('empty iOS callbacks do not refresh auth; deferred batches select newest before elapsed sampling', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    const before = f.requests.length
    await f.background([])
    assert.equal(f.requests.length, before)
    f.now('07:04:59')
    const old = f.point()
    f.now('07:05:10')
    await f.background([old, f.point()])
    assert.equal(JSON.parse(f.uploads().at(-1).options.params.points)[0].timestamp, stamp('07:05:10'))
    f.now('07:10:00'); await f.background([f.point()])
    assert.equal(f.uploads().length, 1)
    f.now('07:10:10'); await f.background([f.point()])
    assert.equal(f.uploads().length, 2)
    assert.equal(f.native.reads, 0); assert.equal(f.native.starts, 1)
})

test('offline backoff grows to fifteen minutes but explicit foreground recovery bypasses it', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    f.state.offline = true; await f.background([f.point()])
    f.now('07:05:10'); await f.background([f.point()])
    const count = f.requests.length
    f.now('07:10:10'); await f.reload().locationTick([f.point()])
    assert.equal(f.requests.length, count)
    f.now('07:15:10'); await f.background([f.point()])
    f.now('07:25:10'); await f.background([f.point()])
    assert.equal(f.requests.length, count + 1)
    f.state.offline = false
    await f.tracking.locationTick(undefined, { recover: true })
    assert.equal(f.uploads().length, 1)
    assert.equal(JSON.parse(f.uploads()[0].options.params.points)[0].timestamp, stamp('07:25:10'))
    assert.equal((await f.tracking.getLocalLocationState(site)).pending, 0)
    const recovered = f.requests.length
    await f.tracking.locationTick(undefined, { recover: true })
    assert.equal(f.requests.length, recovered)
})

test('native options retain stationary confirmation without unsupported cross-platform settings', async () => {
    for (const platform of ['ios', 'android']) {
        const f = fixture(platform); await f.tracking.enableLocationTracking(site, status)
        const options = f.native.options
        assert.equal(options.accuracy, 3)
        assert.equal(options.distanceInterval, 0)
        assert.equal(options.deferredUpdatesInterval, 300000)
        if (platform === 'ios') {
            assert.equal(options.pausesUpdatesAutomatically, false)
            assert.equal(options.showsBackgroundLocationIndicator, true)
            assert.equal(options.foregroundService, undefined)
            assert.equal(options.timeInterval, undefined)
        } else {
            assert.equal(options.timeInterval, 300000)
            assert.equal(options.foregroundService.killServiceOnDestroy, true)
            assert.ok(options.foregroundService.notificationBody)
            assert.equal(options.pausesUpdatesAutomatically, undefined)
        }
    }
})

test('idle foreground ticks skip native work before the elapsed interval; due permission revocation clears locally', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    await f.tracking.locationTick()
    const checks = f.native.permissions
    for (let n = 0; n < 10; n++) await f.tracking.locationTick()
    assert.equal(f.native.permissions, checks)
    f.state.foreground = false; f.now('07:05:10')
    await f.tracking.locationTick()
    assert.equal((await f.tracking.getLocalLocationState(site)).enabled, false)
    assert.equal(f.uploads().length, 1)
})

test('failed uploads are throttled across reload; recovery rechecks revocation before any new acquisition', async () => {
    const f = fixture('android'); await f.tracking.enableLocationTracking(site, status)
    f.state.uploadFailure = true; await f.tracking.locationTick()
    assert.equal(f.uploads().length, 1)
    await f.reload().locationTick()
    assert.equal(f.uploads().length, 1)
    f.now('07:05:10'); f.state.consented = false
    await f.tracking.locationTick(undefined, { recover: true })
    assert.equal(f.native.reads, 1)
    assert.equal(f.uploads().length, 1)
    assert.equal((await f.tracking.getLocalLocationState(site)).enabled, false)
    assert.equal((await f.tracking.getLocalLocationState(site)).pending, 0)
})

test('fifteen-minute backoff cap permits a due attempt, with only a fresh native replacement', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    f.state.offline = true
    for (const time of ['07:00:10', '07:05:10', '07:15:10', '07:30:10']) {
        f.now(time); await f.background([f.point()])
    }
    const count = f.requests.length
    f.now('07:44:59'); await f.reload().locationTick([])
    assert.equal(f.requests.length, count)
    f.now('07:45:10'); f.state.offline = false; await f.background([f.point()])
    assert.equal(f.uploads().length, 1)
    assert.equal(JSON.parse(f.uploads()[0].options.params.points)[0].timestamp, stamp('07:45:10'))
    assert.equal(f.native.reads, 0)
})

test('queue coalescing retains the newest point even within the same slot', () => {
    const now = stamp('12:00:20')
    const point = { timestamp: now, latitude: 0, longitude: 0, accuracy: 1 }
    const points = policy.pendingPoints([{ ...point, timestamp: now - 10_000 }, point], now)
    assert.equal(points.length, 1)
    assert.equal(points[0].timestamp, now)
})

test('frequent offline callbacks replace the pending point without sliding the network deadline', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    f.state.offline = true; await f.background([f.point()])
    const requests = f.requests.length
    f.now('07:01:10'); await f.background([f.point()])
    assert.equal(JSON.parse(f.storage.get('prime-team-location-queue-v1'))[0].timestamp, stamp('07:01:10'))
    assert.equal(f.requests.length, requests)
    f.now('07:05:10'); f.state.offline = false; await f.background([f.point()])
    assert.equal(JSON.parse(f.uploads()[0].options.params.points)[0].timestamp, stamp('07:05:10'))
    f.now('07:06:10'); await f.background([f.point()])
    assert.equal(f.uploads().length, 1)
    f.now('07:10:10'); await f.background([f.point()])
    assert.equal(f.uploads().length, 2)
})

test('failed foreground acquisition does not erase offline backoff or spam the current-position API', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    f.state.offline = true; f.state.positionFailure = true
    await f.tracking.locationTick()
    await f.tracking.locationTick()
    assert.equal(f.native.reads, 1)
    f.now('07:05:10'); await f.tracking.locationTick()
    const requests = f.requests.length
    f.now('07:10:10'); await f.reload().locationTick()
    assert.equal(f.requests.length, requests)
    assert.equal(f.native.reads, 2)
})

test('server legal prerequisite fails closed for native and foreground ticks without accepting documents', async () => {
    for (const background of [true, false]) {
        const f = fixture(); await f.tracking.enableLocationTracking(site, status)
        f.state.attendance = { status: 'legal_consent_required' }
        if (background) await f.background([f.point()]); else await f.tracking.locationTick()
        assert.equal(f.uploads().length, 0)
        assert.equal(f.native.reads, 0)
        assert.equal((await f.tracking.getLocalLocationState(site)).enabled, false)
        assert.equal((await f.tracking.getLocalLocationState(site)).pending, 0)
    }
})

test('Asia/Almaty schedule includes 07:00, excludes 21:00 and ignores phone timezone', () => {
    for (const timezone of ['UTC', 'Pacific/Honolulu', 'Asia/Tokyo']) {
        const original = process.env.TZ; process.env.TZ = timezone
        try {
            assert.equal(policy.isLocationWindow(stamp('06:59:59')), false)
            assert.equal(policy.isLocationWindow(stamp('07:00:00')), true)
            assert.equal(policy.isLocationWindow(stamp('20:59:59')), true)
            assert.equal(policy.isLocationWindow(stamp('21:00:00')), false)
        } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original }
    }
})
test('fresh zero coordinates work; stale, outside-hours, mocked and invalid fixes do not', () => {
    const now = stamp('07:00:00')
    const good = { timestamp: now, coords: { latitude: 0, longitude: 0, accuracy: 1 } }
    assert.equal(policy.locationPoint(good, now).latitude, 0)
    for (const bad of [{ ...good, mocked: true }, { ...good, timestamp: now - 61000 },
        { ...good, coords: { ...good.coords, accuracy: null } },
        { ...good, coords: { ...good.coords, latitude: NaN } },
        { ...good, coords: { ...good.coords, longitude: 181 } }]) assert.equal(policy.locationPoint(bad, now), null)
})
test('offline stores only the latest point, expires after ten minutes and does not retain a route', () => {
    const now = stamp('12:00:00')
    const points = Array.from({ length: 40 }, (_, n) => ({ timestamp: now - n * 300000, latitude: 0, longitude: 0, accuracy: 1 }))
    const output = policy.pendingPoints([...points, ...points], now)
    assert.equal(output.length, 1)
    assert.equal(output[0].timestamp, now)
    assert.equal(policy.pendingPoints([points[3]], now).length, 0)
})
test('disabled tracking never acquires location or writes server points', async () => {
    const f = fixture(); await f.tracking.locationTick()
    assert.equal(f.native.reads, 0); assert.equal(f.uploads().length, 0)
})
test('opt-in acquires and uploads no sooner than five elapsed minutes, stops after 21:00', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    await f.tracking.locationTick(); await f.tracking.locationTick()
    f.now('07:04:59'); await f.tracking.locationTick()
    assert.equal(f.native.reads, 1); assert.equal(f.uploads().length, 1)
    f.now('07:05:10'); await f.tracking.locationTick()
    assert.equal(f.native.reads, 2); assert.equal(f.uploads().length, 2)
    f.now('21:00:00'); await f.tracking.locationTick([f.point()])
    assert.equal(f.uploads().length, 2); assert.equal(f.native.stops, 1)
    assert.equal((await f.tracking.getLocalLocationState(site)).enabled, true)
})
test('deny foreground prevents enable; deny background preserves foreground mode', async () => {
    const f = fixture(); f.state.foreground = false
    await assert.rejects(f.tracking.enableLocationTracking(site, status), /Разрешите геопозицию/)
    assert.equal((await f.tracking.getLocalLocationState(site)).enabled, false)
    f.state.foreground = true; f.state.background = false
    await f.tracking.enableLocationTracking(site, status); await f.tracking.locationTick()
    assert.equal(f.native.starts, 0); assert.equal(f.uploads().length, 1)
})
test('server withdrawal, wrong user and unauthorized session fail closed before acquisition', async () => {
    for (const change of [{ consented: false }, { user: 'another@example.invalid' }, { authenticated: false }]) {
        const f = fixture(); await f.tracking.enableLocationTracking(site, status)
        Object.assign(f.state, change); await f.tracking.locationTick()
        assert.equal(f.native.reads, 0); assert.equal(f.uploads().length, 0)
        assert.equal((await f.tracking.getLocalLocationState(site)).enabled, false)
    }
})
test('changed notice hash stops before acquisition and asks for disclosure review plus explicit switch opt-in', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    f.state.notice_hash = 'changed-hash'
    await f.tracking.locationTick()
    const local = await f.tracking.getLocalLocationState(site)
    assert.equal(local.enabled, false)
    assert.equal(f.native.reads, 0)
    assert.equal(f.uploads().length, 0)
    assert.match(local.error, /условия.*переключатель/i)
    assert.doesNotMatch(local.error, /флажок|чекбокс|отметьте/i)
    await f.tracking.locationTick()
    assert.equal(f.requests.filter(item => item.url.endsWith('enable_tracking')).length, 1)
    assert.equal(f.requests.find(item => item.url.endsWith('enable_tracking')).options.params.notice_hash, status.notice_hash)
})

test('offline encrypted queue is retried and cleared, without duplicating capture', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    f.state.offline = true; await f.tracking.locationTick()
    assert.equal((await f.tracking.getLocalLocationState(site)).pending, 1)
    f.state.offline = false; await f.tracking.locationTick(undefined, { recover: true })
    assert.equal(f.native.reads, 1)
    assert.equal((await f.tracking.getLocalLocationState(site)).pending, 0)
})
test('newer offline fix replaces old position and uploads installation metadata, not a hardware ID', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    f.state.offline = true; await f.tracking.locationTick()
    f.now('07:05:10'); await f.tracking.locationTick()
    assert.equal((await f.tracking.getLocalLocationState(site)).pending, 1)
    f.state.offline = false; await f.tracking.locationTick(undefined, { recover: true })
    const request = f.uploads().at(-1).options.params
    const points = JSON.parse(request.points)
    assert.equal(points.length, 1); assert.equal(points[0].timestamp, stamp('07:05:10'))
    assert.deepEqual(JSON.parse(request.device), { id: '550e8400-e29b-41d4-a716-446655440000', platform: 'ios', model: 'Synthetic Phone' })
})
test('disable during an in-flight request cancels before location acquisition', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    let release
    f.state.pendingStatus = new Promise(resolve => { release = resolve })
    const tick = f.tracking.locationTick()
    await new Promise(resolve => setImmediate(resolve))
    const stop = f.tracking.disableLocationTracking(site)
    release(); await Promise.all([tick, stop])
    assert.equal(f.native.reads, 0); assert.equal(f.uploads().length, 0)
    assert.equal((await f.tracking.getLocalLocationState(site)).enabled, false)
})
test('logout and site switch clear tracking locally and never send coordinates to another site', async () => {
    const f = fixture(); await f.tracking.enableLocationTracking(site, status)
    f.state.defaultSite = 'other-site'; await f.tracking.locationTick()
    assert.equal(f.native.reads, 0); assert.equal((await f.tracking.getLocalLocationState(site)).enabled, false)
    const auth = fs.readFileSync(path.join(root, 'lib/auth.ts'), 'utf8')
    assert.match(auth, /deleteAccessToken[\s\S]*?stopLocationLocally\(siteName\)/)
    assert.match(auth, /setDefaultSite[\s\S]*?stopLocationLocally\(previous\)/)
    assert.match(auth, /clearDefaultSite[\s\S]*?stopLocationLocally\(\)/)
})
test('profile switch is native; location runtime is inside legal-consent gate', () => {
    const screen = fs.readFileSync(path.join(root, 'app/[site_id]/(tabs)/profile/location.tsx'), 'utf8')
    assert.match(screen, /<Switch/); assert.match(screen, /onValueChange=\{toggle\}/)
    const layout = fs.readFileSync(path.join(root, 'app/[site_id]/_layout.tsx'), 'utf8')
    assert.ok(layout.indexOf('<LegalConsentGate') < layout.indexOf('<LocationRuntime'))
})

test('OAuth refresh is shared by UI and background, and notifies the active session', async () => {
    const storage = new Map([['development.localhost-access-token', JSON.stringify({ accessToken: 'synthetic-old' })]])
    let refreshes = 0, release
    const pending = new Promise(resolve => { release = resolve })
    const fresh = { accessToken: 'synthetic-fresh' }
    const auth = load('lib/auth.ts', {
        '@react-native-async-storage/async-storage': {},
        'expo-secure-store': { getItemAsync: async key => storage.get(key), setItemAsync: async (key, value) => storage.set(key, value) },
        'expo-auth-session': { TokenResponse: class {
            constructor(value) { Object.assign(this, value) }
            shouldRefresh() { return this.accessToken === 'synthetic-old' }
            async refreshAsync() { refreshes++; await pending; return fresh }
        } },
    })
    let notified
    const unsubscribe = auth.subscribeAccessToken(site.sitename, token => { notified = token })
    const ui = auth.refreshStoredAccessToken(site, 'synthetic-old')
    const background = auth.refreshStoredAccessToken(site)
    release(); await Promise.all([ui, background])
    assert.equal(refreshes, 1); assert.equal(notified.accessToken, fresh.accessToken)
    assert.equal((await auth.refreshStoredAccessToken(site, 'synthetic-old')).accessToken, fresh.accessToken)
    assert.equal(refreshes, 1); unsubscribe()
})

test('a late refresh cannot overwrite a newly logged-in account token', async () => {
    const storage = new Map([['development.localhost-access-token', JSON.stringify({ accessToken: 'synthetic-old' })]])
    let release
    const pending = new Promise(resolve => { release = resolve })
    const auth = load('lib/auth.ts', {
        '@react-native-async-storage/async-storage': {},
        'expo-secure-store': { getItemAsync: async key => storage.get(key), setItemAsync: async (key, value) => storage.set(key, value) },
        'expo-auth-session': { TokenResponse: class {
            constructor(value) { Object.assign(this, value) }
            shouldRefresh() { return true }
            async refreshAsync() { await pending; return { accessToken: 'synthetic-stale-refresh' } }
        } },
    })
    const oldRefresh = auth.refreshStoredAccessToken(site)
    await new Promise(resolve => setImmediate(resolve))
    await auth.storeAccessToken(site.sitename, { accessToken: 'synthetic-new-account' })
    release()
    await assert.rejects(oldRefresh, /Учётная запись изменилась/)
    assert.equal(JSON.parse(storage.get('development.localhost-access-token')).accessToken, 'synthetic-new-account')
})
