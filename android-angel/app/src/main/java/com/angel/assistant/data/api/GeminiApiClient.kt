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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

class GeminiApiClient {

    @Volatile
    var lastUsedModel: String? = null
        private set

    private val httpClient = OkHttpClient.Builder()
        .retryOnConnectionFailure(false)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .callTimeout(35, TimeUnit.SECONDS)
        .build()

    // Use exactly one Gemini model. No model fallback requests.
    private val freeModelPriority = listOf("gemini-3.5-flash-lite")

    suspend fun generateAngelResponse(
        prompt: String,
        history: List<ChatMessage>,
        language: AssistantLanguage
    ): String = withContext(Dispatchers.IO) {

        lastUsedModel = null
        val apiKey = BuildConfig.GEMINI_API_KEY.trim()

        if (
            apiKey.isBlank() ||
            apiKey == "YOUR_GEMINI_API_KEY_HERE"
        ) {
            return@withContext localMessage(
                language,
                "Angel ki Gemini API key configure nahi hai. API key setup check karna hoga.",
                "Angel's Gemini API key is not configured. Please check the API key setup."
            )
        }

        val systemText = if (
            language == AssistantLanguage.HINGLISH
        ) {
            """
            You are Angel, a helpful, intelligent, polite and caring personal AI assistant.

            LANGUAGE RULES:
            - Reply in natural Hinglish using Roman letters only.
            - Never write Hindi in Devanagari script.
            - If the user writes in English, reply in natural English.
            - Address the user politely as Sir when appropriate.

            RESPONSE RULES:
            - Understand the user's actual question before answering.
            - Give useful, specific and accurate answers.
            - Do not repeat generic responses for unrelated questions.
            - Admit uncertainty instead of inventing facts.
            - Follow the conversation context provided to you.
            - Keep answers clear and suitable for a mobile screen.
            - Do not claim that you performed a phone action unless a tool
              actually performed that action.
            """.trimIndent()
        } else {
            """
            You are Angel, a helpful, intelligent, polite and caring personal AI assistant.

            Reply in natural English.
            Understand the actual question and give useful, specific answers.
            Use conversation context when relevant.
            Do not invent facts or claim to have performed actions you did not perform.
            Keep answers clear and suitable for a mobile screen.
            """.trimIndent()
        }

        val contentsArray = JSONArray()

        // Keep recent conversation context.
        // Gemini expects alternating user/model messages.
        // MainActivity already appended the current prompt to history.
        // Remove that final user entry because prompt is added separately below.
        val historyWithoutCurrentPrompt = if (
            history.lastOrNull()?.isFromUser == true &&
            history.lastOrNull()?.text?.trim() == prompt.trim()
        ) history.dropLast(1) else history

        val recentHistory = historyWithoutCurrentPrompt
            .takeLast(8)
            .filter { it.text.isNotBlank() }

        for (msg in recentHistory) {
            contentsArray.put(
                JSONObject().apply {
                    put(
                        "role",
                        if (msg.isFromUser) "user" else "model"
                    )
                    put(
                        "parts",
                        JSONArray().put(
                            JSONObject().put("text", msg.text)
                        )
                    )
                }
            )
        }

        contentsArray.put(
            JSONObject().apply {
                put("role", "user")
                put(
                    "parts",
                    JSONArray().put(
                        JSONObject().put("text", prompt)
                    )
                )
            }
        )

        val requestJson = JSONObject().apply {
            put("contents", contentsArray)

            put(
                "systemInstruction",
                JSONObject().apply {
                    put(
                        "parts",
                        JSONArray().put(
                            JSONObject().put("text", systemText)
                        )
                    )
                }
            )

            put(
                "generationConfig",
                JSONObject().apply {
                    put("temperature", 0.7)
                    put("maxOutputTokens", 2048)
                }
            )
        }

        var lastErrorMessage = ""
        var quotaOrTemporaryFailureSeen = false

        val totalStartNanos = System.nanoTime()

        for (model in freeModelPriority) { // The list intentionally contains one model only.

            val modelStartNanos = System.nanoTime()
            try {
                val endpoint =
                    "https://generativelanguage.googleapis.com/v1beta/models/" +
                    "$model:generateContent"

                val request = Request.Builder()
                    .url(endpoint)
                    .addHeader("x-goog-api-key", apiKey)
                    .addHeader(
                        "Content-Type",
                        "application/json"
                    )
                    .post(
                        requestJson.toString().toRequestBody(
                            "application/json; charset=utf-8".toMediaType()
                        )
                    )
                    .build()

                httpClient.newCall(request).execute().use { response ->

                    val responseBody = response.body?.string().orEmpty()

                    if (response.isSuccessful) {

                        if (responseBody.isBlank()) {
                            lastErrorMessage =
                                "$model returned an empty response."
                            Log.w(
                                "GeminiApiClient",
                                lastErrorMessage
                            )
                            return@use
                        }

                        val json = JSONObject(responseBody)

                        val candidates = json.optJSONArray("candidates")
                        val firstCandidate =
                            candidates?.optJSONObject(0)

                        val parts = firstCandidate
                            ?.optJSONObject("content")
                            ?.optJSONArray("parts")

                        val textBuilder = StringBuilder()

                        if (parts != null) {
                            for (i in 0 until parts.length()) {
                                val part = parts.optJSONObject(i)
                                val partText = part?.optString("text")
                                    .orEmpty()

                                if (partText.isNotBlank()) {
                                    if (textBuilder.isNotEmpty()) {
                                        textBuilder.append("\n")
                                    }
                                    textBuilder.append(partText)
                                }
                            }
                        }

                        val answer = textBuilder.toString().trim()

                        if (answer.isNotBlank()) {
                            lastUsedModel = model
                            val modelElapsedMs = TimeUnit.NANOSECONDS.toMillis(
                                System.nanoTime() - modelStartNanos
                            )
                            val totalElapsedMs = TimeUnit.NANOSECONDS.toMillis(
                                System.nanoTime() - totalStartNanos
                            )
                            Log.i(
                                "GeminiApiClient",
                                "Response generated using $model; model=" + modelElapsedMs +
                                    "ms; total=" + totalElapsedMs + "ms"
                            )
                            return@withContext answer
                        }

                        val finishReason =
                            firstCandidate?.optString("finishReason")
                                .orEmpty()

                        lastErrorMessage =
                            if (finishReason == "SAFETY") {
                                "The model blocked this response for safety."
                            } else {
                                "The model returned no text. Reason: $finishReason"
                            }

                        Log.w(
                            "GeminiApiClient",
                            "$model: $lastErrorMessage"
                        )
                    } else {

                        val errorJson = try {
                            JSONObject(responseBody)
                        } catch (_: Exception) {
                            JSONObject()
                        }

                        val apiError = errorJson
                            .optJSONObject("error")

                        val apiMessage = apiError
                            ?.optString("message")
                            .orEmpty()

                        val apiStatus = apiError
                            ?.optString("status")
                            .orEmpty()

                        lastErrorMessage =
                            "$model returned HTTP ${response.code}: " +
                            (apiMessage.ifBlank { apiStatus })

                        Log.w(
                            "GeminiApiClient",
                            lastErrorMessage
                        )

                        when (response.code) {

                            429 -> {
                                quotaOrTemporaryFailureSeen = true
                                // Single-model mode: do not send another model request.
                            }

                            500, 502, 503, 504 -> {
                                quotaOrTemporaryFailureSeen = true
                                // No fallback model is configured; finish this single attempt.
                            }

                            404 -> {
                                // Model unavailable or not found.
                                // Try the next configured model.
                            }

                            403 -> {
                                val lowerMessage =
                                    apiMessage.lowercase(Locale.ROOT)

                                if (
                                    lowerMessage.contains("quota") ||
                                    lowerMessage.contains("rate limit") ||
                                    lowerMessage.contains("resource exhausted")
                                ) {
                                    quotaOrTemporaryFailureSeen = true
                                    // Single-model mode: do not retry with another model.
                                } else {
                                    // May be an API key or permission problem.
                                    return@withContext localMessage(
                                        language,
                                        "Gemini API access deny ho gaya hai. API key aur project permissions check karni hongi.",
                                        "Gemini API access was denied. Please check the API key and project permissions."
                                    )
                                }
                            }

                            400 -> {
                                // Usually an invalid request or unsupported
                                // request configuration. Retrying every model
                                // with the same invalid request will not help.
                                return@withContext localMessage(
                                    language,
                                    "Angel ka API request accept nahi hua. Request configuration check karni hogi.",
                                    "Angel's API request was rejected. The request configuration needs to be checked."
                                )
                            }

                            401 -> {
                                return@withContext localMessage(
                                    language,
                                    "Gemini API key invalid ya unauthorized hai. API key configuration check karein.",
                                    "The Gemini API key is invalid or unauthorized. Please check the API key configuration."
                                )
                            }

                            else -> {
                                // Don't assume every error means quota ended.
                                return@withContext localMessage(
                                    language,
                                    "Gemini API mein problem aayi hai. HTTP ${response.code}. Thodi der baad dobara try karein.",
                                    "The Gemini API returned an error. HTTP ${response.code}. Please try again later."
                                )
                            }
                        }
                    }
                }

            } catch (e: Exception) {
                lastErrorMessage =
                    "${e.javaClass.simpleName}: ${e.message.orEmpty()}"

                val modelElapsedMs = TimeUnit.NANOSECONDS.toMillis(
                    System.nanoTime() - modelStartNanos
                )
                Log.w(
                    "GeminiApiClient",
                    "$model request failed after " + modelElapsedMs + "ms: " + lastErrorMessage
                )

                // Single-model mode: record the failure without retrying another model.
                quotaOrTemporaryFailureSeen = true
            }
        }

        // Every configured free model attempt failed.
        val totalElapsedMs = TimeUnit.NANOSECONDS.toMillis(
            System.nanoTime() - totalStartNanos
        )
        Log.w("GeminiApiClient", "Gemini 3.5 Flash-Lite request failed; total=" + totalElapsedMs + "ms")
        if (quotaOrTemporaryFailureSeen) {
            localMessage(
                language,
                "Sir, Gemini 3.5 Flash-Lite abhi jawab nahi de paaya. Free quota limit ya temporary service/network problem ho sakti hai. Kuch der baad dobara try karein. Angel ne doosre model ko request nahi bheji.",
                "Sir, Gemini 3.5 Flash-Lite could not respond right now. The free quota may be exhausted, or there may be a temporary service or network problem. Please try again later. Angel did not send a request to another model."
            )
        } else {
            localMessage(
                language,
                "Angel abhi AI response generate nahi kar paayi. Error: $lastErrorMessage",
                "Angel could not generate an AI response. Error: $lastErrorMessage"
            )
        }
    }

