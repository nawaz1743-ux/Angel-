package com.angel.assistant

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
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
import com.angel.assistant.voice.VoiceManager
import com.angel.assistant.workflow.GoogleAdsApprovalWorkflow
import kotlinx.coroutines.launch

enum class Screen {
    HOME,
    MENU,
    CHAT,
    APPROVALS,
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
                transcriptState.value = text
            },
            onSpeakingStateChanged = { speaking ->
                runOnUiThread {
                    isSpeakingState.value = speaking
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

        fun handleSendMessage(userText: String) {
            if (userText.isBlank()) return

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
                        provider = if (
                            BuildConfig.GEMINI_API_KEY.isNotBlank() &&
                            BuildConfig.GEMINI_API_KEY !=
                            "YOUR_GEMINI_API_KEY_HERE"
                        ) {
                            "Gemini 2.5 Flash"
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
                voiceManager.stopListening()
                isListeningState.value = false

                val spoken = transcript.trim()

                if (spoken.isNotBlank()) {
                    handleSendMessage(spoken)
                    transcriptState.value = ""
                }
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
                voiceManager.startListening(currentLanguage)
                isListeningState.value = true
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
                onBack = {
                    currentScreen = Screen.HOME
                },
                onOpenChat = {
                    currentScreen = Screen.CHAT
                },
                onOpenApprovals = {
                    currentScreen = Screen.APPROVALS
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
