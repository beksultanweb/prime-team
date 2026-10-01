const { firebaseEnabled, FIREBASE_PACKAGES } = require('./firebase.config')

// Without Firebase config the native Firebase modules are not linked:
// their build phases (Crashlytics) fail without GOOGLE_APP_ID.
module.exports = {
    dependencies: firebaseEnabled
        ? {}
        : Object.fromEntries(FIREBASE_PACKAGES.map(name => [name, { platforms: { ios: null, android: null } }])),
}