    private fun localMessage(
        language: AssistantLanguage,
        hinglish: String,
        english: String
    ): String {
        return if (language == AssistantLanguage.ENGLISH) {
            english
        } else {
            hinglish
        }
    }

    /*
     * Small offline responses for simple local questions.
     * These are not presented as AI-generated answers.
     */
    private fun getLocalFallbackResponse(
        prompt: String,
        language: AssistantLanguage
    ): String {
        val lower = prompt.lowercase(Locale.ROOT).trim()
        val isEnglish = language == AssistantLanguage.ENGLISH

        return when {
            lower.contains("time") ||
                lower.contains("samay") ||
                lower.contains("kitne baje") -> {

                val now = SimpleDateFormat(
                    "hh:mm a",
                    Locale.getDefault()
                ).format(Date())

                if (isEnglish) {
                    "The current phone time is $now."
                } else {
                    "Sir, phone ka current time $now hai."
                }
            }

            lower.contains("date") ||
                lower.contains("tarikh") ||
                lower.contains("aaj ka din") -> {

                val today = SimpleDateFormat(
                    "EEEE, dd MMMM yyyy",
                    Locale.getDefault()
                ).format(Date())

                if (isEnglish) {
                    "Today's date is $today."
                } else {
                    "Sir, aaj ki date $today hai."
                }
            }

            else -> {
                if (isEnglish) {
                    "Angel's AI service is unavailable right now. I cannot answer this question without the AI service."
                } else {
                    "Sir, Angel ki AI service abhi available nahi hai. AI service ke bina main is sawaal ka sahi jawab nahi de sakti."
                }
            }
        }
    }
}
