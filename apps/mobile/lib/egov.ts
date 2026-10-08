import * as SecureStore from 'expo-secure-store'
import { SiteInformation } from '../types/SiteInformation'
import { callFrappe, createPKCE, exchangeMobileCode } from './mobileLogin'

export type IdentityConsent = { version: string, text: string, sha256: string }
export type EgovFlow = {
    flow_token: string, expire_at: number, mobile_launch_link: string, business_launch_link: string,
    client_id: string, verifier: string,
}
export type EgovFlowStatus = { status: 'waiting' | 'authenticated' | 'cancelled' | 'failed' | 'expired', code?: string }
const flowKey = (url: string) => `prime-egov-${encodeURIComponent(url).replace(/%/g, '_')}`
export const savedEgovFlow = async (site: SiteInformation): Promise<EgovFlow | null> => {
    const value = await SecureStore.getItemAsync(flowKey(site.url))
    if (!value) return null
    try {
        const flow = JSON.parse(value) as EgovFlow
        if (flow.client_id === site.client_id && flow.expire_at > Date.now() && flow.flow_token && flow.verifier) return flow
    } catch { /* discard invalid persisted attempt */ }
    await clearEgovFlow(site.url)
    return null
}
export const clearEgovFlow = (url: string) => SecureStore.deleteItemAsync(flowKey(url))
export const beginEgovLogin = async (site: SiteInformation, consent: IdentityConsent): Promise<EgovFlow> => {
    const pkce = await createPKCE(site)
    const response = await callFrappe<Omit<EgovFlow, 'client_id' | 'verifier'>>(
        site.url + '/api/method/frappe_signature.sigex_egov_auth.begin_egov_login', {
            cookies: true,
            params: { client_id: site.client_id, code_challenge: pkce.challenge, code_challenge_method: 'S256',
                identity_consent: '1', identity_consent_hash: consent.sha256 },
        })
    const flow = { ...response, client_id: site.client_id, verifier: pkce.verifier }
    await SecureStore.setItemAsync(flowKey(site.url), JSON.stringify(flow))
    return flow
}
export const getEgovFlowStatus = (site: SiteInformation, flow: EgovFlow, signal?: AbortSignal) =>
    callFrappe<EgovFlowStatus>(site.url + '/api/method/frappe_signature.sigex_egov_auth.egov_login_status', {
        cookies: true, signal, params: { flow_token: flow.flow_token, client_id: site.client_id } })
export const completeEgovLogin = async (site: SiteInformation, flow: EgovFlow, code: string) => {
    try { return await exchangeMobileCode(site, code, flow.verifier) }
    finally { await clearEgovFlow(site.url) }
}
