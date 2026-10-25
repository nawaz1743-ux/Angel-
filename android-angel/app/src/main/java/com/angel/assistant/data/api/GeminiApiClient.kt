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
 * Calls Angel's HTTPS backend. Gemini credentials must only exist on the server,
 * never inside the Android APK.
 */
class GeminiApiClient {

    @Volatile
    var lastUsedModel: String? = null
        private set

    private val httpClient = OkHttpClient.Builder()
        .retryOnConnectionFailure(false)
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(35, TimeUnit.SECONDS)
        .callTimeout(40, TimeUnit.SECONDS)
        .build()

    suspend fun generateAngelResponse(
        prompt: String,
        history: List<ChatMessage>,
        language: AssistantLanguage
    ): String = withContext(Dispatchers.IO) {
        lastUsedModel = null

        val baseUrl = BuildConfig.ANGEL_API_BASE_URL.trim().trimEnd('/')
        if (!baseUrl.startsWith("https://")) {
            return@withContext localMessage(
                language,
                "Angel ka secure HTTPS server abhi configure nahi hai. Server deployment verify karna hoga.",
                "Angel's secure HTTPS server is not configured yet. The server deployment must be verified."
            )
        }
        if (prompt.isBlank()) {
            return@withContext localMessage(language, "Sir, message khaali hai.", "Sir, the message is empty.")
        }

        try {
            val historyWithoutCurrentPrompt = if (
                history.lastOrNull()?.isFromUser == true &&
                history.lastOrNull()?.text?.trim() == prompt.trim()
            ) history.dropLast(1) else history

            val historyArray = JSONArray()
            historyWithoutCurrentPrompt
                .filter { it.text.isNotBlank() }
                .takeLast(10)
                .forEach { msg ->
                    historyArray.put(JSONObject().apply {
                        put("role", if (msg.isFromUser) "user" else "assistant")
                        put("text", msg.text.take(8000))
                    })
                }

            val requestJson = JSONObject().apply {
                put("message", prompt.take(8000))
                put("history", historyArray)
                put("language", if (language == AssistantLanguage.ENGLISH) "english" else "hinglish")
                put("providerPriority", "gemini-first")
                put("allowPaidUsage", false)
            }

            val request = Request.Builder()
                .url("$baseUrl/api/chat")
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .post(requestJson.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()

            httpClient.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    Log.w("GeminiApiClient", "Angel backend returned HTTP ${response.code}")
                    return@withContext localMessage(
                        language,
                        "Sir, Angel ke secure server se connection mein problem hai (HTTP ${response.code}). Thodi der baad try karein.",
                        "Sir, Angel's secure server returned HTTP ${response.code}. Please try again shortly."
                    )
                }

                if (body.isBlank()) {
                    return@withContext localMessage(
                        language,
                        "Sir, secure server se khaali response mila. Dobara try karein.",
                        "Sir, the secure server returned an empty response. Please try again."
                    )
                }

                val json = JSONObject(body)
                val answer = json.optString("reply").trim()
                if (answer.isBlank()) {
                    return@withContext localMessage(
                        language,
                        "Sir, Angel ko server se usable jawab nahi mila. Dobara try karein.",
                        "Sir, Angel did not receive a usable answer from the server. Please try again."
                    )
                }
                lastUsedModel = json.optString("provider").takeIf { it.isNotBlank() }
                Log.i("GeminiApiClient", "Secure backend response provider=${lastUsedModel ?: "unknown"}")
                answer
            }
        } catch (e: Exception) {
            Log.w("GeminiApiClient", "Secure backend request failed: ${e.javaClass.simpleName}")
            localMessage(
                language,
                "Sir, Angel ke secure server tak connection nahi ho paaya. Internet aur server status check karke dobara try karein.",
                "Sir, Angel could not connect to the secure server. Check the internet connection and server status, then try again."
            )
        }
    }

    suspend fun generateAngelResponseStreaming(
        prompt: String,
        history: List<ChatMessage>,
        language: AssistantLanguage,
        onPartial: (String) -> Unit
    ): String = withContext(Dispatchers.IO) {
        lastUsedModel = null
        val baseUrl = BuildConfig.ANGEL_API_BASE_URL.trim().trimEnd('/')
        if (!baseUrl.startsWith("https://")) {
            return@withContext localMessage(language,
                "Angel ka secure HTTPS server configure nahi hai.",
                "Angel's secure HTTPS server is not configured.")
        }
        try {
            val safeHistory = if (history.lastOrNull()?.isFromUser == true &&
                history.lastOrNull()?.text?.trim() == prompt.trim()) history.dropLast(1) else history
            val historyArray = JSONArray()
            safeHistory.filter { it.text.isNotBlank() }.takeLast(10).forEach { msg ->
                historyArray.put(JSONObject().apply {
                    put("role", if (msg.isFromUser) "user" else "assistant")
                    put("text", msg.text.take(8000))
                })
            }
            val payload = JSONObject().apply {
                put("message", prompt.take(8000))
                put("history", historyArray)
                put("language", if (language == AssistantLanguage.ENGLISH) "english" else "hinglish")
                put("providerPriority", "gemini-first")
                put("allowPaidUsage", false)
            }
            val request = Request.Builder()
                .url("$baseUrl/api/chat/stream")
                .header("Accept", "application/x-ndjson")
                .header("Content-Type", "application/json")
                .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    Log.w("GeminiApiClient", "Streaming endpoint HTTP ${response.code}")
                    return@withContext localMessage(language,
                        "Sir, AI server se response nahi mila (HTTP ${response.code}).",
                        "Sir, the AI server returned HTTP ${response.code}.")
                }
                val reader = response.body?.charStream()?.buffered() ?: return@withContext localMessage(
                    language, "Sir, server response khaali hai.", "Sir, the server response was empty.")
                val full = StringBuilder()
                while (true) {
                    val line = reader.readLine() ?: break
                    if (line.isBlank()) continue
                    val event = try { JSONObject(line) } catch (_: Exception) { continue }
                    when (event.optString("type")) {
                        "chunk" -> {
                            val piece = event.optString("text")
                            if (piece.isNotEmpty()) {
                                full.append(piece)
                                val partial = full.toString()
                                withContext(Dispatchers.Main) { onPartial(partial) }
                            }
                        }
                        "done" -> lastUsedModel = event.optString("provider").takeIf { it.isNotBlank() }
                        "error" -> if (full.isEmpty()) full.append(event.optString("message"))
                    }
                }
                if (full.isEmpty()) localMessage(language,
                    "Sir, AI se jawab nahi mila. Thodi der baad try karein.",
                    "Sir, no AI response was received. Please try again shortly.")
                else full.toString().trim()
            }
        } catch (e: Exception) {
            Log.w("GeminiApiClient", "Streaming request failed: ${e.javaClass.simpleName}")
            localMessage(language,
                "Sir, AI server connection mein problem hui. Dobara try karein.",
                "Sir, the AI server connection failed. Please try again.")
        }
    }

    private fun localMessage(
        language: AssistantLanguage,
        hinglish: String,
        english: String
    ): String = if (language == AssistantLanguage.ENGLISH) english else hinglish
}
