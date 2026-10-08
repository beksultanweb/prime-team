import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, Platform, ScrollView, Switch, View } from 'react-native'
import { Stack } from 'expo-router'
import { Text } from '@components/nativewindui/Text'
import { Button } from '@components/nativewindui/Button'
import { Checkbox } from '@components/nativewindui/Checkbox'
import HeaderBackButton from '@components/common/Buttons/HeaderBackButton'
import useSiteContext from '@hooks/useSiteContext'
import { useColorScheme } from '@hooks/useColorScheme'
import { disableLocationTracking, enableLocationTracking, getLocalLocationState, getLocationStatus,
    LocalLocationState, LocationStatus, locationTick, subscribeLocation } from '@lib/locationTracking'
import { isLocationWindow } from '@lib/locationPolicy'

export default function LocationScreen() {
    const site = useSiteContext()
    const { colors } = useColorScheme()
    const [status, setStatus] = useState<LocationStatus | null>(null)
    const [local, setLocal] = useState<LocalLocationState | null>(null)
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [accept, setAccept] = useState(false)
    const [now, setNow] = useState(Date.now())
    useEffect(() => { setAccept(false) }, [status?.notice_hash])
    const refresh = useCallback(async () => {
        if (!site) return
        setLocal(await getLocalLocationState(site)); setNow(Date.now())
        try { setStatus(await getLocationStatus(site)); setError('') }
        catch { setError('Не удалось загрузить условия геопозиции. Проверьте подключение и повторите.') }
    }, [site])
    useEffect(() => {
        let active = true
        const localRefresh = async () => { if (site) {
            const state = await getLocalLocationState(site)
            if (active) { setLocal(state); setNow(Date.now()) }
        } }
        refresh()
        const unsubscribe = subscribeLocation(() => { localRefresh().catch(() => {}) })
        const focus = AppState.addEventListener('change', state => { if (state === 'active') refresh() })
        const interval = setInterval(() => { setNow(Date.now()) }, 30_000)
        return () => { active = false; unsubscribe(); focus.remove(); clearInterval(interval) }
    }, [refresh, site])
    const toggle = async (on: boolean) => {
        if (!site || busy) return
        if (on && (!status || !accept)) { setError('Ознакомьтесь с условиями и отметьте согласие.'); return }
        setBusy(true); setError('')
        try {
            if (on && status) { await enableLocationTracking(site, status); await locationTick() }
            else { await disableLocationTracking(site); setAccept(false) }
            await refresh()
        } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось изменить настройку.') }
        finally { setBusy(false) }
    }
    const currentWindow = isLocationWindow(now)
    const attendanceMessages: Record<string, string> = {
        observed: 'Подтверждаем переход по двум измерениям GPS.',
        legal_consent_required: 'Для учёта времени примите юридические документы.',
        egov_identity_required: 'Для учёта времени войдите через eGov Mobile.',
        employee_mapping_required: 'Учёт времени не настроен: обратитесь к кадровому специалисту.',
        previous_day_unclosed: 'Вчерашний выход не зафиксирован. Нужна кадровая корректировка.',
        attendance_conflict: 'Есть другая отметка времени. Обратитесь к кадровому специалисту.',
        other_device: 'Сегодняшние отметки связаны с другой установкой приложения.',
    }
    return <>
        <Stack.Screen options={{ headerTitle: 'Геопозиция', headerLeft: () => <HeaderBackButton />,
            headerStyle: { backgroundColor: colors.background } }} />
        <ScrollView className='flex-1 bg-background' contentContainerStyle={{ padding: 24, gap: 18 }}>
            <View className='flex-row justify-between items-center gap-4'>
                <Text className='text-lg font-semibold flex-1'>Геопозиция</Text>
                <Switch accessibilityLabel='Включить геопозицию' value={!!local?.enabled}
                    disabled={busy || Platform.OS === 'web' || (!local?.enabled && (!status?.available || !accept))}
                    onValueChange={toggle} />
            </View>
            <Text className='text-sm'>Ежедневно 07:00–21:00 по времени Казахстана. Целевой интервал — 5 минут.</Text>
            <Text className='text-sm font-medium'>{busy ? 'Обновляем…' : !local?.enabled ? 'Выключено' :
                !currentWindow ? 'Пауза вне расписания' : local.background ? 'Включено, в том числе в фоне' : 'Включено при открытом приложении'}</Text>
            {!!local?.last_capture && <Text className='text-sm'>Последняя геопозиция: {new Intl.DateTimeFormat('ru-RU', {
                timeZone: 'Asia/Almaty', dateStyle: 'short', timeStyle: 'short',
            }).format(new Date(local.last_capture))}</Text>}
            {!!local?.last_capture && <Text className='text-sm'>Последний подтверждённый статус геозоны: {local.presence === 'IN' ? 'IN — внутри' : local.presence === 'OUT' ? 'OUT — снаружи' : 'Не определено'}</Text>}
            {!!local?.pending && <Text className='text-sm'>Ожидает отправки последняя геопозиция. История маршрута не хранится.</Text>}
            {status?.gps_attendance && <Text className='text-sm'>Учёт времени: {local?.attendance?.status === 'recorded'
                ? local.attendance.action === 'IN' ? 'Вход отмечен в HRMS.' : 'Выход отмечен в HRMS.'
                : local?.attendance?.status === 'observed' && !local.attendance.confirming && local.attendance.last_action
                    ? local.attendance.last_action === 'IN' ? 'Рабочий день открыт.' : 'Рабочий день закрыт.'
                    : attendanceMessages[local?.attendance?.status || ''] || 'После подтверждённого перехода отметка появится в HRMS.'}</Text>}
            {status && !status.available && <Text className='text-sm text-muted-foreground'>Геопозиция ещё не включена администратором платформы.</Text>}
            {status?.available && !local?.enabled && <>
                <Text className='text-sm'>{status.notice}</Text>
                <View className='flex-row items-start gap-3'>
                    <Checkbox accessibilityLabel='Согласие на сохранение геопозиции' checked={accept}
                        onCheckedChange={setAccept} disabled={busy} />
                    <Text className='text-sm flex-1'>Я разрешаю сохранение геопозиции на этих условиях.</Text>
                </View>
            </>}
            <Text className='text-sm text-muted-foreground'>В фоне ОС может задерживать обновления. После принудительного закрытия откройте приложение снова. Если оно не работает в 07:00, сбор возобновится при следующем открытии. Вне окна координаты не сохраняются.</Text>
            <Text className='text-sm text-muted-foreground'>Отслеживание не блокирует вход и чаты. Выключение не удаляет ранее сохранённые записи.</Text>
            {!!(error || local?.error) && <Text accessibilityRole='alert' className='text-sm text-destructive'>{error || local?.error}</Text>}
            <Button variant='secondary' disabled={busy} onPress={refresh}><Text>Обновить состояние</Text></Button>
            {Platform.OS !== 'web' && <Button variant='plain' onPress={() => Linking.openSettings()}><Text>Разрешения телефона</Text></Button>}
            {status?.consented && !local?.enabled && <Button variant='plain' disabled={busy} onPress={() => toggle(false)}><Text>Отозвать согласие на других устройствах</Text></Button>}
        </ScrollView>
    </>
}
