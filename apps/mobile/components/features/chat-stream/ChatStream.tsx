import useChatStream, { MessageDateBlock } from '@hooks/useChatStream'
import { RefObject } from 'react'
import { LegendList, LegendListRef } from '@legendapp/list/react-native'
import DateSeparator from './DateSeparator'
import SystemMessageBlock from './SystemMessageBlock'
import MessageItem from './MessageItem'
import ChannelHistoryFirstMessage from './FirstMessageBlock'
import { useAtomValue } from 'jotai'
import { doubleTapMessageEmojiAtom } from '@lib/preferences'
import { NativeScrollEvent, NativeSyntheticEvent, View } from 'react-native'
import ChatStreamSkeletonLoader from './ChatStreamSkeletonLoader'
import ErrorBanner from '@components/common/ErrorBanner'

type Props = {
    channelID: string,
    isThread?: boolean,
    scrollRef?: RefObject<LegendListRef | null>,
    onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void,
    onScrollBeginDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void,
    pinnedMessagesString?: string
}

const ChatStream = ({ channelID, isThread = false, scrollRef, onMomentumScrollEnd, onScrollBeginDrag, pinnedMessagesString }: Props) => {


    /** Fetching this here to avoid blank screen when the user opens the chat. 
     * Each message item fetches this atom value
     * 
     * If this is not fetched here, the chat stream sometimes remains blank
     */
    const doubleTapMessageEmoji = useAtomValue(doubleTapMessageEmojiAtom)

    const { data, isLoading, error, loadOlderMessages, loadNewerMessages } = useChatStream(channelID, scrollRef, isThread, pinnedMessagesString)

    if (isLoading) {
        return <ChatStreamSkeletonLoader />
    }

    if (!data && error) {
        return <View className='px-2 flex-1 justify-center items-center'>
            <ErrorBanner error={error} />
        </View>
    }

    return (
        <LegendList
            ref={scrollRef}
            data={data}
            keyExtractor={messageKeyExtractor}
            // drawDistance={500}
            alignItemsAtEnd
            keyboardDismissMode='on-drag'
            maintainVisibleContentPosition
            initialScrollIndex={data.length > 0 ? data.length - 1 : undefined}
            maintainScrollAtEnd
            maintainScrollAtEndThreshold={0.1}
            // LegendList 3 measures items itself; this is only the starting average
            estimatedItemSize={120}
            renderItem={MessageContentRenderer}
            recycleItems={false}
            contentContainerStyle={{
                paddingBottom: 32
            }}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onScrollBeginDrag={onScrollBeginDrag}
            onStartReached={loadOlderMessages}
            onEndReached={loadNewerMessages}
        />
    )

}

const messageKeyExtractor = (item: MessageDateBlock) => {
    if (!item) {
        return 'empty'
    }

    if (item.message_type === 'header') {
        return `header-${item.name}`
    }

    if (item.message_type === 'date') {
        return `date-${item.creation}`
    }
    return `${item.name}-${item.modified}`
}

const MessageContentRenderer = ({ item }: { item: MessageDateBlock }) => {

    if (item.message_type === 'date') {
        return <DateSeparator item={item} />
    }

    if (item.message_type === 'System') {
        return <SystemMessageBlock item={item} />
    }

    if (item.message_type === 'header') {
        return <ChannelHistoryFirstMessage channelID={item.name} isThread={item.isOpenInThread} />
    }

    return <MessageItem message={item} />
}

export default ChatStream