import { useChatPath } from '@hooks/useSitePath'
import { useColorScheme } from '@hooks/useColorScheme'
import { Message } from '@raven/types/common/Message'
import { router } from 'expo-router'
import ForwardIcon from "@assets/icons/ForwardIcon.svg"
import { ActionButtonLarge } from '@components/common/Buttons/ActionButtonLarge'

interface ForwardMessageProps {
    message: Message
    onClose: () => void
}

const ForwardMessage = ({ message, onClose }: ForwardMessageProps) => {
    const chatPath = useChatPath()

    const forwardMessage = () => {
        router.push({
            pathname: chatPath('forward-message'),
            params: { ...message } as any
        })
        onClose()
    }

    const { colors } = useColorScheme()

    return (
        <ActionButtonLarge
            icon={<ForwardIcon width={18} height={18} color={colors.icon} />}
            text="Переслать"
            onPress={forwardMessage}
        />
    )
}

export default ForwardMessage