package com.angel.assistant

import android.content.ActivityNotFoundException
import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.ContactsContract
import androidx.core.content.ContextCompat
import com.angel.assistant.service.AngelAccessibilityService
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * Small, explicit command router. It only runs recognizable device commands;
 * ordinary conversation continues to Gemini. It never performs payment actions.
 */
class ActionCommandRouter(private val context: Context) {

    private var pendingWhatsAppDraft = false
    private var pendingWhatsAppMessage: String? = null

    fun requiresContactLookup(rawCommand: String): Boolean =
        extractContactCallName(rawCommand) != null

    /** True only for explicit phone-call commands, not ordinary dialer preparation. */
    fun requiresCallPermission(rawCommand: String): Boolean {
        val command = rawCommand.trim()
        return extractContactCallName(command) != null ||
            Regex("""(?i)^call\s+number\s+\+?[0-9][0-9 ()-]{5,}$""").matches(command)
    }

    /**
     * Splits only explicit sequencing phrases. We intentionally do not split plain "and/aur",
     * because those words can be part of a message draft or a contact/app name.
     */
    fun parseMultiStepCommand(rawCommand: String): List<String>? {
        val parts = rawCommand.trim().split(
            Regex("""(?i)\s+(?:and\s+then|then|phir|aur\s+phir|uske\s+baad)\s+|\s*;\s*""")
        ).map { it.trim().trimEnd('.', ',') }.filter { it.isNotBlank() }
        if (parts.size < 2 || parts.size > 6) return null

        // Only sequence steps that this local action router can safely execute.
        val allowed = parts.all { step ->
            val n = step.lowercase()
            n.startsWith("open ") || n.startsWith("kholo ") || n.startsWith("launch ") ||
                n.startsWith("tap ") || n.startsWith("click ") || n.startsWith("press ") ||
                n.startsWith("button par tap karo ") || n.startsWith("button dabao ") ||
                n.startsWith("type ") || n.startsWith("enter text ") ||
                n.startsWith("text likho ") || n.startsWith("likho ") ||
                n in listOf("scroll down", "neeche scroll karo", "neeche scroll",
                    "scroll up", "upar scroll karo", "upar scroll",
                    "read screen", "screen padho", "screen padh kar sunao",
                    "what is on my screen", "hang up", "end call", "call drop karo",
                    "call kaat do", "phone kaat do", "disconnect call") ||
                requiresCallPermission(step) || n.startsWith("dial ") ||
                n.startsWith("number dial karo ") ||
                parseWhatsAppDraft(step) != null ||
                Regex("""(?i)^(?:whatsapp|whats app)\\s+(?:(?:voice|video)\\s+)?call\\s+(?:to\\s+)?\\+?[0-9][0-9 ()-]{6,}$""").matches(step)
        }
        if (!allowed) return null

        // A call is terminal in a sequence so later steps cannot accidentally act
        // on the live-call UI. Sending a message also remains a separate confirmation.
        val callIndexes = parts.indices.filter { index ->
            requiresCallPermission(parts[index]) ||
                Regex("""(?i)^(?:whatsapp|whats app)\\s+(?:(?:voice|video)\\s+)?call\\s+(?:to\\s+)?\\+?[0-9][0-9 ()-]{6,}$""").matches(parts[index])
        }
        if (callIndexes.any { it != parts.lastIndex }) return null
        if (parts.any { it.trim().lowercase() in listOf("send", "send it", "send karo", "bhej do", "confirm send") }) return null
        return parts
    }

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

        if (normalized in listOf("hang up", "end call", "call drop karo", "call kaat do", "phone kaat do", "disconnect call")) {
            return actionResult(
                AngelAccessibilityService.clickEndCallButton(),
                "Call end karne ka action diya.",
                "Active call ka End Call button nahi mila. Agar call screen par hain, phone ke visible end button ko dabaiye."
            )
        }

        val whatsappCall = Regex("""(?i)^(?:whatsapp|whats app)\s+(?:(voice|video)\s+)?call\s+(?:to\s+)?(\+?[0-9][0-9 ()-]{6,})$""")
            .find(command)
        if (whatsappCall != null) {
            val callType = whatsappCall.groupValues[1].lowercase()
            val digits = whatsappCall.groupValues[2].filter { it.isDigit() }
            if (digits.length < 8) return "Sir, country code ke saath WhatsApp contact number boliye."
            return try {
                context.startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$digits"))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
                val video = callType == "video"
                Handler(Looper.getMainLooper()).postDelayed({
                    AngelAccessibilityService.clickWhatsAppCallButton(video)
                }, 2200L)
                "WhatsApp contact khol rahi hoon. Agar sahi contact ki visible ${if (video) "Video Call" else "Voice Call"} button mil gayi, Angel call start karne ki koshish karegi."
            } catch (_: Exception) {
                "WhatsApp contact open nahi ho paya."
            }
        }

