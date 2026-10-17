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

    init {
        try {
            if (SpeechRecognizer.isRecognitionAvailable(context)) {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
                    setRecognitionListener(createRecognitionListener())
                }
            }
            textToSpeech = TextToSpeech(context.applicationContext, this)
        } catch (e: Exception) {
            Log.e("VoiceManager", "Initialization error: ${e.message}", e)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isTtsReady = true
            textToSpeech?.language = Locale("en", "IN")
            textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    onSpeakingStateChanged(true)
                }

                override fun onDone(utteranceId: String?) {
                    onSpeakingStateChanged(false)
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    onSpeakingStateChanged(false)
                }
            })
        } else {
            Log.w("VoiceManager", "TextToSpeech init failed with status: $status")
        }
    }

    fun startListening(language: AssistantLanguage) {
        val recognizer = speechRecognizer ?: return
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language.code)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }
        try {
            recognizer.startListening(intent)
        } catch (e: Exception) {
            Log.e("VoiceManager", "startListening error: ${e.message}", e)
        }
    }

    fun stopListening() {
        try {
            speechRecognizer?.stopListening()
        } catch (e: Exception) {
            Log.e("VoiceManager", "stopListening error: ${e.message}", e)
        }
    }

    fun speak(text: String, language: AssistantLanguage) {
        if (!isTtsReady || textToSpeech == null) return
        val cleanText = text
            .replace(Regex("[#*`_]"), "")
            .replace(Regex("https?://\\S+"), "link")

        val locale = if (language == AssistantLanguage.HINGLISH) {
            Locale("hi", "IN")
        } else {
            Locale("en", "IN")
        }
        textToSpeech?.language = locale

        val params = Bundle().apply {
            putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "angel_utterance_${System.currentTimeMillis()}")
        }
        textToSpeech?.speak(cleanText, TextToSpeech.QUEUE_FLUSH, params, "angel_speech")
    }

    private fun createRecognitionListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onError(error: Int) {
                Log.w("VoiceManager", "Recognition error code: $error")
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: ""
                onTranscript(text, true)
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: ""
                onTranscript(text, false)
            }

            override fun onEvent(eventType: Int, params: Bundle?) {}
        }
    }

    fun destroy() {
        try {
            speechRecognizer?.destroy()
            textToSpeech?.stop()
            textToSpeech?.shutdown()
        } catch (e: Exception) {
            Log.e("VoiceManager", "destroy error: ${e.message}", e)
        }
    }
}
