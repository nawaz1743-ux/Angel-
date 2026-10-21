# Angel — Native Android Assistant

Angel is a native Android assistant built with Kotlin and Jetpack Compose (Material 3). The Android project is in `android-angel/`.

## Current Android configuration

- **Application ID / namespace:** `com.angel.assistant`
- **Minimum Android version:** Android 8.0 (API 26)
- **Compile / target SDK:** 35
- **Java:** 17
- **Gradle wrapper:** 8.11.1
- **Android Gradle Plugin:** 8.7.3
- **Kotlin:** 2.1.0
- **UI:** Jetpack Compose / Material 3
- **Languages:** Hinglish (Roman script) and English
- **AI model order configured in code:** `gemini-3.8-flash` first, then `gemini-3.5-flash-lite` if the first request fails. Availability of these exact model IDs depends on the Google AI project/API access and must be verified against the models enabled for that project.

## Implemented app areas

- Chat UI and Gemini text requests
- Speech input and Android TextToSpeech
- Explicit device-command routing for supported actions
- Accessibility-based screen text features, subject to Android accessibility permission and app-specific restrictions
- Local Google Ads draft approval/rejection/dry-run workflow
- Menu, settings, and home screens

Feature availability can depend on Android permissions, installed apps, device settings, network access, and service credentials. Building successfully does not by itself verify behaviour on a physical phone.

## Gemini API key configuration and security

On the current `main` branch, `GeminiApiClient.kt` reads `BuildConfig.GEMINI_API_KEY`. The Android Gradle build obtains the value from `android-angel/local.properties` or the `GEMINI_API_KEY` environment variable. The CI workflow can provide the GitHub Actions secret named `GEMINI_API_KEY`.

**Important security limitation:** this current direct-to-Gemini Android implementation embeds the configured key in the generated APK, where a determined user may be able to extract it. A GitHub Secret protects the value in repository settings and logs when handled correctly, but it does not make a key embedded in a client APK secret. Do not use a key with privileges or billing exposure you cannot risk. A server-side proxy is needed before treating the key as protected from APK extraction. A missing key returns a configuration message; do not rely on older documentation that promised a fully capable offline AI engine.

## Build a debug APK

The GitHub Actions workflow `.github/workflows/android-build.yml` builds the debug APK, runs Android local unit tests, runs the separate Ads Cloud API tests, and uploads the debug APK as an artifact when the relevant code is present on the branch.

For a local development environment with Android SDK installed:

```bash
cd android-angel
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

The debug APK is created at:

`android-angel/app/build/outputs/apk/debug/app-debug.apk`

## Signed release APK

The separate workflow `.github/workflows/android-release.yml` can build a signed release APK manually from GitHub Actions or when a version tag such as `v1.0.0` is pushed. The workflow requires these GitHub repository **Actions secrets**:

- `ANDROID_KEYSTORE_BASE64` — the complete release keystore file encoded as Base64
- `ANDROID_KEYSTORE_PASSWORD` — keystore password
- `ANDROID_KEY_ALIAS` — signing key alias
- `ANDROID_KEY_PASSWORD` — signing key password

The workflow decodes the keystore only during the job, uses it for Gradle signing, and removes the temporary file afterward. The secrets and keystore are not committed to the repository. Do not publish the keystore or passwords. If the secrets are not configured, the release workflow intentionally stops before building.

A release APK is uploaded as the `Angel-Signed-Release-APK` workflow artifact. A successful workflow is required before calling the artifact a signed release APK. Keep a secure backup of the original keystore and credentials: losing them can prevent updates to the same app signing identity.

## Automated Android tests

The Android module uses JUnit 4 local JVM tests. Current tests cover the approval workflow state transitions and basic chat/language model behaviour. They do not replace device or emulator testing of microphone permissions, speech recognition, TextToSpeech, notifications, alarms, AccessibilityService, external apps, or live Gemini API access.

Run tests with:

```bash
cd android-angel
./gradlew testDebugUnitTest
```

## GitHub Actions

- `.github/workflows/android-build.yml` — debug APK build, Android unit tests, and Ads Cloud API tests.
- `.github/workflows/android-release.yml` — signed release APK build; requires the signing secrets above.

The Android release workflow does not publish to Google Play. It only builds and uploads the signed APK artifact.
