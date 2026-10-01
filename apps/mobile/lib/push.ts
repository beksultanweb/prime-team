import Constants from 'expo-constants'
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging'

/**
 * Firebase is optional: app.config.js enables it only when the Firebase
 * config files for this app's bundle ID exist in ./firebase.
 * Without them the native Firebase modules are not linked and the app works
 * without push notifications.
 */
export const isPushEnabled = Constants.expoConfig?.extra?.firebaseEnabled === true

/**
 * Mirrors messaging's AuthorizationStatus: importing it from
 * @react-native-firebase/messaging fails when the native module is not linked.
 */
export const AuthorizationStatus = {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
    EPHEMERAL: 3,
} as const

const initMessaging = (): FirebaseMessagingTypes.Module | null => {
    if (!isPushEnabled) return null
    try {
        // Loaded lazily: the package throws on import without its native module
        const { getMessaging } = require('@react-native-firebase/messaging') as typeof import('@react-native-firebase/messaging')
        return getMessaging()
    } catch (error) {
        console.warn('Firebase messaging is not available:', error)
        return null
    }
}

export const messaging = initMessaging()
