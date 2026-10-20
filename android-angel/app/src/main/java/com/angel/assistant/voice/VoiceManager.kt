package com.angel.assistant.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import com.angel.assistant.data.model.AssistantLanguage
import java.util.Locale

class VoiceManager(
    private val context: Context,
    private val onTranscript: (String, Boolean) -> Unit,
    private val onSpeakingStateChanged: (Boolean) -> Unit
) : TextToSpeech.OnInitListener {

    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null
    private var isTtsReady = false

    private var currentUtteranceId: String? = null

    companion object {
        private const val TAG = "VoiceManager"

        // Natural, conversational delivery.
        private const val NATURAL_SPEECH_RATE = 0.94f
        private const val NATURAL_PITCH = 1.03f
    }

    init {
        try {
            if (SpeechRecognizer.isRecognitionAvailable(context)) {
                speechRecognizer =
                    SpeechRecognizer.createSpeechRecognizer(context).apply {
                        setRecognitionListener(createRecognitionListener())
                    }
            }

            textToSpeech = TextToSpeech(
                context.applicationContext,
                this
            )
        } catch (e: Exception) {
            Log.e(TAG, "Initialization error: ${e.message}", e)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val tts = textToSpeech ?: return

            try {
                val localeResult = tts.setLanguage(Locale("en", "IN"))

                if (localeResult == TextToSpeech.LANG_MISSING_DATA ||
                    localeResult == TextToSpeech.LANG_NOT_SUPPORTED
                ) {
                    Log.w(TAG, "English India voice is unavailable")
                }

                // Prefer the best-quality installed English-India voice available
                // on this device. The actual voice catalog depends on Android TTS.
                val preferredVoice = tts.voices
                    ?.filter { it.locale.language == "en" && it.locale.country == "IN" }
                    ?.maxByOrNull { it.quality }

                if (preferredVoice != null) {
                    tts.voice = preferredVoice
                    Log.d(TAG, "Selected TTS voice: ${preferredVoice.name}, quality=${preferredVoice.quality}")
                }

                // A slightly slower rate and neutral pitch sound less rushed.
                tts.setSpeechRate(NATURAL_SPEECH_RATE)
                tts.setPitch(1.0f)

                tts.setOnUtteranceProgressListener(
                    object : UtteranceProgressListener() {

                        override fun onStart(utteranceId: String?) {
                            // Ignore callbacks from speech that was replaced by a newer response.
                            if (utteranceId != null && utteranceId == currentUtteranceId) {
                                onSpeakingStateChanged(true)
                            }
                        }

                        override fun onDone(utteranceId: String?) {
                            if (utteranceId != null && utteranceId == currentUtteranceId) {
                                currentUtteranceId = null
                                onSpeakingStateChanged(false)
                            }
                        }

                        @Deprecated("Deprecated in Java")
                        override fun onError(utteranceId: String?) {
                            if (utteranceId != null && utteranceId == currentUtteranceId) {
                                currentUtteranceId = null
                                onSpeakingStateChanged(false)
                            }
                        }

                        override fun onError(
                            utteranceId: String?,
                            errorCode: Int
                        ) {
                            Log.w(
                                TAG,
                                "TTS error for $utteranceId: $errorCode"
                            )
                            if (utteranceId != null && utteranceId == currentUtteranceId) {
                                currentUtteranceId = null
                                onSpeakingStateChanged(false)
                            }
                        }
                    }
                )

                isTtsReady = true

                Log.d(TAG, "TextToSpeech initialized successfully")
            } catch (e: Exception) {
                isTtsReady = false
                Log.e(TAG, "TTS setup error: ${e.message}", e)
            }
        } else {
            isTtsReady = false
            Log.w(TAG, "TextToSpeech initialization failed: $status")
        }
    }

    fun startListening(language: AssistantLanguage) {
        val recognizer = speechRecognizer ?: return

        val intent = Intent(
            RecognizerIntent.ACTION_RECOGNIZE_SPEECH
        ).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE,
                language.code
            )
            putExtra(
                RecognizerIntent.EXTRA_PARTIAL_RESULTS,
                true
            )
            putExtra(
                RecognizerIntent.EXTRA_MAX_RESULTS,
                3
            )
        }

        try {
            recognizer.startListening(intent)
        } catch (e: Exception) {
            Log.e(TAG, "startListening error: ${e.message}", e)
        }
    }

    fun stopListening() {
        try {
            speechRecognizer?.stopListening()
        } catch (e: Exception) {
            Log.e(TAG, "stopListening error: ${e.message}", e)
        }
    }

    /**
     * Speaks the response using the currently selected language.
     */
    fun speak(
        text: String,
        language: AssistantLanguage
    ) {
        if (!isTtsReady) {
            Log.w(TAG, "TTS is not ready yet")
            return
        }

        val tts = textToSpeech ?: return
        val cleanText = prepareTextForSpeech(text, language)

        if (cleanText.isBlank()) {
            onSpeakingStateChanged(false)
            return
        }

        try {
            // Roman Hinglish is written in Latin script. en-IN generally handles
            // mixed English/Roman-Hindi text more consistently than a Hindi Devanagari voice.
            val locale = Locale("en", "IN")

            val languageResult = tts.setLanguage(locale)

            if (languageResult == TextToSpeech.LANG_MISSING_DATA ||
                languageResult == TextToSpeech.LANG_NOT_SUPPORTED
            ) {
                Log.w(
                    TAG,
                    "Requested voice unavailable: $locale"
                )

                // Fall back to English India if the requested
                // language is not supported by the installed TTS.
                tts.setLanguage(Locale("en", "IN"))
            }

            // Keep delivery consistent when switching languages.
            tts.setSpeechRate(NATURAL_SPEECH_RATE)
            tts.setPitch(NATURAL_PITCH)

            val utteranceId =
                "angel_${System.currentTimeMillis()}"

            currentUtteranceId = utteranceId

            val params = Bundle().apply {
                putString(
                    TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID,
                    utteranceId
                )
            }

            val result = tts.speak(
                cleanText,
                TextToSpeech.QUEUE_FLUSH,
                params,
                utteranceId
            )

            if (result == TextToSpeech.ERROR) {
                Log.e(TAG, "TTS could not start speaking")
                onSpeakingStateChanged(false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Speech error: ${e.message}", e)
            onSpeakingStateChanged(false)
        }
    }

    /**
     * Cleans Markdown and converts common time expressions
     * into speech-friendly words without modifying displayed text.
     */
    private fun prepareTextForSpeech(
        text: String,
        language: AssistantLanguage
    ): String {
        var result = text

        // Remove fenced code blocks from spoken output.
        result = result.replace(
            Regex("```[\\s\\S]*?```"),
            " Code block omitted. "
        )

        // Replace Markdown links with their readable labels.
        result = result.replace(
            Regex("\\[([^\\]]+)]\\([^)]+\\)")
        ) { match ->
            match.groupValues[1]
        }

        // Remove URLs because reading each URL aloud is usually
        // confusing during a spoken conversation.
        result = result.replace(
            Regex("https?://\\S+|www\\.\\S+"),
            " "
        )

        // Remove Markdown syntax before sending text to Android TTS.
        // Convert headings to plain speech, including headings embedded mid-response.
        result = result.replace(Regex("(?m)^\\s{0,3}#{1,6}\\s*"), "")
        result = result.replace(Regex("(?m)^\\s*>+\\s?"), "")
        result = result.replace(Regex("(?m)^\\s*[-*_]{3,}\\s*$"), "")
        result = result.replace(Regex("\\*\\*(.*?)\\*\\*"), "$1")
        result = result.replace(Regex("__(.*?)__"), "$1")
        result = result.replace(Regex("(?<!\\*)\\*(?!\\*)(.*?)\\*(?!\\*)"), "$1")
        result = result.replace(Regex("(?<!_)_(?!_)(.*?)_(?!_)"), "$1")
        result = result.replace("`", "")
        result = result.replace("~", "")
        result = result.replace(Regex("#{1,6}\\s*"), "")
        result = result.replace(Regex("[|]+"), " ")
        result = result.replace(
            Regex("(?m)^\\s*[-+•]\\s*"),
            ""
        )
        result = result.replace(
            Regex("(?m)^\\s*\\d+[.)]\\s+"),
            ""
        )
        result = result.replace(
            Regex("[ \\t]*([.!?])"),
            "$1"
        )

        // Remove Markdown table separators and list markers.
        result = result.replace(
            Regex("(?m)^\\s*[-+•]\\s+"),
            ""
        )
        result = result.replace(
            Regex("(?m)^\\s*\\d+[.)]\\s+"),
            ""
        )
        result = result.replace(
            Regex("(?m)^\\s*\\|?\\s*:?-{3,}:?\\s*(\\|\\s*:?-{3,}:?\\s*)+\\|?\\s*$"),
            ""
        )

        // Make common clock times easier for TTS to pronounce.
        result = result.replace(
            Regex(
                "(?i)\\b(0?[1-9]|1[0-2]):([0-5][0-9])\\s*(AM|PM)\\b"
            )
        ) { match ->
            val hour = match.groupValues[1].toInt()
            val minute = match.groupValues[2].toInt()
            val period = match.groupValues[3].uppercase(Locale.ROOT)

            if (language == AssistantLanguage.HINGLISH) {
                hinglishTime(hour, minute, period)
            } else {
                englishTime(hour, minute, period)
            }
        }

        // Remove repeated whitespace while preserving sentence pauses.
        result = result
            .replace(Regex("[ \\t]+"), " ")
            .replace(Regex("\\n{3,}"), "\n\n")
            .trim()

        return result
    }

    private fun hinglishTime(
        hour: Int,
        minute: Int,
        period: String
    ): String {
        val hourWords = when (hour) {
            1 -> "ek"
            2 -> "do"
            3 -> "teen"
            4 -> "chaar"
            5 -> "paanch"
            6 -> "chhe"
            7 -> "saat"
            8 -> "aath"
            9 -> "nau"
            10 -> "das"
            11 -> "gyarah"
            12 -> "baarah"
            else -> hour.toString()
        }

        val timeWords = when (minute) {
            0 -> "$hourWords baje"
            15 -> "$hourWords bajkar pandrah minute"
            30 -> "$hourWords bajkar tees minute"
            45 -> "$hourWords bajkar paintaalis minute"
            else -> "$hourWords bajkar $minute minute"
        }

        val dayPart = when {
            period == "AM" && hour == 12 -> "raat"
            period == "AM" -> "subah"
            hour == 12 -> "dopahar"
            hour in 1..4 -> "dopahar"
            else -> "shaam"
        }

        val normalizedHourWords = if (hour == 12) "baarah" else hourWords
        val normalizedTimeWords = when (minute) {
            0 -> "$normalizedHourWords baje"
            15 -> "$normalizedHourWords bajkar pandrah minute"
            30 -> "$normalizedHourWords bajkar tees minute"
            45 -> "$normalizedHourWords bajkar paintaalis minute"
            else -> "$normalizedHourWords bajkar $minute minute"
        }

        return "$dayPart $normalizedTimeWords"
    }

    private fun englishTime(
        hour: Int,
        minute: Int,
        period: String
    ): String {
        val hourWords = hour.toString()
        val minuteWords = if (minute == 0) {
            ""
        } else {
            " $minute"
        }

        val dayPart = if (period == "AM") {
            "A M"
        } else {
            "P M"
        }

        return "$hourWords$minuteWords $dayPart"
    }

    private fun createRecognitionListener(): RecognitionListener {
        return object : RecognitionListener {

            override fun onReadyForSpeech(params: Bundle?) {}

            override fun onBeginningOfSpeech() {}

            override fun onRmsChanged(rmsdB: Float) {}

            override fun onBufferReceived(buffer: ByteArray?) {}

            override fun onEndOfSpeech() {}

            override fun onError(error: Int) {
                Log.w(TAG, "Recognition error code: $error")
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(
                    SpeechRecognizer.RESULTS_RECOGNITION
                )
                val text = matches?.firstOrNull() ?: ""
                onTranscript(text, true)
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(
                    SpeechRecognizer.RESULTS_RECOGNITION
                )
                val text = matches?.firstOrNull() ?: ""
                onTranscript(text, false)
            }

            override fun onEvent(
                eventType: Int,
                params: Bundle?
            ) {}
        }
    }

    fun destroy() {
        try {
            isTtsReady = false
            speechRecognizer?.destroy()
            speechRecognizer = null

            textToSpeech?.stop()
            textToSpeech?.shutdown()
            textToSpeech = null
        } catch (e: Exception) {
            Log.e(TAG, "Destroy error: ${e.message}", e)
        }
    }
}
