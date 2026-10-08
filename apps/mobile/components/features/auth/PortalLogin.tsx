import { useEffect, useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { TokenResponse } from 'expo-auth-session'
import { Button } from '@components/nativewindui/Button'
import { Text } from '@components/nativewindui/Text'
import { ActivityIndicator } from '@components/nativewindui/ActivityIndicator'
import { useColorScheme } from '@hooks/useColorScheme'
import { addSiteToStorage, setDefaultSite, storeAccessToken } from '@lib/auth'
import { stopLocationLocally } from '@lib/locationTracking'
import { callFrappe, createPKCE, exchangeMobileCode, getLoginConfiguration, LoginConfiguration, MobileLoginError, normalizeSiteURL, passwordLogin } from '@lib/mobileLogin'
import EgovLogin from './EgovLogin'

export default function PortalLogin({ siteURL = 'https://app.primegc.kz', onDismiss }: { siteURL?: string, onDismiss?: () => void }) {
    const [configuration, setConfiguration] = useState<LoginConfiguration | null>(null)
    const [tab, setTab] = useState<'ecp' | 'password'>('ecp')
    const [noticeOpen, setNoticeOpen] = useState(false)
    const [error, setError] = useState('')
    const [retry, setRetry] = useState(0)
    const { colors } = useColorScheme()
    const alive = useRef(true)
    useEffect(() => {
        let active = true
        alive.current = true
        setConfiguration(null); setError('')
        Promise.resolve().then(() => getLoginConfiguration(normalizeSiteURL(siteURL)))
            .then(info => { if (active) setConfiguration(info) })
            .catch(e => { if (active) setError(e instanceof MobileLoginError ? e.message : 'Не удалось подключиться к сайту.') })
        return () => { active = false; alive.current = false }
    }, [siteURL, retry])

    const onTokenReceived = async (token: TokenResponse) => {
        if (!configuration || !alive.current) return
        await stopLocationLocally()
        await storeAccessToken(configuration.sitename, token)
        await addSiteToStorage(configuration.sitename, configuration)
        await setDefaultSite(configuration.sitename)
        if (alive.current) { onDismiss?.(); router.replace(`/${configuration.sitename}`) }
    }
    const url = configuration?.url || siteURL
    return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className='flex-1'>
        <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 64, paddingBottom: 24 }}>
            <View className='w-full max-w-[360px] self-center px-10'>
                <Image accessibilityLabel='Prime Group' source={{ uri: url + '/assets/prime_localization/images/prime-group-v2.png' }}
                    style={{ width: 192, height: 192, alignSelf: 'center' }} contentFit='contain' />
                <Text className='text-center text-xl font-semibold mb-6'>Войти</Text>
                <View accessibilityRole='tablist' className='flex-row border-b border-border mb-2'>
                    {(['ecp', 'password'] as const).map(value => <Pressable key={value} accessibilityRole='tab'
                        accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)}
                        style={{ flex: value === 'ecp' ? 0.325 : 0.675, borderBottomColor: tab === value ? colors.foreground : 'transparent' }}
                        className='py-3 border-b-2'>
                        <Text className={`text-center text-sm ${tab === value ? 'text-foreground' : 'text-muted-foreground'}`}>{value === 'ecp' ? 'ЭЦП' : 'Логин и пароль'}</Text>
                    </Pressable>)}
                </View>
                {!configuration ? <View className='py-6 gap-4'>
                    {error ? <><Text accessibilityRole='alert' className='text-center text-destructive'>{error}</Text><Button variant='secondary' onPress={() => setRetry(n => n + 1)}><Text>Повторить</Text></Button></> : <ActivityIndicator />}
                </View> : tab === 'ecp' ? <View className='pt-6'>
                    <EgovLogin configuration={configuration} onTokenReceived={onTokenReceived} />
                    <Pressable accessibilityRole='button' accessibilityState={{ expanded: noticeOpen }} className='mt-4 py-2' onPress={() => setNoticeOpen(!noticeOpen)}>
                        <Text className='text-sm'>▸ Условия проверки личности</Text>
                    </Pressable>
                    {noticeOpen && <Text className='text-sm text-muted-foreground leading-5'>{'Нажатие кнопки eGov Mobile подтверждает согласие с этими условиями.\n\n' + (configuration.egov.identity_consent?.text || '')}</Text>}
                    {!configuration.egov.enabled && <Text className='text-sm text-muted-foreground mt-2'>Вход через eGov Mobile сейчас недоступен. Используйте логин и пароль.</Text>}
                </View> : <PasswordForm configuration={configuration} onTokenReceived={onTokenReceived} />}
                <View className='flex-row justify-center flex-wrap mt-6 gap-1'>
                    <Pressable accessibilityRole='link' onPress={() => Linking.openURL(url + '/user-agreement').catch(() => {})}><Text className='text-sm text-foreground'>Пользовательское соглашение</Text></Pressable>
                    <Text className='text-sm text-foreground'>·</Text>
                    <Pressable accessibilityRole='link' onPress={() => Linking.openURL(url + '/privacy-policy').catch(() => {})}><Text className='text-sm text-foreground'>Политика конфиденциальности</Text></Pressable>
                </View>
            </View>
        </ScrollView>
    </KeyboardAvoidingView>
}

