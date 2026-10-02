import { Button } from '@components/nativewindui/Button'
import { Text } from '@components/nativewindui/Text'
import { ActivityIndicator } from '@components/nativewindui/ActivityIndicator'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AppState, Linking, Modal, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TokenResponse } from 'expo-auth-session'
import { SiteInformation } from '../../../types/SiteInformation'
import {
    beginEgovLogin, EgovFlow, EgovLoginError, getEgovFlowStatus, getEgovLoginInfo,
    getTokenWithSession, IdentityConsent,
} from '@lib/egov'

/** Как часто спрашиваем сервер, подписан ли запрос (на веб-версии — 4 с) */
const POLL_INTERVAL_MS = 3000

type Step =
    | { kind: 'consent', consent?: IdentityConsent }
    | { kind: 'waiting', flow: EgovFlow }
    | { kind: 'finishing' }

type Props = {
    siteInformation: SiteInformation,
    onTokenReceived: (token: TokenResponse) => void,
}

/**
 * Кнопка «Войти через eGov Mobile» и окно входа: согласие на проверку личности,
 * переход в eGov Mobile и ожидание подтверждения. Повторяет вход на веб-версии сайта.
 */
const EgovLogin = ({ siteInformation, onTokenReceived }: Props) => {

    const siteURL = siteInformation.url

    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<Step | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    const close = useCallback(() => {
        setStep(null)
        setMessage(null)
    }, [])

    const onStart = () => {
        setLoading(true)
        getEgovLoginInfo(siteURL)
            .then(info => {
                if (!info.enabled) {
                    Alert.alert('Вход через eGov Mobile', 'На этом сайте вход через eGov Mobile выключен.')
                    return
                }
                setStep({ kind: 'consent', consent: info.identity_consent })
            })
            .catch(showError)
            .finally(() => setLoading(false))
    }

    const onAgree = (consent?: IdentityConsent) => {
        setLoading(true)
        beginEgovLogin(siteURL, consent)
            .then(flow => {
                setMessage(null)
                setStep({ kind: 'waiting', flow })
                openApp(flow.mobile_launch_link)
            })
            .catch(error => {
                close()
                showError(error)
            })
            .finally(() => setLoading(false))
    }

    const onAuthenticated = useCallback(() => {
        setStep({ kind: 'finishing' })
        getTokenWithSession(siteURL, siteInformation.client_id)
            .then(token => {
                close()
                onTokenReceived(token)
            })
            .catch(error => {
                close()
                showError(error)
            })
    }, [siteURL, siteInformation.client_id, onTokenReceived, close])

    return <>
        <Button variant='secondary' onPress={onStart} style={{ minHeight: 40 }} disabled={loading}>
            {loading && !step ? <ActivityIndicator /> : <Text>Войти через eGov Mobile</Text>}
        </Button>

        <Modal
            visible={step !== null}
            animationType='slide'
            presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
            onRequestClose={close}>
            <SafeAreaView className='flex-1 bg-background' edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}>
                {step?.kind === 'consent' &&
                    <ConsentStep consent={step.consent} loading={loading} onAgree={() => onAgree(step.consent)} onCancel={close} />}
                {step?.kind === 'waiting' &&
                    <WaitingStep
                        siteURL={siteURL}
                        flow={step.flow}
                        message={message}
                        setMessage={setMessage}
                        onAuthenticated={onAuthenticated}
                        onCancel={close} />}
                {step?.kind === 'finishing' &&
                    <View className='flex-1 items-center justify-center gap-4 px-6'>
                        <ActivityIndicator />
                        <Text className='text-base text-center'>Вход подтверждён. Входим…</Text>
                    </View>}
            </SafeAreaView>
        </Modal>
    </>
}

const ConsentStep = ({ consent, loading, onAgree, onCancel }: {
    consent?: IdentityConsent, loading: boolean, onAgree: () => void, onCancel: () => void
}) => {
    // Первая строка текста — заголовок согласия
    const [title, ...rest] = (consent?.text ?? '').trim().split('\n')
    return <View className='flex-1'>
        <Text className='px-5 pt-6 pb-3 text-xl font-semibold'>{consent ? title : 'Вход через eGov Mobile'}</Text>
        <ScrollView className='flex-1 px-5' contentContainerClassName='pb-4'>
            <Text className='text-base leading-6'>
                {consent ? rest.join('\n').trim() : 'Подтвердите вход в приложении eGov Mobile или eGov Business и вернитесь в Prime Team.'}
            </Text>
        </ScrollView>
        <View className='gap-3 px-5 pt-3 pb-4'>
            <Button onPress={onAgree} style={{ minHeight: 44 }} disabled={loading}>
                {loading ? <ActivityIndicator color='#FFFFFF' /> : <Text>{consent ? 'Согласен, войти' : 'Продолжить'}</Text>}
            </Button>
            <Button variant='plain' onPress={onCancel} disabled={loading}>
                <Text>Отмена</Text>
            </Button>
        </View>
    </View>
}

