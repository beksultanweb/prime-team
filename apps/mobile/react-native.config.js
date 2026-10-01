const { firebaseEnabled, FIREBASE_PACKAGES } = require('./firebase.config')

// Without Firebase config the native Firebase modules stay out of the build.
// Expo autolinking reads "expo.autolinking.exclude" in package.json; React
// Native codegen reads this file, and without it registers RNFBAppModule in
// the iOS module providers and the app crashes on start.
module.exports = {
    dependencies: firebaseEnabled
        ? {}
        : Object.fromEntries(FIREBASE_PACKAGES.map(name => [name, { platforms: { ios: null, android: null } }])),
}
