import { AuthRequest, CodeChallengeMethod, exchangeCodeAsync, ResponseType, TokenResponse } from 'expo-auth-session'
import { discovery } from './auth'
import { SiteInformation } from '../types/SiteInformation'

export const MOBILE_REDIRECT_URI = 'kz.primegc.team:'
export class MobileLoginError extends Error {
    constructor(message: string, public status = 0, public retryAfter = 0) { super(message) }
}
export const normalizeSiteURL = (value: string) => {
    const url = new URL(value.trim().includes('://') ? value.trim() : `https://${value.trim()}`)
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        throw new MobileLoginError('Укажите адрес сайта с HTTPS, без пути и параметров.')
    }
    return url.origin
}
export async function callFrappe<T>(url: string, options: {
    params?: Record<string, string>, token?: string, signal?: AbortSignal, cookies?: boolean, allowEmpty?: boolean
} = {}): Promise<T> {
    const controller = new AbortController()
    const abort = () => controller.abort()
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) controller.abort()
    const timeout = setTimeout(abort, 25000)
    try {
        const res = await fetch(url, {
            method: options.params ? 'POST' : 'GET', credentials: options.cookies ? 'include' : 'omit', signal: controller.signal,
            headers: { Accept: 'application/json', 'Accept-Language': 'ru',
                ...(options.params && { 'Content-Type': 'application/x-www-form-urlencoded' }),
                ...(options.token && { Authorization: `Bearer ${options.token}` }) },
            ...(options.params && { body: new URLSearchParams(options.params).toString() }),
        })
        const data = await res.json().catch(() => null)
        if (res.ok && data?.message !== undefined) return data.message as T
        if (res.ok && data && options.allowEmpty) return undefined as T
        if (res.status === 429) throw new MobileLoginError('Слишком много попыток. Подождите и повторите вход.', 429, Number(res.headers.get('Retry-After')) || 60)
        let message: string | undefined
        try { message = JSON.parse(JSON.parse(data._server_messages)[0]).message } catch { /* no public message */ }
        if (data?.message === 'Invalid login credentials') message = 'Неверный логин или пароль.'
        throw new MobileLoginError(message?.replace(/<[^>]*>/g, '').slice(0, 500) || 'Не удалось выполнить запрос. Повторите попытку.', res.status)
    } finally {
        clearTimeout(timeout)
        options.signal?.removeEventListener('abort', abort)
    }
}
export type LoginConfiguration = SiteInformation & {
    password_enabled: boolean, egov: { enabled: boolean, identity_consent?: { version: string, text: string, sha256: string } },
}
export const getLoginConfiguration = (url: string) => callFrappe<LoginConfiguration>(
    url + '/api/method/frappe_signature.mobile_login.get_login_configuration',
).then(info => ({ ...info, url }))
export const createPKCE = async (site: SiteInformation) => {
    const request = new AuthRequest({ clientId: site.client_id, responseType: ResponseType.Code, redirectUri: MOBILE_REDIRECT_URI,
        scopes: ['all', 'openid'], usePKCE: true, codeChallengeMethod: CodeChallengeMethod.S256 })
    await request.makeAuthUrlAsync({ authorizationEndpoint: site.url + discovery.authorizationEndpoint })
    if (!request.codeChallenge || !request.codeVerifier) throw new MobileLoginError('Не удалось подготовить защищённый вход.')
    return { challenge: request.codeChallenge, verifier: request.codeVerifier }
}
export const exchangeMobileCode = (site: SiteInformation, code: string, verifier: string): Promise<TokenResponse> => {
    if (!code || !verifier) throw new MobileLoginError('Начните вход заново.')
    return exchangeCodeAsync({ clientId: site.client_id, code, redirectUri: MOBILE_REDIRECT_URI,
        extraParams: { code_verifier: verifier } }, { tokenEndpoint: site.url + discovery.tokenEndpoint })
}
export type PasswordResult =
    | { status: 'authenticated', code: string }
    | { status: 'two_factor', tmp_id: string, verification: { method: string } }
    | { status: 'password_reset' }
export const passwordLogin = (site: SiteInformation, challenge: string, fields: Record<string, string>) =>
    callFrappe<PasswordResult>(site.url + '/api/method/frappe_signature.mobile_login.password_login', {
        params: { ...fields, client_id: site.client_id, code_challenge: challenge } })
