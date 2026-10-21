# Angel — Native Android Assistant (Samsung Galaxy S26 Ultra)

A dedicated, native Android AI assistant built with **Kotlin** and **Jetpack Compose (Material 3)**, optimized for modern Samsung Galaxy flagship devices (including the **Samsung Galaxy S26 Ultra** running Android 15 / 16 One UI).

---

## Architecture & Features

1. **Native Jetpack Compose UI**:
   - Modern Material 3 dark-mode design inspired by the Angel aesthetic (slate, deep violet, cyan accents).
   - Animated, pulsing female assistant avatar with real-time listening and speaking states.
2. **Dual-Language System**:
   - **Hinglish (Default / First Priority)**: Roman script only (zero Devanagari characters) with natural conversational tone.
   - **English (Second Priority)**: Fluent, natural English mode.
   - Default welcome message:
     ```text
     Hello Sir! Main Angel hoon, aapki personal AI assistant.
     Bataiye Sir, main aaj aapki kis kaam mein madad kar sakti hoon?
     ```
3. **Voice Input & Spoken Responses**:
   - Native Android `SpeechRecognizer` for touch-to-talk voice recognition.
   - Native `TextToSpeech` configured for Indian English female voice playback.
4. **Secure AI Integration**:
   - Angel sends chat requests to the Angel Cloud API over HTTPS.
   - The Gemini provider key is stored only in the cloud host's `GEMINI_API_KEY` secret and is not packaged in the Android APK.
   - The Android build receives only the public HTTPS base URL through `ANGEL_AI_API_BASE_URL`; AI chat remains unavailable until the cloud service is deployed and configured.
5. **Screen Understanding (Accessibility Service)**:
   - Structured `AngelAccessibilityService` foundation for safe, consent-driven screen reading.
   - Does not perform unsolicited automated clicks or hidden background actions. Requires explicit user activation in Samsung Accessibility settings.
6. **Google Ads Automation Approval Workflow**:
   - Built-in human-in-the-loop approval screen (`ApprovalScreen.kt`).
   - Displays proposed campaign drafts, keywords, target budget, and ad copy.
   - Protects advertising budgets: requires explicit manual approval, supports safe dry-run simulation, and transparently requires connected OAuth 2.0 developer credentials before any live campaign can ever be published.

---

## Project Structure

```
android-angel/
├── build.gradle.kts                   # Root build script
├── settings.gradle.kts                # Project & repository configuration
├── gradle.properties                  # JVM & AndroidX optimization flags
├── local.properties.example           # Example local properties (SDK path & Gemini key)
├── gradlew / gradlew.bat              # Gradle wrapper execution scripts
├── gradle/
│   ├── libs.versions.toml             # Gradle version catalog (AGP 8.7.3, Kotlin 2.1.0, Compose BOM)
│   └── wrapper/
│       └── gradle-wrapper.properties  # Gradle 8.11.1 distribution config
└── app/
    ├── build.gradle.kts               # Module build configuration (minSdk 26, targetSdk 35)
    ├── proguard-rules.pro             # Proguard obfuscation rules
    └── src/main/
        ├── AndroidManifest.xml        # Permissions (Audio, Calls, Notifications) & Services
        ├── res/
        │   ├── values/
        │   │   ├── strings.xml        # Strings and labels
        │   │   ├── colors.xml         # Color palette
        │   │   └── themes.xml         # Dark theme style
        │   └── xml/
        │       └── accessibility_service_config.xml # Accessibility configuration
        └── java/com/angel/assistant/
            ├── AngelApp.kt            # Application class
            ├── MainActivity.kt        # Jetpack Compose entry point & permissions
            ├── theme/                 # Material 3 Color, Type, and Theme
            ├── data/
            │   ├── model/             # ChatMessage, AssistantLanguage, ActionIntent, GoogleAdsApprovalItem
            │   └── api/               # GeminiApiClient (HTTPS cloud proxy)
            ├── voice/                 # VoiceManager (SpeechRecognizer & TextToSpeech)
            ├── service/               # AngelAccessibilityService (Screen understanding)
            ├── workflow/              # GoogleAdsApprovalWorkflow (Safeguarded campaign review)
            └── ui/                    # HomeScreen, ChatScreen, ApprovalScreen, SettingsScreen, AngelAvatar
```

