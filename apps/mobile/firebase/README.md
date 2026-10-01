# Firebase (push notifications)

Put the Firebase config files for the `kz.primegc.team` app here:

- `GoogleService-Info.plist` (iOS)
- `google-services.json` (Android)

Both files are ignored by git. `app.config.js` turns on the Firebase plugins
and push notifications only when both files exist; without them the app
builds and works without push notifications.

The native Firebase modules are also listed in `expo.autolinking.exclude` in
`package.json`, which keeps them out of builds without the config. Remove the
`@react-native-firebase/*` entries from that list when adding the files
(the build stops with a reminder otherwise).

After adding or removing the files, regenerate the native projects:
`npx expo prebuild --clean`.
