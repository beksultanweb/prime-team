import { Button } from '@components/nativewindui/Button'
import { Text } from '@components/nativewindui/Text'
import { ActivityIndicator } from '@components/nativewindui/ActivityIndicator'
import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import { Alert, AppState, Linking, Modal, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TokenResponse } from 'expo-auth-session'
import { beginEgovLogin, clearEgovFlow, completeEgovLogin, EgovFlow, getEgovFlowStatus, savedEgovFlow } from '@lib/egov'
import { LoginConfiguration, MobileLoginError } from '@lib/mobileLogin'

export default function EgovLogin({ configuration, onTokenReceived }: {
    configuration: LoginConfiguration, onTokenReceived: (token: TokenResponse) => Promise<void>
}) {
    const [busy, setBusy] = useState(false)
    const [flow, setFlow] = useState<EgovFlow | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [finishing, setFinishing] = useState(false)
    const callback = useRef(onTokenReceived)
    callback.current = onTokenReceived
    const mounted = useRef(true)
    const activeRequest = useRef(false)

    useEffect(() => {
        mounted.current = true
        savedEgovFlow(configuration).then(saved => { if (mounted.current && saved) setFlow(saved) }).catch(() => {})
        return () => { mounted.current = false }
    }, [configuration.url, configuration.client_id])

    const close = () => {
        if (finishing) return
        setFlow(null)
        setMessage(null)
        clearEgovFlow(configuration.url).catch(() => {})
    }
    const start = async () => {
        if (activeRequest.current) return
        activeRequest.current = true
        setBusy(true)
        try {
            const notice = configuration.egov.identity_consent
            if (!configuration.egov.enabled || !notice) throw new MobileLoginError('Вход через eGov Mobile сейчас недоступен.')
            const created = await beginEgovLogin(configuration, notice)
            if (!mounted.current) return
            setMessage(null)
            setFlow(created)
            await Linking.openURL(created.mobile_launch_link).catch(() => Alert.alert('eGov Mobile', 'Установите eGov Mobile, затем повторите попытку.'))
        } catch (error) {
            if (mounted.current) Alert.alert('Ошибка входа', error instanceof MobileLoginError ? error.message : 'Не удалось связаться с сайтом. Повторите попытку.')
        } finally { activeRequest.current = false; if (mounted.current) setBusy(false) }
    }

    useEffect(() => {
        if (!flow) return
        let alive = true, checking = false, completed = false
        let retryAt = 0
        let timer: ReturnType<typeof setTimeout> | undefined
        let controller: AbortController | undefined
        const check = async () => {
            if (!alive || checking || completed || AppState.currentState !== 'active') return
            clearTimeout(timer)
            timer = undefined
            if (Date.now() < retryAt) { timer = setTimeout(check, retryAt - Date.now()); return }
            if (Date.now() >= flow.expire_at) { setMessage('Время подтверждения истекло. Начните вход заново.'); completed = true; return }
            checking = true
            controller = new AbortController()
            try {
                const result = await getEgovFlowStatus(configuration, flow, controller.signal)
                if (!alive) return
                if (result.status === 'authenticated' && result.code) {
                    completed = true
                    setFinishing(true)
                    const token = await completeEgovLogin(configuration, flow, result.code)
                    if (alive) await callback.current(token)
                    if (alive) setFlow(null)
                } else if (result.status !== 'waiting') {
                    completed = true
                    setMessage(result.status === 'cancelled' ? 'Вход отменён. Начните заново.' : 'Не удалось подтвердить вход. Начните заново.')
                } else setMessage(null)
            } catch (error) {
                if (!alive) return
                if (error instanceof MobileLoginError && error.status && error.status !== 429 && error.status < 500) {
                    completed = true
                    setMessage(error.message)
                } else if (completed) setMessage('Не удалось завершить вход. Начните заново.')
                else setMessage('Проверяем подключение…')
                const delay = error instanceof MobileLoginError && error.status === 429 ? error.retryAfter * 1000 : 4000
                retryAt = Date.now() + delay
                if (!completed) timer = setTimeout(check, delay)
            } finally {
                checking = false
                if (alive) setFinishing(false)
                if (alive && !completed && !timer) timer = setTimeout(check, 4000)
            }
        }
        check()
        const subscription = AppState.addEventListener('change', state => {
            clearTimeout(timer); timer = undefined
            if (state === 'active') check()
        })
        return () => { alive = false; controller?.abort(); clearTimeout(timer); subscription.remove() }
    }, [flow, configuration.url, configuration.client_id])

    return <>
        <View className='items-center'>
            <Button accessibilityLabel='Войти через eGov Mobile' variant='plain' disabled={busy || !configuration.egov.enabled}
                onPress={start} className='border border-border rounded-[14px] p-0 overflow-hidden'>
                {busy ? <ActivityIndicator style={{ width: 96, height: 66 }} /> :
                    <Image source={{ uri: configuration.url + '/assets/frappe_signature/images/egovmobile.jpeg' }} style={{ width: 96, height: 66 }} contentFit='contain' />}
            </Button>
        </View>
        <Modal visible={!!flow} animationType='slide' onRequestClose={close}>
            <SafeAreaView className='flex-1 bg-background'>
                <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
                    <Text className='text-xl font-semibold'>Вход через eGov Mobile</Text>
                    <Text className='mt-3 text-muted-foreground'>Подтвердите вход в eGov Mobile или eGov Business.</Text>
                    <View className='flex-1 items-center justify-center gap-4 py-12'>
                        {(!message || message === 'Проверяем подключение…') && <ActivityIndicator />}
                        <Text className='text-center'>{finishing ? 'Завершаем вход…' : message || 'После подтверждения вернитесь в Prime Team.'}</Text>
                    </View>
                    {flow && !message && !finishing && <View className='gap-3'>
                        <Button variant='secondary' onPress={() => Linking.openURL(flow.mobile_launch_link).catch(() => Alert.alert('eGov Mobile', 'Не удалось открыть приложение.'))}><Text>Открыть eGov Mobile</Text></Button>
                        <Button variant='secondary' onPress={() => Linking.openURL(flow.business_launch_link).catch(() => Alert.alert('eGov Business', 'Не удалось открыть приложение.'))}><Text>Открыть eGov Business</Text></Button>
                    </View>}
                    <Button variant='plain' disabled={finishing} onPress={close} className='mt-4'><Text>{message ? 'Закрыть' : 'Отмена'}</Text></Button>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    </>
}
