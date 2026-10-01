import { Text } from '@components/nativewindui/Text'
import { TouchableOpacity, View } from 'react-native'
import InfoIcon from '@assets/icons/InfoIcon.svg'
import { useColorScheme } from '@hooks/useColorScheme'
import { Sheet, useSheetRef } from '@components/nativewindui/Sheet'
import { useCallback } from 'react'
import { BottomSheetView } from '@gorhom/bottom-sheet'
import { Button } from '@components/nativewindui/Button'

const HowToSetupMobile = () => {

    const { colors } = useColorScheme()

    const infoSheetRef = useSheetRef()

    const onPress = useCallback(() => {
        infoSheetRef.current?.present()
    }, [])

    const onDismiss = useCallback(() => {
        infoSheetRef.current?.dismiss()
    }, [])

    return (
        <View>
            <TouchableOpacity className='flex-row items-center gap-1' onPress={onPress}>
                <InfoIcon height={16} width={16} fill={colors.icon} />
                <Text className='text-sm text-muted-foreground'>Как настроить сайт для Prime Team?</Text>
            </TouchableOpacity>

            <Sheet enableDynamicSizing ref={infoSheetRef}>
                <BottomSheetView className='pb-8'>
                    <HowToSetupMobileContent onDismiss={onDismiss} />
                </BottomSheetView>
            </Sheet>
        </View>
    )
}

const HowToSetupMobileContent = ({ onDismiss }: { onDismiss: () => void }) => {

    const BoldText = ({ children }: { children: React.ReactNode }) => {
        return <Text className='text-base text-foreground font-medium'>{children}</Text>
    }

    const StepNumber = ({ number }: { number: number }) => {
        return <Text className='text-base text-foreground font-normal' style={{
            fontVariant: ['tabular-nums']
        }}>{number}.</Text>
    }

    return <View className='p-4 flex gap-4'>
        <Text className='text-lg text-foreground font-semibold'>Настройка сайта для Prime Team</Text>
        <View className='flex gap-2'>
            <Text className='text-base text-foreground'>
                <StepNumber number={1} /> Откройте Raven в браузере на компьютере и перейдите в <BoldText>Settings {">"} Mobile App</BoldText>
            </Text>
            <Text className='text-base text-foreground'>
                <StepNumber number={2} /> Нажмите <BoldText>Configure OAuth Client</BoldText>, если клиента ещё нет
            </Text>
            <Text className='text-base text-foreground'>
                <StepNumber number={3} /> Откройте этот <BoldText>OAuth Client</BoldText> в рабочем столе Frappe и добавьте <BoldText>kz.primegc.team:</BoldText> в Redirect URIs
            </Text>
        </View>

        <View className='flex gap-2'>
            <Text className='text-base text-foreground'>
                Через этот OAuth-клиент сотрудники безопасно входят в мобильное приложение.
            </Text>

            <Text className='text-base text-muted-foreground'>
                Это может сделать только системный администратор.
            </Text>
        </View>

        <Button onPress={onDismiss}>
            <Text>Закрыть</Text>
        </Button>
    </View>

}

export default HowToSetupMobile