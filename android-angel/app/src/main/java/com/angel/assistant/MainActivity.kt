package com.angel.assistant

import android.Manifest
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
import com.angel.assistant.ui.SettingsScreen
import com.angel.assistant.ui.SmartAdsManagerScreen
import com.angel.assistant.voice.VoiceManager
import com.angel.assistant.workflow.GoogleAdsApprovalWorkflow
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

enum class Screen {
    HOME,
    MENU,
    CHAT,
    APPROVALS,
    SMART_ADS,
    SETTINGS
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

        voiceManager = VoiceManager(
            context = this,
            onTranscript = { text, isFinal ->
                runOnUiThread {
                    transcriptState.value = text
                    if (isFinal) isFinalTranscriptState.value = true
                }
            },
            onSpeakingStateChanged = { speaking ->
                runOnUiThread {
                    isSpeakingState.value = speaking
                }
            },
            onListeningStateChanged = { listening ->
                runOnUiThread {
                    isListeningState.value = listening
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

        val scope = rememberCoroutineScope()

        BackHandler(enabled = currentScreen != Screen.HOME) {
            currentScreen = when (currentScreen) {
                Screen.MENU -> Screen.HOME
                Screen.CHAT -> Screen.HOME
                Screen.SETTINGS, Screen.SMART_ADS, Screen.APPROVALS -> Screen.MENU
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

        fun handleSendMessage(userText: String) {
            if (userText.isBlank()) return

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
                val response = geminiClient.generateAngelResponse(
                    prompt = userText,
                    history = messages,
                    language = currentLanguage
                )

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
            if (isListening) {
                // Stop capture; final speech is submitted automatically on onResults.
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
                voiceManager.startListening(currentLanguage)
                isListeningState.value = true
            }
        }

        // Submit final voice results automatically; no second mic tap is required.
        LaunchedEffect(isFinalTranscript) {
            if (isFinalTranscript) {
                val spoken = transcriptState.value.trim()
                transcriptState.value = ""
                isFinalTranscriptState.value = false
                if (spoken.isNotBlank()) {
                    handleSendMessage(spoken)
                } else if (!isListeningState.value) {
                    Toast.makeText(
                        this@MainActivity,
                        "Sir, awaaz clear nahi mili. Mic dabakar dobara boliye.",
                        Toast.LENGTH_SHORT
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
                    handleMicToggle()
                }
            )

            Screen.CHAT -> ChatScreen(
                messages = messages,
                language = currentLanguage,
                isListening = isListening,
                isSpeaking = isSpeaking,
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
                }
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

            Screen.SETTINGS -> SettingsScreen(
                currentLanguage = currentLanguage,
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

    override fun onDestroy() {
        super.onDestroy()

        if (::voiceManager.isInitialized) {
            voiceManager.destroy()
        }
    }
}
