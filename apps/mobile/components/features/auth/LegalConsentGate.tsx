import { PropsWithChildren, useCallback, useEffect, useState } from 'react'
import { AppState, Linking, Modal, ScrollView, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { revokeAsync } from 'expo-auth-session'
import MarkdownIt from 'markdown-it'
import RenderHTML from 'react-native-render-html'
import { Text } from '@components/nativewindui/Text'
import { Button } from '@components/nativewindui/Button'
import { Checkbox } from '@components/nativewindui/Checkbox'
import { ActivityIndicator } from '@components/nativewindui/ActivityIndicator'
import { SiteInformation } from '../../../types/SiteInformation'
import { callFrappe, MobileLoginError } from '@lib/mobileLogin'
import { clearDefaultSite, deleteAccessToken, getRevocationEndpoint } from '@lib/auth'
import { useColorScheme } from '@hooks/useColorScheme'

type LegalDocument = { title: string, version: string, sha256: string, url: string, markdown: string }
type Context = { accepted: boolean, subject_full_name: string, documents: Record<string, LegalDocument> }
const markdown = new MarkdownIt({ html: false, linkify: false })

export default function LegalConsentGate({ site, getToken, children }: PropsWithChildren<{ site: SiteInformation, getToken: () => string }>) {
    const [checking, setChecking] = useState(true), [required, setRequired] = useState(true)
    const [context, setContext] = useState<Context | null>(null), [error, setError] = useState('')
    const [agreement, setAgreement] = useState(false), [personal, setPersonal] = useState(false), [saving, setSaving] = useState(false)
    const [document, setDocument] = useState<LegalDocument | null>(null)
    const { width } = useWindowDimensions()
    const { colors } = useColorScheme()
    const check = useCallback(async () => {
        setChecking(true); setError(''); setContext(null)
        try {
            const status = await callFrappe<{ authenticated: boolean, required: boolean }>(site.url + '/api/method/prime_core.legal_consent.get_consent_status', { token: getToken() })
            if (!status.authenticated) throw new MobileLoginError('Сессия завершена. Войдите снова.')
            setRequired(status.required)
            if (status.required) {
                const info = await callFrappe<Context>(site.url + '/api/method/prime_core.legal_consent.get_consent_context', { token: getToken() })
                setContext(info); setAgreement(false); setPersonal(false)
            }
        } catch (e) { setRequired(true); setError(e instanceof MobileLoginError ? e.message : 'Не удалось проверить согласие. Повторите попытку.') }
        finally { setChecking(false) }
    }, [site.url, getToken])
    useEffect(() => {
        check()
        const subscription = AppState.addEventListener('change', state => { if (state === 'active') check() })
        return () => subscription.remove()
    }, [check])
    const logout = async () => {
        setSaving(true)
        try { await revokeAsync({ clientId: site.client_id, token: getToken() }, { revocationEndpoint: getRevocationEndpoint(site.url) }) }
        catch { /* local logout must remain available offline */ }
        await deleteAccessToken(site.sitename)
        await clearDefaultSite()
        router.replace('/landing')
    }
    const accept = async () => {
        if (!context || !agreement || !personal || saving) return
        setSaving(true); setError('')
        try {
            await callFrappe(site.url + '/api/method/prime_core.legal_consent.accept_current_documents', {
                token: getToken(), params: { accept_user_agreement: '1', acknowledge_privacy_policy: '1', consent_personal_data: '1',
                    document_hashes: JSON.stringify(Object.fromEntries(Object.entries(context.documents).map(([key, value]) => [key, value.sha256]))) },
            })
            await check()
        } catch (e) { setError(e instanceof MobileLoginError ? e.message : 'Не удалось сохранить согласие. Повторите попытку.') }
        finally { setSaving(false) }
    }
    if (!required) return <>{children}</>
    return <SafeAreaView className='flex-1 bg-background'>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}>
            {checking ? <ActivityIndicator /> : <View className='gap-5'>
                <Text className='text-xl font-semibold'>Согласие на обработку данных</Text>
                {context && <>
                    <View className='flex-row gap-3 items-start'>
                        <Checkbox accessibilityLabel='Принять соглашение и ознакомиться с политикой' checked={agreement} onCheckedChange={setAgreement} disabled={saving} />
                        <Text className='text-sm flex-1'>Я принимаю Пользовательское соглашение и ознакомлен(а) с Политикой конфиденциальности.</Text>
                    </View>
                    <View className='flex-row gap-3 items-start'>
                        <Checkbox accessibilityLabel='Согласие на сбор и обработку персональных данных' checked={personal} onCheckedChange={setPersonal} disabled={saving} />
                        <Text className='text-sm flex-1'>Я даю Prime Group согласие на сбор и обработку моих персональных данных на указанных условиях.</Text>
                    </View>
                    {Object.entries(context.documents).map(([key, doc]) => <Button key={key} variant='plain' onPress={() => setDocument(doc)}><Text className='text-sm underline'>{doc.title}</Text></Button>)}
                </>}
                {!!error && <Text accessibilityRole='alert' className='text-sm text-destructive'>{error}</Text>}
                {context && <Button disabled={!agreement || !personal || saving} onPress={accept}><Text>{saving ? 'Сохраняем…' : 'Принять и продолжить'}</Text></Button>}
                {!!error && <Button variant='secondary' disabled={saving} onPress={check}><Text>Повторить</Text></Button>}
                <Button variant='plain' disabled={saving} onPress={logout}><Text>Выйти</Text></Button>
            </View>}
        </ScrollView>
        <Modal visible={!!document} animationType='slide' onRequestClose={() => setDocument(null)}>
            <SafeAreaView className='flex-1 bg-background'>
                <Button variant='plain' className='m-4' onPress={() => setDocument(null)}><Text>Закрыть</Text></Button>
                <ScrollView contentContainerStyle={{ padding: 24 }}>
                    {document && <RenderHTML contentWidth={width - 48} source={{ html: markdown.render(document.markdown) }}
                        baseStyle={{ color: colors.foreground, fontSize: 15, lineHeight: 23 }}
                        renderersProps={{ a: { onPress: (_, href) => {
                            const target = new URL(href, site.url)
                            if (target.protocol === 'https:' && [new URL(site.url).hostname, 'adilet.zan.kz'].includes(target.hostname)) Linking.openURL(target.href).catch(() => {})
                        } } }} />}
                </ScrollView>
            </SafeAreaView>
        </Modal>
    </SafeAreaView>
}
