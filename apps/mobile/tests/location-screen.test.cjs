const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { create, act } = require('react-test-renderer')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const site = { url: 'https://platform.example.test', sitename: 'platform.example.test' }
const notice = 'Полный текст сервера.\nЦели, компании, сроки хранения и отзыв согласия.'

async function fixture(t, options = {}) {
    let status = { available: true, consented: false, notice, notice_hash: 'current-hash', ...options.status }
    let local = { enabled: false, last_capture: 0, pending: 0, error: '', ...options.local }
    const calls = [], links = [], listeners = new Set()
    const imports = {
        react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
        'react-native': { AppState: { addEventListener: () => ({ remove() {} }) },
            Linking: { openURL: async url => { links.push(url) }, openSettings() {} },
            Platform: { OS: options.platform || 'ios' }, ScrollView: 'ScrollView', Switch: 'Switch', View: 'View' },
        'expo-router': { Stack: { Screen: 'Screen' } },
        '@components/nativewindui/Text': { Text: 'Text' },
        '@components/nativewindui/Button': { Button: 'Button' },
        '@components/nativewindui/Checkbox': { Checkbox: 'Checkbox' },
        '@components/common/Buttons/HeaderBackButton': { __esModule: true, default: () => null },
        '@hooks/useSiteContext': { __esModule: true, default: () => site },
        '@hooks/useColorScheme': { useColorScheme: () => ({ colors: {} }) },
        '@lib/locationPolicy': { isLocationWindow: () => true },
        '@lib/locationTracking': {
            getLocationStatus: async () => { if (options.loadError) throw new Error('offline'); return status },
            getLocalLocationState: async () => local,
            subscribeLocation: listener => { listeners.add(listener); return () => listeners.delete(listener) },
            enableLocationTracking: async (target, disclosure) => {
                calls.push(['enable', target, disclosure])
                if (options.enableError) throw new Error(options.enableError)
                local = { ...local, enabled: true }; status = { ...status, consented: true }
            },
            disableLocationTracking: async target => { calls.push(['disable', target]); local = { ...local, enabled: false } },
            locationTick: async () => { calls.push(['tick']) },
        },
    }
    const source = fs.readFileSync(path.join(__dirname, '../app/[site_id]/(tabs)/profile/location.tsx'), 'utf8')
    const output = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText
    const module = { exports: {} }
    vm.runInNewContext(output, { module, exports: module.exports, require: name => {
        assert.ok(name in imports, 'Unexpected dependency: ' + name); return imports[name]
    }, Date, Intl, URL, Error, setInterval: () => 1, clearInterval() {} })
    let renderer
    await act(async () => { renderer = create(React.createElement(module.exports.default)) })
    t.after(async () => { await act(async () => renderer.unmount()); assert.equal(listeners.size, 0) })
    return { calls, links, root: renderer.root,
        switch: () => renderer.root.findByType('Switch'),
        text: () => JSON.stringify(renderer.toJSON()),
        refresh: async change => {
            status = { ...status, ...change }
            const button = renderer.root.findAllByType('Button').find(node => node.findAllByType('Text').some(text => text.props.children === 'Обновить состояние'))
            await act(async () => button.props.onPress())
        },
    }
}

test('one explicit switch replaces checkbox; full server disclosure is collapsed and accessible', async t => {
    const f = await fixture(t)
    assert.equal(f.root.findAllByType('Checkbox').length, 0)
    assert.equal(f.root.findAllByType('Switch').length, 1)
    assert.equal(f.switch().props.disabled, false)
    const accordion = () => f.root.findByProps({ accessibilityLabel: 'Условия геопозиции' })
    assert.equal(accordion().props.accessibilityRole, 'button')
    assert.equal(accordion().props.accessibilityState.expanded, false)
    assert.equal(f.text().includes('Полный текст сервера.'), false)
    await act(async () => accordion().props.onPress())
    assert.equal(accordion().props.accessibilityState.expanded, true)
    assert.equal(f.root.findAllByType('Text').some(node => node.props.children === notice), true)
    await act(async () => accordion().props.onPress())
    assert.equal(accordion().props.accessibilityState.expanded, false)
    assert.deepEqual(f.calls, [])
    await act(async () => f.switch().props.onValueChange(true))
    assert.equal(f.calls[0][0], 'enable')
    assert.equal(f.calls[0][1], site)
    assert.equal(f.calls[0][2].notice_hash, 'current-hash')
    assert.equal(f.calls[1][0], 'tick')
    assert.equal(f.switch().props.value, true)
    await act(async () => f.switch().props.onValueChange(false))
    assert.equal(f.calls.at(-1)[0], 'disable')
    assert.equal(f.switch().props.value, false)
})


