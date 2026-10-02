import { AuthRequest, CodeChallengeMethod, exchangeCodeAsync, ResponseType, TokenResponse } from 'expo-auth-session'
import { discovery } from './auth'

/**
 * Вход через eGov Mobile — тот же, что на веб-версии сайта (приложение frappe_signature):
 *
 * 1. sigex_login_status — включён ли вход и текст согласия на проверку личности.
 * 2. begin_egov_login — после согласия: flow_token и ссылки на eGov Mobile / eGov Business.
 * 3. Человек подписывает запрос в eGov Mobile и возвращается в приложение.
 * 4. egov_login_status — пока не "authenticated"; тогда сервер открывает сессию Frappe (cookie sid).
 * 5. С этой сессией приложение само проходит OAuth (authorize → approve → код) и меняет код на токен,
 *    как при обычном входе. Браузер не нужен: fetch хранит cookie и идёт по редиректам,
 *    код читаем из адреса последней страницы.
 */

const LOGIN_STATUS = '/api/method/frappe_signature.sigex_auth.sigex_login_status'
const BEGIN_EGOV_LOGIN = '/api/method/frappe_signature.sigex_egov_auth.begin_egov_login'
const EGOV_LOGIN_STATUS = '/api/method/frappe_signature.sigex_egov_auth.egov_login_status'

/**
 * Адрес, на который сервер вернёт код OAuth после входа через eGov.
 * Должен быть в Redirect URIs OAuth-клиента приложения на сайте.
 * Страницы по адресу нет — нужен только код из него.
 */
export const getEgovRedirectURI = (siteURL: string) => `${siteURL}/prime-team-auth`

export type IdentityConsent = {
    version: string,
    text: string,
    sha256: string,
}

export type EgovFlow = {
    flow_token: string,
    expire_at: number,
    mobile_launch_link: string,
    business_launch_link: string,
}

export type EgovFlowStatus = 'waiting' | 'authenticated' | 'cancelled' | 'failed' | 'expired'

export class EgovLoginError extends Error { }

/** Ответ Frappe: message — данные, иначе текст ошибки из _server_messages */
const callFrappe = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, {
        ...init,
        headers: { Accept: 'application/json', ...init?.headers },
    })
    if (res.status === 429) {
        throw new EgovLoginError('Слишком много попыток входа. Подождите минуту и попробуйте снова.')
    }
    const data = await res.json().catch(() => null)
    if (res.ok && data && data.message !== undefined) {
        return data.message as T
    }
    throw new EgovLoginError(getServerMessage(data) ?? 'Сервер не ответил. Попробуйте ещё раз.')
}

const getServerMessage = (data: any): string | undefined => {
    try {
        const messages = JSON.parse(data._server_messages)
        return JSON.parse(messages[0]).message
    } catch {
        return undefined
    }
}

const postForm = <T>(url: string, params: Record<string, string>) => callFrappe<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
})

/** Включён ли вход по ЭЦП на сайте и согласие, которое нужно показать до входа */
export const getEgovLoginInfo = (siteURL: string) =>
    callFrappe<{ enabled: boolean, identity_consent?: IdentityConsent }>(siteURL + LOGIN_STATUS)

export const beginEgovLogin = async (siteURL: string, consent?: IdentityConsent): Promise<EgovFlow> => {
    const flow = await postForm<EgovFlow>(siteURL + BEGIN_EGOV_LOGIN, consent ? {
        identity_consent: '1',
        identity_consent_hash: consent.sha256,
    } : {})
    if (!flow?.flow_token || !flow.mobile_launch_link) {
        throw new EgovLoginError('Не удалось начать вход через eGov Mobile')
    }
    return flow
}

export const getEgovFlowStatus = async (siteURL: string, flowToken: string): Promise<EgovFlowStatus> => {
    const res = await postForm<{ status?: string }>(siteURL + EGOV_LOGIN_STATUS, { flow_token: flowToken })
    switch (res?.status) {
        case 'authenticated':
        case 'cancelled':
        case 'failed':
        case 'expired':
            return res.status
        default:
            return 'waiting'
    }
}

/**
 * После входа через eGov у fetch есть сессия Frappe: получаем по ней токен OAuth
 * и закрываем сессию, чтобы дальше приложение работало только по токену.
 */
export const getTokenWithSession = async (siteURL: string, clientId: string): Promise<TokenResponse> => {
    const redirectUri = getEgovRedirectURI(siteURL)
    const discoveryWithURL = {
        authorizationEndpoint: siteURL + discovery.authorizationEndpoint,
        tokenEndpoint: siteURL + discovery.tokenEndpoint,
    }
    const request = new AuthRequest({
        responseType: ResponseType.Code,
        clientId,
        usePKCE: true,
        scopes: ['all', 'openid'],
        codeChallengeMethod: CodeChallengeMethod.S256,
        redirectUri,
    })

    try {
        const authURL = await request.makeAuthUrlAsync(discoveryWithURL)
        // authorize → approve → redirectUri?code=…; страница с кодом — 404, важен только адрес
        const res = await fetch(authURL)
        const finalURL = new URL(res.url)
        const code = res.url.startsWith(redirectUri) ? finalURL.searchParams.get('code') : null
        if (!code || finalURL.searchParams.get('state') !== request.state) {
            throw new EgovLoginError('Сайт не выдал доступ приложению. Проверьте настройки OAuth-клиента Prime Team.')
        }
        return await exchangeCodeAsync({
            clientId,
            code,
            redirectUri,
            extraParams: { code_verifier: request.codeVerifier ?? '' },
        }, discoveryWithURL)
    } finally {
        // Сессия больше не нужна: токен работает сам по себе
        await fetch(siteURL + '/api/method/logout', { method: 'POST' }).catch(() => { })
    }
}
