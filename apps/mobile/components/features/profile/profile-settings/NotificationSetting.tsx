import { View } from 'react-native'
import BellOutlineIcon from '@assets/icons/BellOutlineIcon.svg'
import { useColorScheme } from '@hooks/useColorScheme'
import { Text } from '@components/nativewindui/Text'
import { Toggle } from '@components/nativewindui/Toggle'
import { useCallback, useContext, useEffect, useState } from 'react'
import { AuthorizationStatus, messaging } from '@lib/push';
import { FrappeConfig, FrappeContext } from 'frappe-react-sdk'
import { toast } from 'sonner-native'
import * as Device from 'expo-device';

const NotificationSetting = () => {

    const { colors } = useColorScheme()
    const [enabled, setEnabled] = useState(false)

    const { call } = useContext(FrappeContext) as FrappeConfig

    useEffect(() => {
        messaging?.hasPermission().then((hasPermission) => {
            setEnabled(hasPermission === AuthorizationStatus.AUTHORIZED)
        })
    }, [])

    const onToggle = useCallback((enabled: boolean) => {
        const pushMessaging = messaging
        if (!pushMessaging) return
        if (enabled) {
            pushMessaging.requestPermission().then((authorizationStatus) => {
                if (authorizationStatus !== AuthorizationStatus.AUTHORIZED && authorizationStatus !== AuthorizationStatus.EPHEMERAL) {
                    throw new Error('User has not granted permission to receive notifications.')
                }
            }).then(() => {
                pushMessaging.getToken().then((token) => {
                    if (token) {
                        call.post('raven.api.notification.subscribe', {
                            fcm_token: token,
                            environment: 'Mobile',
                            device_information: Device.deviceName

                        }).then(() => {
                            setEnabled(true)
                        }).catch((error) => {
                            toast.error('Не удалось включить push-уведомления.')
                        })
                    } else {
                        toast.error('Не удалось получить токен для уведомлений.')
                    }
                })
            })
        } else {
            pushMessaging.getToken().then((token) => {
                if (token) {
                    call.post('raven.api.notification.unsubscribe', {
                        fcm_token: token
                    })
                }
            })

            setEnabled(false)
        }
    }, [])

    // No Firebase config in this build - push notifications are unavailable
    if (!messaging) return null

    return (
        <View>
            <View className='flex flex-row py-2.5 px-4 rounded-xl justify-between bg-background dark:bg-card'>
                <View className='flex-row items-center gap-2'>
                    <BellOutlineIcon height={18} width={18} fill={colors.icon} />
                    <Text className='text-base'>Push-уведомления</Text>
                </View>
                <Toggle value={enabled} onValueChange={onToggle} />
            </View>
        </View>
    )
}

export default NotificationSetting