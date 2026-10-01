import { Text } from '@components/nativewindui/Text'
import { SystemMessage } from '@raven/types/common/Message'
import { View } from 'react-native'
import { systemMessageRu } from '@lib/ru'

type Props = {
    item: SystemMessage
}

const SystemMessageBlock = ({ item }: Props) => {

    return (
        <View className='flex-row gap-2.5 px-3 py-2 items-baseline'>
            <Text className='text-xs text-muted-foreground font-light'>{item.formattedTime}</Text>
            <Text className='flex-1 text-sm text-muted-foreground'>{systemMessageRu(item.text)}</Text>
        </View>
    )
}

export default SystemMessageBlock