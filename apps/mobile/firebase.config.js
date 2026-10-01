const fs = require('fs')
const path = require('path')

// Firebase config for kz.primegc.team goes into ./firebase (not in git).
// Without both files the app builds without Firebase and push notifications.
const IOS_FIREBASE_FILE = './firebase/GoogleService-Info.plist'
const ANDROID_FIREBASE_FILE = './firebase/google-services.json'

const firebaseEnabled = [IOS_FIREBASE_FILE, ANDROID_FIREBASE_FILE].every(file =>
    fs.existsSync(path.join(__dirname, file))
)

const FIREBASE_PACKAGES = [
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
    '@react-native-firebase/crashlytics',
    '@react-native-firebase/perf',
]

module.exports = { IOS_FIREBASE_FILE, ANDROID_FIREBASE_FILE, firebaseEnabled, FIREBASE_PACKAGES }
