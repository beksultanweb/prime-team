import Constants from 'expo-constants'
import type { Messaging, RemoteMessage } from '@react-native-firebase/messaging'

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

type MessagingModule = typeof import('@react-native-firebase/messaging')

// Loaded lazily: the package throws on import without its native module
const loadMessaging = (): { api: MessagingModule, instance: Messaging } | null => {
    if (!isPushEnabled) return null
    try {
        const api = require('@react-native-firebase/messaging') as MessagingModule
        return { api, instance: api.getMessaging() }
    } catch (error) {
        console.warn('Firebase messaging is not available:', error)
        return null
    }
}

const firebase = loadMessaging()

/**
 * Push notification calls; each one is a no-op (resolves to null) when
 * Firebase is not configured for this build.
 */
export const push = firebase ? {
    hasPermission: () => firebase.api.hasPermission(firebase.instance) as Promise<number>,
    requestPermission: () => firebase.api.requestPermission(firebase.instance) as Promise<number>,
    getToken: () => firebase.api.getToken(firebase.instance),
    getInitialNotification: () => firebase.api.getInitialNotification(firebase.instance),
    onNotificationOpenedApp: (listener: (message: RemoteMessage) => void) =>
        firebase.api.onNotificationOpenedApp(firebase.instance, listener),
} : null
