const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
function load(file, imports, fetch) {
    const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const module = { exports: {} }
    vm.runInNewContext(output, { module, exports: module.exports, require: name => {
        if (!(name in imports)) throw new Error('Unexpected dependency: ' + name)
        return imports[name]
    }, fetch, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, Date })
    return module.exports
}
function fixture(fetch) {
    const exchange = []
    const auth = {
        AuthRequest: class { constructor(options) { this.options = options }
            async makeAuthUrlAsync() { this.codeChallenge = 'A'.repeat(43); this.codeVerifier = 'B'.repeat(43) } },
        CodeChallengeMethod: { S256: 'S256' }, ResponseType: { Code: 'code' },
        exchangeCodeAsync: async (...args) => { exchange.push(args); return { accessToken: 'synthetic-token' } },
    }
    const mobile = load('lib/mobileLogin.ts', { 'expo-auth-session': auth, './auth': {
        discovery: { authorizationEndpoint: '/authorize', tokenEndpoint: '/token' },
    } }, fetch)
    const storage = new Map()
    const egov = load('lib/egov.ts', { './mobileLogin': mobile, 'expo-secure-store': {
        setItemAsync: async (key, value) => storage.set(key, value),
        getItemAsync: async key => storage.get(key) || null,
        deleteItemAsync: async key => storage.delete(key),
    } }, fetch)
    return { mobile, egov, exchange, storage }
}
const site = { url: 'https://dev.example.test', client_id: 'native-client' }
const response = (message, status = 200, retryAfter = '60') => ({ ok: status < 400, status,
    json: async () => ({ message }), headers: { get: () => retryAfter } })

test('only HTTPS site origins are accepted', () => {
    const { mobile } = fixture()
    assert.equal(mobile.normalizeSiteURL(' DEV.EXAMPLE.TEST '), 'https://dev.example.test')
    for (const value of ['http://dev.example.test', 'https://user:secret@example.test', 'https://example.test/anything', 'https://example.test?q=x']) {
        assert.throws(() => mobile.normalizeSiteURL(value))
    }
})
test('eGov begins the native PKCE flow and stores a recoverable encrypted attempt', async () => {
    const requests = []
    const { egov, storage } = fixture(async (url, options) => {
        requests.push({ url, options }); return response({ flow_token: 'synthetic-flow', expire_at: Date.now() + 300000, mobile_launch_link: 'https://egov.example.test' })
    })
    const flow = await egov.beginEgovLogin(site, { sha256: 'notice-hash' })
    const fields = new URLSearchParams(requests[0].options.body)
    assert.equal(fields.get('client_id'), site.client_id)
    assert.equal(fields.get('code_challenge_method'), 'S256')
    assert.equal(fields.get('code_challenge'), 'A'.repeat(43))
    assert.equal(fields.get('identity_consent_hash'), 'notice-hash')
    assert.equal(requests[0].options.credentials, 'include')
    assert.equal(flow.verifier, 'B'.repeat(43))
    assert.equal(storage.size, 1)
    assert.equal((await egov.savedEgovFlow(site)).flow_token, flow.flow_token)
    assert.equal(await egov.savedEgovFlow({ ...site, client_id: 'different-client' }), null)
})
test('polling retains client binding and the returned one-time code', async () => {
    let sent
    const { egov } = fixture(async (_, options) => { sent = options; return response({ status: 'authenticated', code: 'synthetic-code' }) })
    const result = await egov.getEgovFlowStatus(site, { flow_token: 'synthetic-flow' })
    assert.equal(new URLSearchParams(sent.body).get('client_id'), site.client_id)
    assert.equal(result.code, 'synthetic-code')
})
test('code exchange is exact native redirect with PKCE and no client secret', async () => {
    const { mobile, exchange } = fixture()
    await mobile.exchangeMobileCode(site, 'synthetic-code', 'synthetic-verifier')
    assert.equal(exchange[0][0].redirectUri, 'kz.primegc.team:')
    assert.equal(exchange[0][0].extraParams.code_verifier, 'synthetic-verifier')
    assert.equal(exchange[0][0].clientSecret, undefined)
})
test('password and bearer requests cannot inherit a browser session', async () => {
    const requests = []
    const { mobile } = fixture(async (_, options) => { requests.push(options); return response({ status: 'two_factor', tmp_id: 'synthetic-tmp' }) })
    await mobile.passwordLogin(site, 'A'.repeat(43), { usr: 'synthetic', pwd: 'not-a-real-credential' })
    await mobile.callFrappe(site.url + '/consent', { token: 'synthetic-token' })
    assert.equal(requests[0].credentials, 'omit')
    assert.equal(requests[1].credentials, 'omit')
    assert.equal(requests[1].headers.Authorization, 'Bearer synthetic-token')
})
test('rate limit exposes a retry delay instead of being treated as success', async () => {
    const { mobile } = fixture(async () => response(null, 429, '120'))
    await assert.rejects(mobile.callFrappe(site.url), error => error.status === 429 && error.retryAfter === 120)
})
test('native form remains browserless, ECP first, and NCALayer is absent', () => {
    const portal = fs.readFileSync(path.join(root, 'components/features/auth/PortalLogin.tsx'), 'utf8')
    const egov = fs.readFileSync(path.join(root, 'lib/egov.ts'), 'utf8')
    assert.match(portal, /useState<'ecp' \| 'password'>\('ecp'\)/)
    assert.match(portal, /Почта\/Номер\/ИИН/)
    assert.match(portal, /Пароль/)
    assert.doesNotMatch(portal + egov, /NCALayer|WebView|promptAsync|getTokenWithSession|prime-team-auth/)
})
test('legal gate wraps all Raven providers, and displays server-owned document hashes', () => {
    const layout = fs.readFileSync(path.join(root, 'app/[site_id]/_layout.tsx'), 'utf8')
    assert.ok(layout.indexOf('<LegalConsentGate') < layout.indexOf('<FrappeNativeProvider'))
    const gate = fs.readFileSync(path.join(root, 'components/features/auth/LegalConsentGate.tsx'), 'utf8')
    assert.match(gate, /accept_current_documents/)
    assert.match(gate, /document_hashes/)
    assert.match(gate, /new MarkdownIt\(\{ html: false/)
})