const WaitingStep = ({ siteURL, flow, message, setMessage, onAuthenticated, onCancel }: {
    siteURL: string,
    flow: EgovFlow,
    message: string | null,
    setMessage: (message: string | null) => void,
    onAuthenticated: () => void,
    onCancel: () => void,
}) => {

    const finished = useRef(false)
    // Последняя версия колбэка, чтобы смена его не перезапускала опрос
    const onAuthenticatedRef = useRef(onAuthenticated)
    onAuthenticatedRef.current = onAuthenticated

    // Спрашиваем сервер, пока запрос не подписан, не отменён или не истёк.
    // Пока приложение в фоне, таймеры стоят; при возврате проверяем сразу.
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined

        const check = async () => {
            if (finished.current) return
            clearTimeout(timer)
            if (Date.now() >= Number(flow.expire_at)) {
                finished.current = true
                setMessage('Время подтверждения истекло. Начните вход заново.')
                return
            }
            try {
                const status = await getEgovFlowStatus(siteURL, flow.flow_token)
                if (finished.current) return
                if (status === 'authenticated') {
                    finished.current = true
                    onAuthenticatedRef.current()
                    return
                }
                if (status !== 'waiting') {
                    finished.current = true
                    setMessage(status === 'cancelled'
                        ? 'Подписание отменено. Начните вход заново.'
                        : status === 'expired'
                            ? 'Время подтверждения истекло. Начните вход заново.'
                            : 'Не удалось проверить ЭЦП или пользователь не привязан к системе.')
                    return
                }
                setMessage(null)
            } catch (error) {
                if (error instanceof EgovLoginError) {
                    // Сервер отклонил запрос входа: повторять бесполезно
                    finished.current = true
                    setMessage(error.message)
                    return
                }
                setMessage('Проверяем подключение…')
            }
            timer = setTimeout(check, POLL_INTERVAL_MS)
        }

        timer = setTimeout(check, POLL_INTERVAL_MS)
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') check()
        })
        return () => {
            finished.current = true
            clearTimeout(timer)
            subscription.remove()
        }
    }, [siteURL, flow, setMessage])

    const stopped = message !== null && message !== 'Проверяем подключение…'

    return <View className='flex-1 px-5 pt-6 pb-4'>
        <Text className='text-xl font-semibold'>Вход через eGov Mobile</Text>
        <View className='flex-1 items-center justify-center gap-4'>
            {!stopped && <ActivityIndicator />}
            <Text className='text-base text-center leading-6'>
                {message ?? 'Подтвердите вход в eGov Mobile, затем вернитесь в Prime Team — вход завершится сам.'}
            </Text>
        </View>
        <View className='gap-3'>
            {!stopped && <>
                <Button variant='secondary' onPress={() => openApp(flow.mobile_launch_link)} style={{ minHeight: 44 }}>
                    <Text>Открыть eGov Mobile</Text>
                </Button>
                <Button variant='secondary' onPress={() => openApp(flow.business_launch_link)} style={{ minHeight: 44 }}>
                    <Text>Открыть eGov Business</Text>
                </Button>
            </>}
            <Button variant='plain' onPress={onCancel}>
                <Text>{stopped ? 'Закрыть' : 'Отмена'}</Text>
            </Button>
        </View>
    </View>
}

const openApp = (link: string) => {
    Linking.openURL(link).catch(() => {
        Alert.alert('Не удалось открыть приложение', 'Установите eGov Mobile или eGov Business и попробуйте снова.')
    })
}

const showError = (error: unknown) => {
    Alert.alert('Ошибка входа', error instanceof EgovLoginError
        ? error.message
        : 'Не удалось связаться с сайтом. Проверьте интернет и попробуйте снова.')
}

export default EgovLogin
