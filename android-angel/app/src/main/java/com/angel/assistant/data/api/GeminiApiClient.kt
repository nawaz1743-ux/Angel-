package com.angel.assistant.data.api

import android.util.Log
import com.angel.assistant.BuildConfig
import com.angel.assistant.data.model.AssistantLanguage
import com.angel.assistant.data.model.ChatMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Sends chat requests to Angel's HTTPS server. The Gemini provider key is kept
 * only in the server's secret environment and is never included in this APK.
 */
class GeminiApiClient {

    @Volatile
    var lastUsedModel: String? = null
        private set

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(50, TimeUnit.SECONDS)
        .callTimeout(60, TimeUnit.SECONDS)
        .build()

    suspend fun generateAngelResponse(
        prompt: String,
        history: List<ChatMessage>,
        language: AssistantLanguage
    ): String = withContext(Dispatchers.IO) {
        lastUsedModel = null

        val baseUrl = BuildConfig.ANGEL_AI_API_BASE_URL.trim().trimEnd('/')
        if (baseUrl.isBlank()) {
            return@withContext localMessage(
                language,
                "Sir, Angel ka secure AI server abhi configure nahi hai. Server deployment complete hone ke baad AI chat chalegi.",
                "Sir, Angel's secure AI server is not configured yet. AI chat will work after the server is deployed."
            )
        }
        if (!baseUrl.startsWith("https://", ignoreCase = true)) {
            return@withContext localMessage(
                language,
                "Sir, Angel ke AI server ke liye secure HTTPS address configure karna zaroori hai.",
                "Sir, Angel's AI server must be configured with a secure HTTPS address."
            )
        }

        val historyWithoutCurrentPrompt = if (
            history.lastOrNull()?.isFromUser == true &&
            history.lastOrNull()?.text?.trim() == prompt.trim()
        ) history.dropLast(1) else history

        val historyArray = JSONArray()
        historyWithoutCurrentPrompt
            .takeLast(8)
            .filter { it.text.isNotBlank() }
            .forEach { message ->
                historyArray.put(
                    JSONObject()
                        .put("role", if (message.isFromUser) "user" else "model")
                        .put("text", message.text)
                )
            }

        val requestJson = JSONObject()
            .put("prompt", prompt)
            .put("history", historyArray)
            .put("language", if (language == AssistantLanguage.HINGLISH) "hinglish" else "english")

        val request = Request.Builder()
            .url("$baseUrl/v1/angel/chat")
            .header("Content-Type", "application/json")
            .post(
                requestJson.toString().toRequestBody(
                    "application/json; charset=utf-8".toMediaType()
                )
            )
            .build()

        try {
            httpClient.newCall(request).execute().use { response ->
                val responseBody = response.body?.string().orEmpty()
                val body = try {
                    JSONObject(responseBody)
                } catch (_: Exception) {
                    JSONObject()
                }

                if (response.isSuccessful) {
                    val answer = body.optString("text").trim()
                    if (answer.isNotBlank()) {
                        lastUsedModel = body.optString("model").takeIf { it.isNotBlank() }
                        return@withContext answer
                    }
                    return@withContext localMessage(
                        language,
                        "Sir, Angel ke secure AI server se khaali response mila. Thodi der baad try karein.",
                        "Sir, Angel's secure AI server returned an empty response. Please try again shortly."
                    )
                }

                Log.w("GeminiApiClient", "Secure AI server returned HTTP ${response.code}")
                when (response.code) {
                    429 -> localMessage(
                        language,
                        "Sir, Angel ki AI request limit ya Gemini quota abhi reach ho gayi hai. Thodi der baad try karein.",
                        "Sir, Angel's AI request limit or Gemini quota has been reached. Please try again later."
                    )
                    503 -> localMessage(
                        language,
                        "Sir, Angel ka secure AI server abhi configure ya available nahi hai.",
                        "Sir, Angel's secure AI server is not configured or is temporarily unavailable."
                    )
                    else -> localMessage(
                        language,
                        "Sir, Angel ki AI service se connection mein problem aayi. HTTP ${response.code}. Baad mein try karein.",
                        "Sir, Angel could not connect to its AI service. HTTP ${response.code}. Please try again later."
                    )
                }
            }
        } catch (e: Exception) {
            Log.w("GeminiApiClient", "Secure AI server request failed: ${e.javaClass.simpleName}")
            localMessage(
                language,
                "Sir, Angel ke secure AI server se connection nahi ho paaya. Internet aur server connection check karein.",
                "Sir, Angel could not connect to its secure AI server. Please check the internet and server connection."
            )
        }
    }

    private fun localMessage(
        language: AssistantLanguage,
        hinglish: String,
        english: String
    ): String {
        return if (language == AssistantLanguage.ENGLISH) english else hinglish
    }
}
