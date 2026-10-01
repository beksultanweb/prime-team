import { useContext, useEffect, useRef } from 'react'
import * as Device from 'expo-device';
import { AuthorizationStatus, messaging } from '@lib/push';
import useSiteContext from './useSiteContext';
import { FrappeConfig, FrappeContext } from 'frappe-react-sdk';

const useFirebasePushTokenListener = () => {

    const siteInfo = useSiteContext()

    const { call } = useContext(FrappeContext) as FrappeConfig

    const callMade = useRef(false)

    useEffect(() => {

        if (callMade.current) return
        callMade.current = true

        // When the site is switched, fetch the token and store it in the database
        const pushMessaging = messaging
        if (siteInfo && pushMessaging) {
            pushMessaging.requestPermission().then(async (authorizationStatus) => {
                if (authorizationStatus === AuthorizationStatus.AUTHORIZED) {
                    const token = await pushMessaging.getToken()
                    call.post('raven.api.notification.subscribe', {
                        fcm_token: token,
                        environment: 'Mobile',
                        device_information: Device.deviceName
                    })
                }
            })
        }

    }, [siteInfo])
}

export default useFirebasePushTokenListener