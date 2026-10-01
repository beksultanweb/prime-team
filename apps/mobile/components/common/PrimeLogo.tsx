import { View } from 'react-native'
import { Text } from '@components/nativewindui/Text'
import PrimeEmblem from '@assets/brand/emblem.svg'
import { cn } from '@lib/cn'

type Props = {
    /** Height of the emblem; the wordmark scales with it */
    size?: number
    className?: string
}

/** Prime Green Clinic emblem with the app name, used instead of Raven's wordmark */
const PrimeLogo = ({ size = 48, className }: Props) => {
    return (
        <View className={cn('flex-row items-center gap-3', className)}>
            <PrimeEmblem height={size} width={size * 170 / 262} />
            <Text style={{ fontSize: size * 0.6, lineHeight: size * 0.8 }} className='font-semibold text-primary'>Prime Team</Text>
        </View>
    )
}

export default PrimeLogo