test('server legal prerequisite is actionable without accepting documents or enabling tracking', async t => {
    const f = await fixture(t, { status: { gps_attendance: true, attendance: { status: 'legal_consent_required' } } })
    assert.equal(f.switch().props.disabled, true)
    assert.match(f.text(), /Для учёта времени примите юридические документы/)
    const link = f.root.findByProps({ accessibilityRole: 'link' })
    await act(async () => link.props.onPress())
    assert.deepEqual(f.links, ['https://platform.example.test/legal-consent'])
    await act(async () => f.switch().props.onValueChange(true))
    assert.deepEqual(f.calls, [])
    await f.refresh({ attendance: { status: 'ready' } })
    assert.equal(f.switch().props.disabled, false)
    assert.deepEqual(f.calls, [])
})

test('fresh server attendance clears a stale local legal prerequisite after document review', async t => {
    const f = await fixture(t, { status: { gps_attendance: true }, local: { attendance: { status: 'legal_consent_required' } } })
    assert.equal(f.switch().props.disabled, true)
    await f.refresh({ attendance: { status: 'ready' } })
    assert.equal(f.switch().props.disabled, false)
    assert.equal(f.root.findAllByProps({ accessibilityRole: 'link' }).length, 0)
    assert.doesNotMatch(f.text(), /примите юридические документы/)
    assert.deepEqual(f.calls, [])
})

test('unavailable, unloaded and web status never offer switch opt-in', async t => {
    for (const options of [{ status: { available: false } }, { loadError: true }, { platform: 'web' }]) {
        const f = await fixture(t, options)
        assert.equal(f.switch().props.disabled, true)
        assert.deepEqual(f.calls, [])
    }
})

test('an enable rejection stays visible through refresh and never ticks or shows enabled', async t => {
    const f = await fixture(t, { enableError: 'Разрешите геопозицию в настройках телефона.' })
    await act(async () => f.switch().props.onValueChange(true))
    assert.equal(f.switch().props.value, false)
    assert.match(f.text(), /Разрешите геопозицию в настройках телефона/)
    await f.refresh({})
    assert.match(f.text(), /Разрешите геопозицию в настройках телефона/)
    assert.deepEqual(f.calls.map(call => call[0]), ['enable'])
})

test('refreshing changed terms or opening disclosure never silently accepts them, even with server consent', async t => {
    const f = await fixture(t, { status: { consented: true } })
    await f.refresh({ notice: 'Изменённый полный текст', notice_hash: 'changed-hash' })
    assert.deepEqual(f.calls, [])
    await act(async () => f.root.findByProps({ accessibilityLabel: 'Условия геопозиции' }).props.onPress())
    assert.equal(f.root.findAllByType('Text').some(node => node.props.children === 'Изменённый полный текст'), true)
    assert.deepEqual(f.calls, [])
    await act(async () => f.switch().props.onValueChange(true))
    assert.equal(f.calls[0][2].notice_hash, 'changed-hash')
    assert.equal(f.calls[0][2].notice, 'Изменённый полный текст')
    // Disclosure remains available while tracking is enabled.
    assert.equal(f.root.findAllByType('Text').some(node => node.props.children === 'Изменённый полный текст'), true)
})

test('local legal prerequisite remains actionable and does not block switching off', async t => {
    const f = await fixture(t, { local: { enabled: true, attendance: { status: 'legal_consent_required' } } })
    const link = f.root.findByProps({ accessibilityRole: 'link' })
    await act(async () => link.props.onPress())
    assert.deepEqual(f.links, ['https://platform.example.test/legal-consent'])
    assert.equal(f.switch().props.disabled, false)
    await act(async () => f.switch().props.onValueChange(false))
    assert.equal(f.calls[0][0], 'disable')
})
