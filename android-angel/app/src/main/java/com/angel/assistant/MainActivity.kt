package com.angel.assistant

import android.Manifest
import android.content.Intent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.angel.assistant.data.api.GeminiApiClient
import com.angel.assistant.data.model.AssistantLanguage
import com.angel.assistant.data.model.ChatMessage
import com.angel.assistant.service.AngelAccessibilityService
import com.angel.assistant.theme.AngelTheme
import com.angel.assistant.theme.Slate950
import com.angel.assistant.ui.ApprovalScreen
import com.angel.assistant.ui.ChatScreen
import com.angel.assistant.ui.HomeScreen
import com.angel.assistant.ui.MenuScreen
import com.angel.assistant.ui.ProductivityScreen
import com.angel.assistant.ui.ProductivityTab
import com.angel.assistant.ui.SettingsScreen
import com.angel.assistant.ui.SmartAdsManagerScreen
import com.angel.assistant.voice.VoiceManager
import com.angel.assistant.voice.WakeWordService
import com.angel.assistant.workflow.GoogleAdsApprovalWorkflow
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

enum class Screen {
    HOME,
    MENU,
    CHAT,
    APPROVALS,
    SMART_ADS,
    SETTINGS,
    PRODUCTIVITY
}

class MainActivity : ComponentActivity() {

    private lateinit var voiceManager: VoiceManager

    private val geminiClient = GeminiApiClient()
    private val adsWorkflow = GoogleAdsApprovalWorkflow()
    private val actionCommandRouter by lazy { ActionCommandRouter(this) }

    private var isListeningState = mutableStateOf(false)
    private var isSpeakingState = mutableStateOf(false)
    private var transcriptState = mutableStateOf("")
    private var isFinalTranscriptState = mutableStateOf(false)
    private var isHandsFreeEnabledState = mutableStateOf(false)
    private var isProcessingState = mutableStateOf(false)
    private var isWakeWordEnabledState = mutableStateOf(false)
    private var wakeWordTriggeredState = mutableStateOf(false)

