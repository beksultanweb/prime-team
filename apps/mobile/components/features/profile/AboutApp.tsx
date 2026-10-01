import { Linking, TouchableOpacity, View } from 'react-native'
import Constants from 'expo-constants'
import { nativeApplicationVersion, nativeBuildVersion } from 'expo-application'
import { Text } from '@components/nativewindui/Text'
import PrimeLogo from '@components/common/PrimeLogo'

const RAVEN_URL = 'https://github.com/The-Commit-Company/raven'
const LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html'
/** Public repository of this modified version, required by AGPL-3.0 */
const SOURCE_CODE_URL: string = Constants.expoConfig?.extra?.sourceCodeURL ?? ''

const LinkText = ({ url, children }: { url: string, children: React.ReactNode }) => (
    <TouchableOpacity onPress={() => Linking.openURL(url)} hitSlop={8}>
        <Text className='text-xs text-primary underline'>{children}</Text>
    </TouchableOpacity>
)

/** App name, version and the AGPL-3.0 notices of the Raven fork */
const AboutApp = () => {
    return (
        <View className='flex flex-col justify-center items-center pt-2 gap-1'>
            <PrimeLogo size={24} />
            <View className='flex flex-col items-center justify-center gap-0.5'>
                <Text className='text-xs text-muted-foreground/80'>Версия {nativeApplicationVersion} ({nativeBuildVersion})</Text>
                <Text className='text-xs text-muted-foreground/80 text-center'>
                    Изменённая версия Raven от The Commit Company, лицензия AGPL-3.0
                </Text>
                <View className='flex-row gap-4 pt-1'>
                    {SOURCE_CODE_URL ? <LinkText url={SOURCE_CODE_URL}>Исходный код</LinkText> : null}
                    <LinkText url={RAVEN_URL}>Raven</LinkText>
                    <LinkText url={LICENSE_URL}>Лицензия</LinkText>
                </View>
            </View>
        </View>
    )
}

export default AboutApp