function PasswordForm({ configuration, onTokenReceived }: { configuration: LoginConfiguration, onTokenReceived: (token: TokenResponse) => Promise<void> }) {
    const { colors } = useColorScheme()
    const [usr, setUser] = useState(''), [pwd, setPassword] = useState(''), [otp, setOTP] = useState('')
    const [twoFactor, setTwoFactor] = useState<{ tmp_id: string, method: string } | null>(null)
    const [busy, setBusy] = useState(false), [error, setError] = useState('')
    const [forgot, setForgot] = useState(false), [resetEmail, setResetEmail] = useState('')
    const pkce = useRef<{ challenge: string, verifier: string } | null>(null)
    const inFlight = useRef(false)
    const mounted = useRef(true)
    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false; pkce.current = null }
    }, [])
    const login = async () => {
        if (inFlight.current) return
        inFlight.current = true
        setBusy(true); setError('')
        try {
            pkce.current ||= await createPKCE(configuration)
            const result = await passwordLogin(configuration, pkce.current.challenge,
                twoFactor ? { otp, tmp_id: twoFactor.tmp_id } : { usr: usr.trim(), pwd })
            if (!mounted.current) return
            if (result.status === 'two_factor') {
                setPassword(''); setTwoFactor({ tmp_id: result.tmp_id, method: result.verification.method }); return
            }
            if (result.status === 'password_reset') { setPassword(''); throw new MobileLoginError('Срок действия пароля истёк. Проверьте почту для его восстановления.') }
            const token = await exchangeMobileCode(configuration, result.code, pkce.current.verifier)
            setPassword(''); pkce.current = null
            if (mounted.current) await onTokenReceived(token)
        } catch (e) {
            if (mounted.current) setError(e instanceof MobileLoginError ? e.message : 'Не удалось завершить вход. Повторите попытку.')
        } finally { inFlight.current = false; if (mounted.current) setBusy(false) }
    }
    const reset = async () => {
        if (inFlight.current) return
        inFlight.current = true; setBusy(true); setError('')
        try {
            await callFrappe(configuration.url + '/api/method/frappe.core.doctype.user.user.reset_password', {
                params: { user: resetEmail.trim() }, allowEmpty: true,
            })
            if (mounted.current) { Alert.alert('Восстановление пароля', 'Если эта почта зарегистрирована, на неё отправлены инструкции.'); setForgot(false) }
        } catch (e) { if (mounted.current) setError(e instanceof MobileLoginError ? e.message : 'Не удалось отправить запрос. Повторите попытку.') }
        finally { inFlight.current = false; if (mounted.current) setBusy(false) }
    }
    if (forgot) return <View className='gap-4 pt-4'>
        <Text className='text-sm'>Восстановление пароля</Text>
        <TextInput accessibilityLabel='Электронная почта' placeholder='Электронная почта' autoCapitalize='none' autoCorrect={false}
            keyboardType='email-address' autoComplete='email' value={resetEmail} onChangeText={setResetEmail} editable={!busy}
            className='border border-border rounded-lg px-3 py-3 text-foreground text-sm' placeholderTextColor={colors.grey2} />
        {!!error && <Text accessibilityRole='alert' className='text-sm text-destructive'>{error}</Text>}
        <Button disabled={busy || !resetEmail.trim()} onPress={reset}><Text>{busy ? 'Отправляем…' : 'Отправить инструкции'}</Text></Button>
        <Button variant='plain' disabled={busy} onPress={() => { setForgot(false); setError('') }}><Text>Вернуться ко входу</Text></Button>
    </View>
    return <View className='gap-4 pt-2'>
        {twoFactor ? <>
            <Text className='text-sm'>Введите код подтверждения из {twoFactor.method === 'OTP App' ? 'приложения-аутентификатора' : twoFactor.method === 'SMS' ? 'SMS' : 'электронной почты'}.</Text>
            <TextInput accessibilityLabel='Код подтверждения' placeholder='Код подтверждения' value={otp} onChangeText={setOTP} keyboardType='number-pad'
                autoComplete='one-time-code' editable={!busy} className='border border-border rounded-lg px-3 py-3 text-foreground' placeholderTextColor={colors.grey2} />
        </> : <>
            <TextInput accessibilityLabel='Почта/Номер/ИИН' placeholder='Почта/Номер/ИИН' autoCapitalize='none' autoCorrect={false}
                autoComplete='username' value={usr} onChangeText={setUser} editable={!busy} className='border border-border rounded-lg px-3 py-3 text-foreground' placeholderTextColor={colors.grey2} />
            <TextInput accessibilityLabel='Пароль' placeholder='Пароль' secureTextEntry autoComplete='current-password' value={pwd} onChangeText={setPassword}
                editable={!busy} onSubmitEditing={login} className='border border-border rounded-lg px-3 py-3 text-foreground' placeholderTextColor={colors.grey2} />
            <Pressable accessibilityRole='button' onPress={() => { setForgot(true); setError('') }}><Text className='text-sm text-muted-foreground text-right'>Забыли пароль?</Text></Pressable>
        </>}
        {!!error && <Text accessibilityRole='alert' className='text-sm text-destructive'>{error}</Text>}
        <Button disabled={busy || !configuration.password_enabled || (twoFactor ? !otp : !usr.trim() || !pwd)} onPress={login}>
            {busy ? <ActivityIndicator color='#FFFFFF' /> : <Text>Продолжить</Text>}
        </Button>
        {twoFactor && <Button variant='plain' disabled={busy} onPress={() => { setTwoFactor(null); setOTP(''); pkce.current = null }}><Text>Начать заново</Text></Button>}
    </View>
}
