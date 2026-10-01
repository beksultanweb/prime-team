# Firebase (push notifications)

Put the Firebase config files for the `kz.primegc.team` app here:

- `GoogleService-Info.plist` (iOS)
- `google-services.json` (Android)

Both files are ignored by git. `app.config.js` turns on the Firebase plugins
and push notifications only when both files exist; without them the app
builds and works without push notifications.

After adding or removing the files, regenerate the native projects:
`npx expo prebuild --clean`.
