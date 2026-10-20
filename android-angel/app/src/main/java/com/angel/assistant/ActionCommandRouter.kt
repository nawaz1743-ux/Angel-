package com.angel.assistant

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.angel.assistant.service.AngelAccessibilityService
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * Small, explicit command router. It only runs recognizable device commands;
 * ordinary conversation continues to Gemini. It never performs payment actions.
 */
class ActionCommandRouter(private val context: Context) {

    private var pendingWhatsAppDraft = false

    fun handle(rawCommand: String): String? {
        val command = rawCommand.trim()
        val normalized = command.lowercase()

        // Finance/payment screens are never controlled by voice actions.
        if (normalized.contains("pay") || normalized.contains("payment") ||
            normalized.contains("upi") || normalized.contains("banking") ||
            normalized.contains("transfer money") || normalized.contains("send money")) {
            if (normalized.startsWith("open ") || normalized.startsWith("tap ") ||
                normalized.startsWith("click ") || normalized.startsWith("type ") ||
                normalized.startsWith("scroll ") || normalized.startsWith("read screen")) {
                return "Sir, banking aur payment screens par Angel actions nahi karegi. Aap khud control karein."
            }
        }

        if (normalized in listOf("scroll down", "neeche scroll karo", "neeche scroll")) {
            return actionResult(AngelAccessibilityService.scroll(true), "Screen neeche scroll ho gayi.", "Scroll nahi ho paya. Accessibility Service enabled hai ya nahi check karein.")
        }
        if (normalized in listOf("scroll up", "upar scroll karo", "upar scroll")) {
            return actionResult(AngelAccessibilityService.scroll(false), "Screen upar scroll ho gayi.", "Scroll nahi ho paya. Accessibility Service enabled hai ya nahi check karein.")
        }

        if (normalized in listOf("read screen", "screen padho", "screen padh kar sunao", "what is on my screen")) {
            return AngelAccessibilityService.captureVisibleScreenText().also {
                if (it.isNotBlank()) Unit
            }
        }

        val tapTarget = command.matchCommand(
            listOf("tap ", "click ", "press ", "button par tap karo ", "button dabao ")
        )
        if (tapTarget != null && tapTarget.isNotBlank()) {
            return actionResult(
                AngelAccessibilityService.clickVisibleTarget(tapTarget),
                "$tapTarget par tap kar diya.",
                "$tapTarget button nahi mila ya action allowed nahi tha."
            )
        }

        val typeText = command.matchCommand(listOf("type ", "enter text ", "text likho ", "likho "))
        if (typeText != null && typeText.isNotBlank()) {
            return actionResult(
                AngelAccessibilityService.typeIntoFocusedField(typeText),
                "Text field mein text bhar diya. Maine Send ya Submit nahi dabaya.",
                "Text nahi bhar payi. Pehle app mein text field select karein."
            )
        }

        if (normalized.startsWith("open ") || normalized.startsWith("kholo ") ||
            normalized.startsWith("launch ")) {
            val appName = command.substringAfter(' ').trim()
            return openApp(appName)
        }

        val dial = command.matchCommand(listOf("dial ", "number dial karo ", "call number "))
        if (dial != null) {
            val digits = dial.filter { it.isDigit() || it == '+' }
            if (digits.length < 5) return "Sir, number clear nahi mila. Number dobara boliye."
            return try {
                context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                "Dialer khol diya hai. Number check karke aap khud Call button dabaiye."
            } catch (_: ActivityNotFoundException) {
                "Is phone par dialer open nahi ho paya."
            }
        }

        val whatsappDraft = parseWhatsAppDraft(command)
        if (whatsappDraft != null) {
            val (number, message) = whatsappDraft
            val digits = number.filter { it.isDigit() }
            if (digits.length < 8 || message.isBlank()) {
                return "Sir, WhatsApp draft ke liye country code ke saath phone number aur message chahiye."
            }
            val encoded = URLEncoder.encode(message, StandardCharsets.UTF_8.name())
            return try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$digits?text=$encoded"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                pendingWhatsAppDraft = true
                "WhatsApp mein message draft khol diya. Sir, message check karke jab aap 'send' kahenge tabhi Angel Send button dabane ki koshish karegi."
            } catch (_: Exception) {
                "WhatsApp draft open nahi ho paya. WhatsApp installed hai aur number sahi hai, check karein."
            }
        }

        if (normalized in listOf("send", "send it", "bhej do", "haan send karo", "confirm send", "send karo")) {
            if (!pendingWhatsAppDraft) {
                return "Sir, koi pending WhatsApp draft nahi hai. Pehle message draft karwa lijiye."
            }
            val sent = AngelAccessibilityService.clickWhatsAppSendButton()
            if (sent) {
                pendingWhatsAppDraft = false
                return "WhatsApp ka Send button dabaya gaya. Agar app ne message accept kiya hai to message chala gaya hoga."
            }
            return "Sir, WhatsApp ka Send button nahi dabaya. Confirm karein ki WhatsApp draft screen khuli hai; agar button nazar nahi aa raha to aap khud send karein."
        }

        return null
    }

    private fun openApp(name: String): String {
        val normalized = name.lowercase().trim()
        val apps = mapOf(
            "whatsapp" to "com.whatsapp",
            "whats app" to "com.whatsapp",
            "chrome" to "com.android.chrome",
            "google chrome" to "com.android.chrome",
            "youtube" to "com.google.android.youtube",
            "settings" to "com.android.settings",
            "setting" to "com.android.settings",
            "maps" to "com.google.android.apps.maps",
            "google maps" to "com.google.android.apps.maps",
            "gmail" to "com.google.android.gm",
            "play store" to "com.android.vending",
            "google ads" to "com.google.android.apps.adwords",
            "camera" to "com.sec.android.app.camera",
            "phone" to "com.samsung.android.dialer",
            "dialer" to "com.samsung.android.dialer"
        )
        val packageName = apps[normalized]
            ?: return "Sir, abhi '$name' ke liye app shortcut configured nahi hai. Aap app manually open kar sakte hain."

        val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
            ?: return "$name is phone par installed nahi hai ya launchable nahi hai."
        return try {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(launchIntent)
            "$name open kar diya."
        } catch (_: Exception) {
            "$name open nahi ho paya."
        }
    }

    private fun parseWhatsAppDraft(command: String): Pair<String, String>? {
        val regex = Regex(
            """(?i)^(?:draft\s+)?(?:whatsapp|whats app)\s+(?:message\s+)?to\s+(\+?[0-9][0-9 ()-]{6,})\s+(?:saying|message|text)\s+(.+)$"""
        )
        val match = regex.find(command.trim()) ?: return null
        return match.groupValues[1].trim() to match.groupValues[2].trim()
    }

    private fun String.matchCommand(prefixes: List<String>): String? {
        val prefix = prefixes.firstOrNull { startsWith(it, ignoreCase = true) } ?: return null
        return substring(prefix.length).trim()
    }

    private fun actionResult(success: Boolean, ok: String, fail: String) = if (success) ok else fail
}