    private val wakeWordReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == WakeWordService.ACTION_WAKEWORD_DETECTED &&
                isWakeWordEnabledState.value && ::voiceManager.isInitialized
            ) {
                wakeWordTriggeredState.value = true
            }
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val recordAudioGranted =
            permissions[Manifest.permission.RECORD_AUDIO] ?: false

        if (recordAudioGranted) {
            Toast.makeText(
                this,
                "Microphone permission granted",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private val callPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        Toast.makeText(
            this,
            if (granted) {
                "Phone permission granted. Repeat your call command."
            } else {
                "Phone permission denied. Angel will not place calls directly."
            },
            Toast.LENGTH_LONG
        ).show()
    }

    private val contactsPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        Toast.makeText(
            this,
            if (granted) {
                "Contacts permission granted. Repeat your call command."
            } else {
                "Contacts permission denied. Angel cannot search contacts."
            },
            Toast.LENGTH_LONG
        ).show()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        isWakeWordEnabledState.value = getSharedPreferences("angel_voice", MODE_PRIVATE)
            .getBoolean("wake_word_enabled", false)

        voiceManager = VoiceManager(
            context = this,
            onTranscript = { text, isFinal ->
                runOnUiThread {
                    transcriptState.value = text
                    if (isFinal) {
                        isFinalTranscriptState.value = true
                        if (isHandsFreeEnabledState.value && text.isNotBlank()) {
                            // Hold the auto-listen loop while this final utterance is submitted.
                            isProcessingState.value = true
                        }
                    }
                }
            },
            onSpeakingStateChanged = { speaking ->
                runOnUiThread {
                    isSpeakingState.value = speaking
                    if (!speaking) isProcessingState.value = false
                }
            },
            onRecognitionStateChanged = { listening ->
                runOnUiThread {
                    isListeningState.value = listening
                }
            },
            onRecognitionError = { error ->
                runOnUiThread {
                    isListeningState.value = false
                    val recoverable = error == android.speech.SpeechRecognizer.ERROR_NO_MATCH ||
                        error == android.speech.SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                    if (isHandsFreeEnabledState.value && !recoverable) {
                        isHandsFreeEnabledState.value = false
                        isProcessingState.value = false
                        Toast.makeText(
                            this@MainActivity,
                            "Sir, voice recognition service mein problem aayi. Hands-Free ruk gaya hai; mic dobara try karein.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }
        )

        checkAndRequestPermissions()

        setContent {
            AngelTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Slate950
                ) {
                    AngelAppContent()
                }
            }
        }
    }

    private fun checkAndRequestPermissions() {
        val permissionsToRequest = mutableListOf(
            Manifest.permission.RECORD_AUDIO
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsToRequest.add(
                Manifest.permission.POST_NOTIFICATIONS
            )
        }

        val missing = permissionsToRequest.filter {
            ContextCompat.checkSelfPermission(
                this,
                it
            ) != PackageManager.PERMISSION_GRANTED
        }

        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    @Composable
    private fun AngelAppContent() {
        var currentScreen by remember {
            mutableStateOf(Screen.HOME)
        }

        var currentLanguage by remember {
            mutableStateOf(AssistantLanguage.HINGLISH)
        }
        var productivityTab by remember { mutableStateOf(ProductivityTab.REMINDERS) }
        var chatInitialPrompt by remember { mutableStateOf<String?>(null) }

        val scope = rememberCoroutineScope()

        BackHandler(enabled = currentScreen != Screen.HOME) {
            currentScreen = when (currentScreen) {
                Screen.MENU -> Screen.HOME
                Screen.CHAT -> Screen.HOME
                Screen.SETTINGS, Screen.SMART_ADS, Screen.APPROVALS, Screen.PRODUCTIVITY -> Screen.MENU
                Screen.HOME -> Screen.HOME
            }
        }

        val messages = remember {
            mutableStateListOf(
                ChatMessage(
                    text = "Hello Sir! Main Angel hoon, aapki personal AI assistant.\nBataiye Sir, main aaj aapki kis kaam mein madad kar sakti hoon?",
                    isFromUser = false,
                    provider = "Angel Assistant Engine"
                )
            )
        }

        val approvalItems by adsWorkflow.approvalQueue.collectAsState()

        val isListening by isListeningState
        val isSpeaking by isSpeakingState
        val transcript by transcriptState
        val isFinalTranscript by isFinalTranscriptState
        val isHandsFreeEnabled by isHandsFreeEnabledState
        val isProcessing by isProcessingState
        val isWakeWordEnabled by isWakeWordEnabledState
        val wakeWordTriggered by wakeWordTriggeredState

        LaunchedEffect(wakeWordTriggered) {
            if (wakeWordTriggered) {
                currentScreen = Screen.CHAT
                transcriptState.value = ""
                isFinalTranscriptState.value = false
                isProcessingState.value = false
                wakeWordTriggeredState.value = false
                delay(100L)
                isHandsFreeEnabledState.value = true
            }
        }

        fun handleSendMessage(userText: String) {
            if (userText.isBlank()) {
                isProcessingState.value = false
                return
            }
            isProcessingState.value = true

            // Explicit multi-step commands are executed locally in order. Each step is
            // re-checked by the action router, including the finance-screen guard.
            val multiSteps = actionCommandRouter.parseMultiStepCommand(userText)
            if (multiSteps != null) {
                val missingCallPermission = multiSteps.any { step ->
                    actionCommandRouter.requiresCallPermission(step) &&
                        ContextCompat.checkSelfPermission(
                            this@MainActivity, Manifest.permission.CALL_PHONE
                        ) != PackageManager.PERMISSION_GRANTED
                }
                val missingContactsPermission = multiSteps.any { step ->
                    actionCommandRouter.requiresContactLookup(step) &&
                        ContextCompat.checkSelfPermission(
                            this@MainActivity, Manifest.permission.READ_CONTACTS
                        ) != PackageManager.PERMISSION_GRANTED
                }

                if (missingCallPermission || missingContactsPermission) {
                    messages.add(ChatMessage(text = userText, isFromUser = true))
                    val permissionMessage = if (missingCallPermission) {
                        "Sir, is task mein phone call ke liye Phone permission chahiye. Allow karke poora command dobara boliye."
                    } else {
                        "Sir, is task mein contact dhoondhne ke liye Contacts permission chahiye. Allow karke poora command dobara boliye."
                    }
                    messages.add(ChatMessage(
                        text = permissionMessage,
                        isFromUser = false,
                        provider = "Angel Action System"
                    ))
                    voiceManager.speak(permissionMessage, currentLanguage)
                    if (missingCallPermission) {
                        callPermissionLauncher.launch(Manifest.permission.CALL_PHONE)
                    } else {
                        contactsPermissionLauncher.launch(Manifest.permission.READ_CONTACTS)
                    }
                    return
                }

                messages.add(ChatMessage(text = userText, isFromUser = true))
                scope.launch {
                    val completedSteps = mutableListOf<String>()
                    for ((index, step) in multiSteps.withIndex()) {
                        val result = actionCommandRouter.handle(step)
                        if (result == null) {
                            completedSteps.add("Step ${index + 1}: Command samajh nahi aaya, isliye aage ke actions rok diye.")
                            break
                        }
                        completedSteps.add("Step ${index + 1}: $result")

                        // Give launched apps time to become the foreground window before
                        // the next action. A call is terminal: never run more actions after it.
                        val isCallStep = actionCommandRouter.requiresCallPermission(step) ||
                            actionCommandRouter.isWhatsAppCallCommand(step)
                        if (isCallStep) break
                        if (index < multiSteps.lastIndex) {
                            val expectedPackage = actionCommandRouter.expectedForegroundPackageForOpenCommand(step)
                            if (expectedPackage != null) {
                                // Do not run the next step just because a fixed delay elapsed.
                                // Wait for Accessibility to confirm the requested app is foreground.
                                var foregroundVerified = false
                                for (attempt in 0 until 20) {
                                    delay(250L)
                                    val actualPackage = AngelAccessibilityService.currentForegroundPackage()
                                    if (actualPackage == expectedPackage) {
                                        foregroundVerified = true
                                        break
                                    }
                                }
                                if (!foregroundVerified) {
                                    completedSteps.add(
                                        "Step ${index + 1}: App foreground verify nahi hua; safety ke liye agla action rok diya."
                                    )
                                    break
                                }
                            } else {
                                delay(700L)
                            }
                        }
                    }
                    val response = completedSteps.joinToString("\n")
                    messages.add(ChatMessage(
                        text = response,
                        isFromUser = false,
                        provider = "Angel Multi-step Task"
                    ))
                    voiceManager.speak(response, currentLanguage)
                }
                return
            }

            // Direct calls are made only for an explicit call command. Android permission is required.
            if (
                actionCommandRouter.requiresCallPermission(userText) &&
                ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.CALL_PHONE
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                val permissionMessage = "Sir, phone call start karne ke liye Phone permission chahiye. Allow karein, phir call command dobara boliye."
                messages.add(ChatMessage(text = userText, isFromUser = true))
                messages.add(ChatMessage(text = permissionMessage, isFromUser = false, provider = "Angel Action System"))
                voiceManager.speak(permissionMessage, currentLanguage)
                callPermissionLauncher.launch(Manifest.permission.CALL_PHONE)
                return
            }

            // Ask for Contacts permission only when a contact-call command needs it.
            if (
                actionCommandRouter.requiresContactLookup(userText) &&
                ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.READ_CONTACTS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                val permissionMessage = "Sir, contact dhoondhne ke liye Contacts permission chahiye. Prompt mein Allow karein, phir call command dobara boliye."
                messages.add(ChatMessage(text = userText, isFromUser = true))
                messages.add(ChatMessage(text = permissionMessage, isFromUser = false, provider = "Angel Action System"))
                voiceManager.speak(permissionMessage, currentLanguage)
                contactsPermissionLauncher.launch(Manifest.permission.READ_CONTACTS)
                return
            }

            // Recognized device commands run locally; ordinary conversation still goes to Gemini.
            val actionResult = actionCommandRouter.handle(userText)
            if (actionResult != null) {
                messages.add(
                    ChatMessage(
                        text = userText,
                        isFromUser = true
                    )
                )
                messages.add(
                    ChatMessage(
                        text = actionResult,
                        isFromUser = false,
                        provider = "Angel Action System"
                    )
                )
                voiceManager.speak(actionResult, currentLanguage)
                return
            }

            messages.add(
                ChatMessage(
                    text = userText,
                    isFromUser = true
                )
            )

            scope.launch {
                val response = try {
                    geminiClient.generateAngelResponse(
                        prompt = userText,
                        history = messages,
                        language = currentLanguage
                    )
                } catch (_: Exception) {
                    "Sir, abhi response connect nahi ho saka. Internet connection check karke dobara try karein."
                }

                messages.add(
                    ChatMessage(
                        text = response,
                        isFromUser = false,
                        provider = geminiClient.lastUsedModel?.let { model ->
                            "Gemini ($model)"
                        } ?: if (
                            BuildConfig.GEMINI_API_KEY.isNotBlank() &&
                            BuildConfig.GEMINI_API_KEY != "YOUR_GEMINI_API_KEY_HERE"
                        ) {
                            "Gemini (model unavailable)"
                        } else {
                            "Angel Assistant Engine (Offline)"
                        }
                    )
                )

                voiceManager.speak(
                    response,
                    currentLanguage
                )
            }
        }

        fun handleMicToggle() {
            // In Hands-Free mode the same mic control safely exits the continuous session.
            if (isHandsFreeEnabledState.value) {
                isHandsFreeEnabledState.value = false
                voiceManager.stopListening()
                isListeningState.value = false
                isProcessingState.value = false
                transcriptState.value = ""
                isFinalTranscriptState.value = false
                return
            }

            if (isListening) {
                // Stop capture and let the final RecognitionListener callback submit the
                // transcript. Polling here raced the callback and could delay or discard
                // a transcript that was already visible in the input field.
                voiceManager.stopListening()
                isListeningState.value = false
            } else {
                if (
                    ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.RECORD_AUDIO
                    ) != PackageManager.PERMISSION_GRANTED
                ) {
                    checkAndRequestPermissions()
                    return
                }

                transcriptState.value = ""
                isFinalTranscriptState.value = false
                if (!voiceManager.startListening(currentLanguage)) {
                    Toast.makeText(
                        this@MainActivity,
                        "Sir, speech recognition start nahi ho paayi. Google voice input check karein.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }

        // Submit each final recognition result exactly once in both single-turn mic
        // mode and Hands-Free mode. The final callback is the source of truth; do not poll
        // Compose state after stopListening(), because Android delivers that callback later.
        LaunchedEffect(isFinalTranscript) {
            if (isFinalTranscript) {
                val spoken = transcriptState.value.trim()
                transcriptState.value = ""
                isFinalTranscriptState.value = false
                if (spoken.isNotBlank()) {
                    handleSendMessage(spoken)
                } else {
                    isProcessingState.value = false
                }
            }
        }

        LaunchedEffect(isHandsFreeEnabled, isListening, isProcessing, isSpeaking, currentScreen) {
            if (isHandsFreeEnabled && currentScreen != Screen.CHAT) {
                isHandsFreeEnabledState.value = false
                voiceManager.stopListening()
                isListeningState.value = false
                isProcessingState.value = false
                return@LaunchedEffect
            }

            if (isHandsFreeEnabled && currentScreen == Screen.CHAT &&
                !isListening && !isProcessing && !isSpeaking
            ) {
                // SpeechRecognizer often needs time to finish the previous session.
                // Retry briefly instead of disabling Hands-Free on the first busy response.
                delay(700L)
                var started = false
                for (attempt in 0 until 5) {
                    if (!isHandsFreeEnabledState.value || currentScreen != Screen.CHAT ||
                        isListeningState.value || isProcessingState.value || isSpeakingState.value
                    ) {
                        return@LaunchedEffect
                    }
                    if (voiceManager.startListening(currentLanguage)) {
                        started = true
                        break
                    }
                    delay(400L)
                }
                if (!started && isHandsFreeEnabledState.value && currentScreen == Screen.CHAT &&
                    !isListeningState.value && !isProcessingState.value && !isSpeakingState.value
                ) {
                    isHandsFreeEnabledState.value = false
                    isProcessingState.value = false
                    Toast.makeText(
                        this@MainActivity,
                        "Sir, speech recognition baar-baar start nahi ho paayi. Google voice input aur microphone permission check karein.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }

        when (currentScreen) {

            Screen.HOME -> HomeScreen(
                language = currentLanguage,
                isListening = isListening,
                isSpeaking = isSpeaking,
                onMicClick = {
                    handleMicToggle()
                },
                onNavigateChat = {
                    currentScreen = Screen.CHAT
                },
                onNavigateApprovals = {
                    currentScreen = Screen.APPROVALS
                },
                onNavigateSettings = {
                    currentScreen = Screen.SETTINGS
                },
                onInspectScreen = {
                    val screenText =
                        AngelAccessibilityService.captureVisibleScreenText()

                    messages.add(
                        ChatMessage(
                            text = "Screen Inspection Result:\n$screenText",
                            isFromUser = false,
                            provider = "Angel Accessibility Service"
                        )
                    )

                    currentScreen = Screen.CHAT
                },
                onToggleLanguage = {
                    currentLanguage =
                        if (currentLanguage == AssistantLanguage.HINGLISH) {
                            AssistantLanguage.ENGLISH
                        } else {
                            AssistantLanguage.HINGLISH
                        }
                },
                onOpenMenu = {
                    currentScreen = Screen.MENU
                }
            )

            Screen.MENU -> MenuScreen(
                onOpenChat = {
                    chatInitialPrompt = null
                    currentScreen = Screen.CHAT
                },
                onOpenWriting = {
                    chatInitialPrompt = if (currentLanguage == AssistantLanguage.HINGLISH) {
                        "Writing Assistant: Mere liye jo text chahiye use draft karo. Pehle audience, purpose aur tone samajh kar concise, ready-to-use draft do. Agar details missing hain, ek short clarification poochho."
                    } else {
                        "Writing Assistant: Help me draft the text I need. Consider audience, purpose, and tone, then provide a concise ready-to-use draft. Ask one brief clarification if essential details are missing."
                    }
                    currentScreen = Screen.CHAT
                },
                onOpenTranslation = {
                    chatInitialPrompt = if (currentLanguage == AssistantLanguage.HINGLISH) {
                        "Translation mode: Mujhse source text aur target language lo. Meaning, names aur tone preserve karke translation do; extra explanation mat do jab tak main na maangoon."
                    } else {
                        "Translation mode: Ask me for the source text and target language. Preserve meaning, names, and tone; do not add explanations unless I ask."
                    }
                    currentScreen = Screen.CHAT
                },
                onOpenLearning = {
                    chatInitialPrompt = if (currentLanguage == AssistantLanguage.HINGLISH) {
                        "Learning Assistant: Mujhe topic simple Roman Hinglish mein step-by-step samjhao, ek practical example do, aur end mein ek chhota check-question poochho."
                    } else {
                        "Learning Assistant: Teach me the topic step by step in simple English, give one practical example, and finish with one short check question."
                    }
                    currentScreen = Screen.CHAT
                },
                onOpenApprovals = {
                    currentScreen = Screen.APPROVALS
                },
                onOpenSmartAds = {
                    currentScreen = Screen.SMART_ADS
                },
                onOpenSettings = {
                    currentScreen = Screen.SETTINGS
                },
                onInspectScreen = {
                    val screenText =
                        AngelAccessibilityService.captureVisibleScreenText()

                    messages.add(
                        ChatMessage(
                            text = "Screen Inspection Result:\n$screenText",
                            isFromUser = false,
                            provider = "Angel Accessibility Service"
                        )
                    )

                    currentScreen = Screen.CHAT
                },
                onHandsFree = {
                    currentScreen = Screen.CHAT
                    if (ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.RECORD_AUDIO
                        ) != PackageManager.PERMISSION_GRANTED
                    ) {
                        checkAndRequestPermissions()
                        Toast.makeText(
                            this@MainActivity,
                            "Sir, microphone permission allow karke Hands-Free dobara start karein.",
                            Toast.LENGTH_LONG
                        ).show()
                    } else {
                        isHandsFreeEnabledState.value = true
                        isProcessingState.value = false
                        isListeningState.value = false
                        transcriptState.value = ""
                        isFinalTranscriptState.value = false
                        // Let the single Hands-Free effect start recognition. Starting here too
                        // can race with Compose and create duplicate/busy recognizer sessions.
                    }
                },
                onOpenReminders = {
                    productivityTab = ProductivityTab.REMINDERS
                    currentScreen = Screen.PRODUCTIVITY
                },
                onOpenTasks = {
                    productivityTab = ProductivityTab.TASKS
                    currentScreen = Screen.PRODUCTIVITY
                },
                onOpenTodo = {
                    productivityTab = ProductivityTab.TODO
                    currentScreen = Screen.PRODUCTIVITY
                },
                onOpenDialer = {
                    try {
                        startActivity(Intent(Intent.ACTION_DIAL))
                    } catch (_: Exception) {
                        Toast.makeText(this@MainActivity, "Phone dialer open nahi ho saka.", Toast.LENGTH_LONG).show()
                    }
                }
            )

            Screen.CHAT -> ChatScreen(
                messages = messages,
                language = currentLanguage,
                isListening = isListening,
                isSpeaking = isSpeaking,
                isHandsFreeEnabled = isHandsFreeEnabled,
                isProcessing = isProcessing,
                transcript = transcript,
                onSendMessage = {
                    handleSendMessage(it)
                },
                onMicClick = {
                    handleMicToggle()
                },
                onSpeakMessage = {
                    voiceManager.speak(it, currentLanguage)
                },
                onBack = {
                    currentScreen = Screen.HOME
                },
                initialPrompt = chatInitialPrompt,
                onInitialPromptConsumed = { chatInitialPrompt = null }
            )

            Screen.SMART_ADS -> SmartAdsManagerScreen(
                onBack = { currentScreen = Screen.MENU },
                onGeneratePlan = { platform, goal, budget, location, offer ->
                    val responseLanguage = if (currentLanguage == AssistantLanguage.HINGLISH) "natural Roman Hinglish" else "English"
                    val prompt = """
                        Create a practical advertising plan and ad draft for the user's business.
                        Platform: $platform
                        Main goal: $goal
                        Daily budget: ₹$budget
                        Target location: $location
                        Business/offer details: $offer
                        Return concise sections: recommended campaign objective, proposed audience/keywords,
                        3 headline options, 2 ad descriptions, CTA, likely benefits, risks, metrics to watch,
                        and checks needed before launch. Do not guarantee leads or sales. Do not claim account
                        data was accessed. Treat budget as proposal only. Do not publish anything.
                        User language: $responseLanguage.
                    """.trimIndent()
                    geminiClient.generateAngelResponse(prompt, emptyList(), currentLanguage)
                },
                onSpeak = { voiceManager.speak(it, currentLanguage) }
            )

            Screen.APPROVALS -> ApprovalScreen(
                items = approvalItems,
                onApprove = {
                    adsWorkflow.approveItem(it)
                },
                onReject = {
                    adsWorkflow.rejectItem(it)
                },
                onSimulate = {
                    adsWorkflow.runSimulatedDryRun(it)
                },
                onBack = {
                    currentScreen = Screen.MENU
                }
            )

            Screen.PRODUCTIVITY -> ProductivityScreen(
                initialTab = productivityTab,
                onBack = { currentScreen = Screen.MENU }
            )

            Screen.SETTINGS -> SettingsScreen(
                currentLanguage = currentLanguage,
                isWakeWordEnabled = isWakeWordEnabled,
                onToggleWakeWord = { enabled ->
                    if (enabled && ContextCompat.checkSelfPermission(
                            this@MainActivity, Manifest.permission.RECORD_AUDIO
                        ) != PackageManager.PERMISSION_GRANTED
                    ) {
                        checkAndRequestPermissions()
                        Toast.makeText(this@MainActivity, "Sir, microphone permission allow karke Wake-word dobara enable karein.", Toast.LENGTH_LONG).show()
                    } else {
                        isWakeWordEnabledState.value = enabled
                        getSharedPreferences("angel_voice", MODE_PRIVATE).edit()
                            .putBoolean("wake_word_enabled", enabled).apply()
                        if (enabled) {
                            try {
                                ContextCompat.startForegroundService(
                                    this@MainActivity,
                                    Intent(this@MainActivity, WakeWordService::class.java)
                                )
                                Toast.makeText(this@MainActivity, "Hey Jarvis Wake-word enabled. Background listening notification active rahegi.", Toast.LENGTH_LONG).show()
                            } catch (e: Exception) {
                                isWakeWordEnabledState.value = false
                                getSharedPreferences("angel_voice", MODE_PRIVATE).edit().putBoolean("wake_word_enabled", false).apply()
                                Toast.makeText(this@MainActivity, "Wake-word start nahi hua: ${e.message}", Toast.LENGTH_LONG).show()
                            }
                        } else {
                            stopService(Intent(this@MainActivity, WakeWordService::class.java))
                            Toast.makeText(this@MainActivity, "Wake-word disabled.", Toast.LENGTH_SHORT).show()
                        }
                    }
                },
                onSelectLanguage = {
                    currentLanguage = it
                },
                onTestVoice = {
                    val testPhrase =
                        if (currentLanguage == AssistantLanguage.ENGLISH) {
                            "Hello Sir! I am Angel, your personal AI assistant."
                        } else {
                            "Hello Sir! Main Angel hoon, aapki personal AI assistant. Aawaz bilkul natural hai!"
                        }

                    voiceManager.speak(
                        testPhrase,
                        currentLanguage
                    )
                },
                onBack = {
                    currentScreen = Screen.MENU
                }
            )
        }
    }

    override fun onStart() {
        super.onStart()
        isWakeWordEnabledState.value = getSharedPreferences("angel_voice", MODE_PRIVATE)
            .getBoolean("wake_word_enabled", false)
        val filter = IntentFilter(WakeWordService.ACTION_WAKEWORD_DETECTED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(wakeWordReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(wakeWordReceiver, filter)
        }
        if (isWakeWordEnabledState.value &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        ) {
            try {
                ContextCompat.startForegroundService(this, Intent(this, WakeWordService::class.java))
            } catch (e: Exception) {
                Toast.makeText(this, "Wake-word service restart nahi ho saka. Settings mein dobara enable karein.", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onStop() {
        try { unregisterReceiver(wakeWordReceiver) } catch (_: Exception) {}
        super.onStop()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(WakeWordService.EXTRA_START_LISTENING, false) &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        ) {
            wakeWordTriggeredState.value = true
        }
    }

    override fun onDestroy() {
        super.onDestroy()

        if (::voiceManager.isInitialized) {
            voiceManager.destroy()
        }
    }
}