---

## Step-by-Step Build & Installation Guide

### Prerequisites
- **Computer**: Windows, macOS, or Linux.
- **Android Studio**: Android Studio Ladybug (2024.2.1+) or newer.
- **JDK**: Java 17 or Java 21 (bundled inside modern Android Studio).
- **Device**: Samsung Galaxy S26 Ultra (or any Android device running Android 8.0+ / API 26+).

---

### Step 1: Configure `local.properties`
1. Inside the `android-angel` directory, copy `local.properties.example` to `local.properties`:
   ```bash
   cp local.properties.example local.properties
   ```
2. Open `local.properties` in any text editor and configure:
   ```properties
   # Windows example:
   sdk.dir=C\:\\Users\\YourUsername\\AppData\\Local\\Android\\Sdk

   # macOS example:
   # sdk.dir=/Users/YourUsername/Library/Android/sdk

   # Optional: public HTTPS base URL of the deployed Angel AI server:
   ANGEL_AI_API_BASE_URL=https://your-deployed-angel-cloud.example
   ```
   **Do not put `GEMINI_API_KEY` in Android `local.properties` or in the APK.** Configure that secret only in the cloud host's secret settings. If the server URL is blank or the server is not deployed, AI chat will show a server-configuration message.

---

### Step 2: Open in Android Studio
1. Launch **Android Studio**.
2. Click **Open** (or **File > Open**).
3. Select the `android-angel` directory.
4. Android Studio will automatically sync the Gradle project using Gradle 8.11.1 and download required Android 15 (API 35) SDK platform packages.

---

### Step 3: Prepare Your Samsung Galaxy S26 Ultra
1. On your Galaxy S26 Ultra, open **Settings**.
2. Scroll to the bottom and tap **About phone** > **Software information**.
3. Tap **Build number** 7 times rapidly until you see the message: *"Developer mode has been enabled"*.
4. Go back to **Settings** > **Developer options** (now visible at the bottom).
5. Turn on **USB debugging**.
6. Connect your phone to your computer with a USB-C cable.
7. A prompt will appear on your Galaxy S26 Ultra screen: *"Allow USB debugging?"* — check **Always allow from this computer** and tap **Allow**.

*(Alternatively, you can use **Wireless debugging** in Developer Options to connect over Wi-Fi without a cable).*

---

### Step 4: Build & Run the App
- **From Android Studio**:
  1. Select `app` in the run configuration dropdown on the top toolbar.
  2. Select your connected **Samsung Galaxy S26 Ultra** in the device dropdown.
  3. Click the green **Run** button (or press `Shift + F10`).
  4. The APK will compile and automatically launch on your phone.

- **From Command Line (Terminal)**:
  ```bash
  cd android-angel
  ./gradlew assembleDebug
  adb install -r app/build/outputs/apk/debug/app-debug.apk
  ```

---

### Step 5: (Optional) Enable Screen Understanding
If you want Angel to assist with on-screen content:
1. On your Samsung Galaxy S26 Ultra, go to **Settings** > **Accessibility**.
2. Tap **Installed apps** (or **Downloaded apps**).
3. Select **Angel Screen Understanding** and toggle it **On**.
4. Confirm Samsung's permission dialog.

---

### Step 6: Review Google Ads Campaigns
1. On Angel's home screen, tap **Ads Approvals**.
2. Review proposed keywords, proposed budgets, and copy.
3. Tap **Approve** or **Dry-Run**.
4. Note: No funds can be spent and no campaigns will be published until a live Google Ads OAuth 2.0 developer token is connected in the backend.

---

## Validation & Compatibility
- **Gradle Version**: 8.11.1 (via `gradle-wrapper.properties`).
- **Android Gradle Plugin (AGP)**: 8.7.3.
- **Kotlin**: 2.1.0 with Compose Compiler extension.
- **Compile / Target SDK**: Android 15 (API 35).
- **Minimum SDK**: Android 8.0 Oreo (API 26) — fully forward-compatible with Samsung Galaxy S26 Ultra (One UI 7 / 8).
