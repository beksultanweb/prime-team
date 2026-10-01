const os = require('os')
const path = require('path')
const { withAppBuildGradle } = require('expo/config-plugins')

/**
 * Signs Android release builds with the Google Play upload key.
 *
 * The key stays outside the repository. Its settings are read from
 * ANDROID_UPLOAD_KEY_PROPERTIES or ~/.android-keys/prime-team-upload.properties:
 *   storeFile=/absolute/path/to/upload.jks
 *   storePassword=...
 *   keyAlias=...
 *   keyPassword=...
 * Without the file, release builds keep the template's debug signing.
 */
const DEFAULT_PROPERTIES = path.join(os.homedir(), '.android-keys', 'prime-team-upload.properties')

const SIGNING_CONFIG = `
        release {
            def uploadKeyProperties = new Properties()
            def uploadKeyFile = file(System.getenv('ANDROID_UPLOAD_KEY_PROPERTIES') ?: '${DEFAULT_PROPERTIES}')
            if (uploadKeyFile.exists()) {
                uploadKeyFile.withInputStream { uploadKeyProperties.load(it) }
                storeFile file(uploadKeyProperties['storeFile'])
                storePassword uploadKeyProperties['storePassword']
                keyAlias uploadKeyProperties['keyAlias']
                keyPassword uploadKeyProperties['keyPassword']
            }
        }`

module.exports = function withReleaseSigning(config) {
    return withAppBuildGradle(config, (config) => {
        let gradle = config.modResults.contents
        if (gradle.includes('uploadKeyProperties')) return config

        // Add a release signing config next to the template's debug one
        gradle = gradle.replace(/(signingConfigs\s*\{)/, `$1${SIGNING_CONFIG}`)

        // Use it for the release build type when the key file is present
        gradle = gradle.replace(
            /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
            `$1signingConfig signingConfigs.release.storeFile ? signingConfigs.release : signingConfigs.debug`
        )

        config.modResults.contents = gradle
        return config
    })
}

