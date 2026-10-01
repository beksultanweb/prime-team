import { useSitePath } from '@hooks/useSitePath'
import { useCallback, useContext } from 'react';
import { CustomTextualRenderer, CustomRendererProps, TText, TPhrasing } from 'react-native-render-html';
import { router } from 'expo-router'
import { FrappeContext, FrappeConfig } from 'frappe-react-sdk';
import { toast } from 'sonner-native';

// Custom renderer for paragraph elements, it also checks for mentions
export const CustomMentionRenderer: CustomTextualRenderer = ({
    TDefaultRenderer,
    ...props
}) => {

    const attributes = props.tnode.attributes

    if (attributes?.['data-type'] === 'userMention') {
        return <UserMentionRenderer userID={attributes?.['data-id']} TDefaultRenderer={TDefaultRenderer} {...props} />
    }

    if (attributes?.['data-type'] === 'channelMention') {

        return <ChannelMentionRenderer channelID={attributes?.['data-id']} TDefaultRenderer={TDefaultRenderer} {...props} />
    }

    // @ts-ignore
    return <TDefaultRenderer {...props} />

}

const UserMentionRenderer = ({
    userID,
    TDefaultRenderer,
    ...props
}: CustomRendererProps<TText | TPhrasing> & { userID: string }) => {

    const sitePath = useSitePath()

    const { call } = useContext(FrappeContext) as FrappeConfig

    const handleMentionPress = useCallback(() => {
        call.post('raven.api.raven_channel.create_direct_message_channel', {
            user_id: userID
        }).then((res) => {
            router.push(sitePath(`chat/${res?.message}`))
        }).catch(err => {
            toast.error('Не удалось открыть личный чат')
        })
    }, [userID, sitePath])

    return (
        // @ts-ignore
        <TDefaultRenderer {...props} onPress={handleMentionPress} />
    );
}

const ChannelMentionRenderer = ({
    channelID,
    TDefaultRenderer,
    ...props
}: CustomRendererProps<TText | TPhrasing> & { channelID: string }) => {

    const sitePath = useSitePath()

    const handleMentionPress = useCallback(() => {
        router.push(sitePath(`chat/${channelID}`))
    }, [channelID, sitePath])

    // @ts-ignore
    return <TDefaultRenderer {...props} onPress={handleMentionPress} />
}