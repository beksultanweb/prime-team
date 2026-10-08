const { IOS_FIREBASE_FILE, ANDROID_FIREBASE_FILE, firebaseEnabled, FIREBASE_PACKAGES } = require('./firebase.config')

// Prime Team — Raven Mobile (AGPL-3.0) rebranded for Prime Green Clinic.

const APP_ID = 'kz.primegc.team'
const BRAND_GREEN = '#115F4D'

module.exports = {
    expo: {
        name: 'Prime Team',
        slug: 'prime-team',
        scheme: APP_ID,
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        userInterfaceStyle: 'automatic',
        newArchEnabled: true,
        ios: {
            supportsTablet: false,
            appleTeamId: '6MQP332Q55',
            bundleIdentifier: APP_ID,
            buildNumber: '3',
            config: {
                usesNonExemptEncryption: false,
            },
            ...(firebaseEnabled && { googleServicesFile: IOS_FIREBASE_FILE }),
            infoPlist: {
                UIBackgroundModes: ['remote-notification', 'fetch', 'location'],
                // The UI is in Russian; system texts follow it
                CFBundleDevelopmentRegion: 'ru',
                CFBundleLocalizations: ['ru'],
                NSCameraUsageDescription: 'Prime Team использует камеру, чтобы снимать фото и видео для сообщений.',
                NSMicrophoneUsageDescription: 'Prime Team использует микрофон, чтобы записывать видео для сообщений.',
                NSPhotoLibraryUsageDescription: 'Prime Team открывает галерею, чтобы отправлять фото и видео в сообщениях.',
                NSFaceIDUsageDescription: 'Prime Team использует Face ID для защиты входа.',
            },
            ...(firebaseEnabled && { entitlements: { 'aps-environment': 'production' } }),
        },
        android: {
            adaptiveIcon: {
                foregroundImage: './assets/adaptive-icon.png',
                backgroundColor: BRAND_GREEN,
            },
            softwareKeyboardLayoutMode: 'pan',
            package: APP_ID,
            versionCode: 3,
            ...(firebaseEnabled && { googleServicesFile: ANDROID_FIREBASE_FILE }),
        },
        web: {
            favicon: './assets/favicon.png',
        },
        plugins: [
            ['expo-router'],
            [
                'expo-splash-screen',
                {
                    backgroundColor: BRAND_GREEN,
                    image: './assets/splash.png',
                    imageWidth: 200,
                    resizeMode: 'contain',
                    dark: {
                        backgroundColor: BRAND_GREEN,
                        image: './assets/splash.png',
                    },
                },
            ],
            ['expo-secure-store'],
            ['expo-location', {
                locationWhenInUsePermission: 'Prime Team сохраняет вашу геопозицию каждые 5 минут с 07:00 до 21:00 по времени Казахстана, только после вашего согласия.',
                locationAlwaysAndWhenInUsePermission: 'Разрешите геопозицию в фоне для записи местоположения с 07:00 до 21:00 по времени Казахстана. Отслеживание можно выключить в профиле.',
                isIosBackgroundLocationEnabled: true,
                isAndroidBackgroundLocationEnabled: true,
                isAndroidForegroundServiceEnabled: true,
            }],
            [
                'expo-font',
                {
                    fonts: ['./assets/fonts/CalSans-SemiBold.otf'],
                },
            ],
            ...(firebaseEnabled ? FIREBASE_PACKAGES : []),
            [
                'expo-build-properties',
                {
                    ios: {
                        useFrameworks: 'static',
                    },
                },
            ],
            'expo-video',
            './plugins/withReleaseSigning',
        ],
        extra: {
            router: {
                origin: false,
            },
            firebaseEnabled,
            // Public source of this fork (AGPL-3.0), shown in the profile
            sourceCodeURL: 'https://github.com/beksultanweb/prime-team',
        },
    },
}
