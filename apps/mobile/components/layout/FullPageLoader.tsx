import { Text } from '@components/nativewindui/Text'
import { View } from 'react-native'
import PrimeLogo from '@components/common/PrimeLogo'

type Props = {
    title?: string
    description?: string
}

const FullPageLoader = ({ title, description = 'Подготавливаем рабочее пространство…' }: Props) => {
    return (
        <View className="flex-1 bg-background justify-center items-center gap-2">
            {title ? <Text className="text-4xl text-foreground font-semibold">{title}</Text> : <PrimeLogo size={44} />}
            <Text className='text-muted-foreground'>{description}</Text>
        </View>
    )
}

export default FullPageLoader