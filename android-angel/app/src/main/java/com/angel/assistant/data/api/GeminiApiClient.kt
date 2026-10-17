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

class GeminiApiClient {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun generateAngelResponse(
        prompt: String,
        history: List<ChatMessage>,
        language: AssistantLanguage
    ): String = withContext(Dispatchers.IO) {
        val apiKey = BuildConfig.GEMINI_API_KEY.trim()
        if (apiKey.isBlank() || apiKey == "YOUR_GEMINI_API_KEY_HERE") {
            return@withContext getLocalFallbackResponse(prompt, language)
        }

        try {
            val endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey"
            val systemText = if (language == AssistantLanguage.HINGLISH) {
                "You are Angel, a polite, smart, and caring personal AI assistant for Samsung Galaxy S26 Ultra. " +
                "Language requirement: You MUST reply in Hinglish using Roman script only (do not use Devanagari script). " +
                "Address the user politely as Sir when appropriate. Keep answers concise, clear, and mobile-friendly."
            } else {
                "You are Angel, a polite, smart, and caring personal AI assistant for Samsung Galaxy S26 Ultra. " +
                "Reply in natural, polite English. Keep answers concise, clear, and mobile-friendly."
            }

            val contentsArray = JSONArray()
            val recentHistory = history.takeLast(6)
            for (msg in recentHistory) {
                val role = if (msg.isFromUser) "user" else "model"
                contentsArray.put(
                    JSONObject().apply {
                        put("role", role)
                        put("parts", JSONArray().put(JSONObject().put("text", msg.text)))
                    }
                )
            }
            contentsArray.put(
                JSONObject().apply {
                    put("role", "user")
                    put("parts", JSONArray().put(JSONObject().put("text", prompt)))
                }
            )

            val rootJson = JSONObject().apply {
                put("contents", contentsArray)
                put("systemInstruction", JSONObject().apply {
                    put("parts", JSONArray().put(JSONObject().put("text", systemText)))
                })
            }

            val request = Request.Builder()
                .url(endpoint)
                .post(rootJson.toString().toRequestBody("application/json".toMediaType()))
                .build()

            val response = httpClient.newCall(request).execute()
            val responseBody = response.body?.string()

            if (response.isSuccessful && !responseBody.isNullOrBlank()) {
                val json = JSONObject(responseBody)
                val candidateText = json
                    .optJSONArray("candidates")
                    ?.optJSONObject(0)
                    ?.optJSONObject("content")
                    ?.optJSONArray("parts")
                    ?.optJSONObject(0)
                    ?.optString("text")

                if (!candidateText.isNullOrBlank()) {
                    return@withContext candidateText.trim()
                }
            }
            return@withContext getLocalFallbackResponse(prompt, language)
        } catch (e: Exception) {
            Log.e("GeminiApiClient", "Gemini API error: ${e.message}", e)
            return@withContext getLocalFallbackResponse(prompt, language)
        }
    }

    private fun getLocalFallbackResponse(prompt: String, language: AssistantLanguage): String {
        val lower = prompt.lowercase().trim()
        val isEng = language == AssistantLanguage.ENGLISH

        return when {
            lower.contains("time") || lower.contains("samay") || lower.contains("kitne baje") -> {
                val now = java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault()).format(java.util.Date())
                if (isEng) "The current time is $now." else "Abhi time hua hai $now."
            }
            lower.contains("date") || lower.contains("tarikh") || lower.contains("aaj ka din") -> {
                val today = java.text.SimpleDateFormat("EEEE, dd MMMM yyyy", java.util.Locale.getDefault()).format(java.util.Date())
                if (isEng) "Today is $today." else "Aaj $today hai."
            }
            lower.contains("kya kar sakti") || lower.contains("what can you do") || lower.contains("features") -> {
                if (isEng) {
                    "Hello Sir! I am Angel, your personal AI assistant. I can help you with daily planning, task management, WhatsApp messages, reminders, screen understanding, and Google Ads review."
                } else {
                    "Hello Sir! Main Angel hoon, aapki personal AI assistant. Main daily planning, tasks, WhatsApp messages, reminders, screen understanding, aur Google Ads review mein aapki madad kar sakti hoon."
                }
            }
            else -> {
                if (isEng) {
                    "I am here to assist you Sir! Your request has been noted. You can ask me to draft messages, plan tasks, or review marketing campaigns."
                } else {
                    "Main aapki madad ke liye taiyar hoon Sir! Aap mujhe message draft karne, daily tasks plan karne, ya marketing campaigns review karne ke liye keh sakte hain."
                }
            }
        }
    }
}
