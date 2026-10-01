import { useSitePath } from '@hooks/useSitePath'
import { repliesRu } from '@lib/ru'
import { Text } from '@components/nativewindui/Text'
import { Message } from '@raven/types/common/Message'
import { Link } from 'expo-router'
import { useFrappeGetCall } from 'frappe-react-sdk'
import { Pressable } from 'react-native'

type Props = {
    message: Message
}

const ViewThreadButton = ({ message }: Props) => {
    const sitePath = useSitePath()
    return <Link href={sitePath(`thread/${message.name}`)} asChild>
        <Pressable hitSlop={10} className='flex flex-row items-center gap-3 border border-border bg-background rounded-lg px-3 py-2 active:bg-card-background/40'>
            <ThreadReplyCount message={message} />
            <Text className='text-sm text-muted-foreground/80'>Открыть тред</Text>
        </Pressable>
    </Link>
}


const ThreadReplyCount = ({ message }: Props) => {

    const { data } = useFrappeGetCall<{ message: number }>("raven.api.threads.get_number_of_replies", {
        thread_id: message.name
    }, ["thread_reply_count", message.name], {
        revalidateOnFocus: false,
        shouldRetryOnError: false
    })
    return <Text className='text-sm text-primary dark:text-secondary font-semibold'>{repliesRu(data?.message ?? 0)}</Text>
}

export default ViewThreadButton