import { useState } from 'react'
import { Alert, TextInput, View } from 'react-native'
import { BottomSheetView } from '@gorhom/bottom-sheet'
import { Sheet, useSheetRef } from '@components/nativewindui/Sheet'
import { Button } from '@components/nativewindui/Button'
import { Text } from '@components/nativewindui/Text'
import { useColorScheme } from '@hooks/useColorScheme'
import { SiteInformation } from '../../../types/SiteInformation'
import { getLoginConfiguration, MobileLoginError, normalizeSiteURL } from '@lib/mobileLogin'
import PortalLogin from './PortalLogin'

export default function AddSite({ useBottomSheet = false }: { useBottomSheet?: boolean }) {
    const [siteURL, setSiteURL] = useState('app.primegc.kz')
    const [site, setSite] = useState<SiteInformation | null>(null)
    const [busy, setBusy] = useState(false)
    const sheet = useSheetRef()
    const { colors } = useColorScheme()
    const add = async () => {
        setBusy(true)
        try {
            setSite(await getLoginConfiguration(normalizeSiteURL(siteURL)))
            sheet.current?.present()
        } catch (error) { Alert.alert('Ошибка', error instanceof MobileLoginError ? error.message : 'Не удалось подключиться к сайту.') }
        finally { setBusy(false) }
    }
    return <View className='gap-3'>
        <Text className='text-sm'>Адрес сайта</Text>
        <TextInput accessibilityLabel='Адрес сайта' autoCapitalize='none' autoCorrect={false} keyboardType='url'
            placeholder='app.primegc.kz' placeholderTextColor={colors.grey2} value={siteURL} onChangeText={setSiteURL}
            className='border border-border rounded-lg px-3 py-3 text-foreground' />
        <Button disabled={busy} onPress={add}><Text>{busy ? 'Подключаемся…' : 'Продолжить'}</Text></Button>
        <Sheet snapPoints={['90%']} ref={sheet} onDismiss={() => setSite(null)}>
            <BottomSheetView style={{ flex: 1 }}>{site && <SiteAuthFlowSheet siteInformation={site} onDismiss={() => sheet.current?.dismiss()} />}</BottomSheetView>
        </Sheet>
    </View>
}

export const SiteAuthFlowSheet = ({ siteInformation, onDismiss }: { siteInformation: SiteInformation, onDismiss: () => void }) =>
    <PortalLogin siteURL={siteInformation.url} onDismiss={onDismiss} />