        val contactName = extractContactCallName(command)
        if (contactName != null) {
            return callContact(contactName)
        }

        val directCall = command.matchCommand(listOf("call number "))
        if (directCall != null) {
            val digits = directCall.filter { it.isDigit() || it == '+' }
            if (digits.length < 7) return "Sir, phone number clear nahi mila. Number dobara boliye."
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                return "Sir, direct phone call ke liye Phone permission allow karein, phir command dobara boliye."
            }
            return try {
                context.startActivity(
                    Intent(Intent.ACTION_CALL, Uri.parse("tel:$digits"))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
                "Phone call start kar di."
            } catch (_: SecurityException) {
                "Sir, phone-call permission nahi mili. Settings mein Angel ki Phone permission allow karein."
            } catch (_: ActivityNotFoundException) {
                "Is phone par call start nahi ho payi."
            }
        }

        val dial = command.matchCommand(listOf("dial ", "number dial karo "))
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
                pendingWhatsAppMessage = message
                "WhatsApp mein message draft khol diya. Sir, message check karke jab aap 'send' kahenge tabhi Angel Send button dabane ki koshish karegi."
            } catch (_: Exception) {
                "WhatsApp draft open nahi ho paya. WhatsApp installed hai aur number sahi hai, check karein."
            }
        }

        if (normalized in listOf("send", "send it", "bhej do", "haan send karo", "confirm send", "send karo")) {
            if (!pendingWhatsAppDraft) {
                return "Sir, koi pending WhatsApp draft nahi hai. Pehle message draft karwa lijiye."
            }
            val expectedMessage = pendingWhatsAppMessage ?: return "Sir, pending message text available nahi hai. Draft dobara banaiye."
            val sent = AngelAccessibilityService.clickWhatsAppSendButton(expectedMessage)
            if (sent) {
                pendingWhatsAppDraft = false
                pendingWhatsAppMessage = null
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

    private fun extractContactCallName(command: String): String? {
        val hindiOrder = Regex("""(?i)^(.+?)\s+ko\s+(?:call|phone)\s+karo$""").find(command.trim())
        if (hindiOrder != null) {
            val contact = hindiOrder.groupValues[1].trim()
            if (contact.isNotBlank()) return contact
        }
        val prefixes = listOf("call contact ", "dial contact ", "call karo ", "phone karo ", "call ")
        val prefix = prefixes.firstOrNull { command.startsWith(it, ignoreCase = true) } ?: return null
        val name = command.substring(prefix.length).trim()
            .replace(Regex("(?i)\\s+(ko call karo|ko phone karo|ko call|ko)$"), "")
            .trim()
        if (name.isBlank() || name.matches(Regex("[+0-9 ()-]+")) ||
            name.startsWith("number ", ignoreCase = true) ||
            name.startsWith("whatsapp ", ignoreCase = true)
        ) return null
        return name
    }

    private fun callContact(name: String): String {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            return "Sir, Contacts permission chahiye. Angel ki permission allow karke command dobara boliye."
        }
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER
        )
        val matches = mutableListOf<Pair<String, String>>()
        try {
            context.contentResolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                projection,
                "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?",
                arrayOf("%$name%"),
                "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
            )?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                val numberIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                while (cursor.moveToNext() && matches.size < 6) {
                    val contactName = cursor.getString(nameIndex).orEmpty()
                    val number = cursor.getString(numberIndex).orEmpty()
                    if (number.isNotBlank()) {
                        val pair = contactName to number
                        if (pair !in matches) matches.add(pair)
                    }
                }
            }
        } catch (_: SecurityException) {
            return "Contacts access allow nahi hua. Settings mein Angel ki Contacts permission check karein."
        } catch (_: Exception) {
            return "Contact search nahi ho paya. Contact app mein naam check karein."
        }

        if (matches.isEmpty()) return "Sir, '$name' naam ka contact nahi mila."
        if (matches.size > 1) {
            val choices = matches.take(5).joinToString("\n") { it.first + ": " + it.second }
            return "Sir, ek se zyada contacts mile. Kaunsa contact chahiye?\\n$choices"
        }
        val (contactName, number) = matches.first()
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            return "Sir, direct call ke liye Phone permission allow karein, phir '$contactName ko call karo' dobara boliye."
        }
        return try {
            context.startActivity(
                Intent(Intent.ACTION_CALL, Uri.parse("tel:${number.filter { it.isDigit() || it == '+' }}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
            "$contactName ko phone call start kar di."
        } catch (_: SecurityException) {
            "Sir, Phone permission allow nahi hui. Settings mein Angel ki Phone permission check karein."
        } catch (_: Exception) {
            "Phone call start nahi ho payi."
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
