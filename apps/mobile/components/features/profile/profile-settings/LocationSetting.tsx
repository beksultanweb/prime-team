import { router } from 'expo-router'
import { Pressable, View } from 'react-native'
import { Text } from '@components/nativewindui/Text'
import { useSitePath } from '@hooks/useSitePath'
import ChevronRightIconThin from '@assets/icons/ChevronRightIconThin.svg'
import { useColorScheme } from '@hooks/useColorScheme'

export default function LocationSetting() {
    const sitePath = useSitePath()
    const { colors } = useColorScheme()
    return <Pressable onPress={() => router.push(sitePath('profile/location'))}
        accessibilityRole='button' accessibilityLabel='Настройки геопозиции'
        className='bg-background dark:bg-card rounded-xl active:bg-card-background/50 dark:active:bg-card/80'>
        <View className='flex-row py-2.5 pl-4 pr-2 items-center justify-between'>
            <Text className='text-base'>Геопозиция</Text>
            <ChevronRightIconThin height={22} width={22} color={colors.grey} />
        </View>
    </Pressable>
}
