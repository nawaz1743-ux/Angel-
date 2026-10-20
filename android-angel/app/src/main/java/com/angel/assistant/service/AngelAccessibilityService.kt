package com.angel.assistant.service

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * User-enabled, foreground-only interaction foundation for Angel.
 * Sensitive finance apps are excluded from both screen reading and actions.
 */
class AngelAccessibilityService : AccessibilityService() {

    companion object {
        var isServiceRunning: Boolean = false
            private set

        private var activeServiceInstance: AngelAccessibilityService? = null
        // Short-lived in-memory snapshot for explicit screen-reading requests.
        private var lastExternalPackage: String? = null
        private var lastExternalScreenText: String = ""
        private var lastExternalCapturedAtMillis: Long = 0L
        private const val SCREEN_SNAPSHOT_TTL_MS = 30_000L

        // High-risk screen content indicators. This deliberately errs on the side of
        // pausing interaction when an app exposes PIN, OTP, transfer or payment controls.
        private val sensitiveTextHints = listOf(
            "upi pin", "transaction pin", "payment pin", "enter pin", "enter your pin",
            "enter otp", "one time password", "verify otp", "collect request",
            "approve collect", "confirm transfer", "transfer amount", "pay now",
            "scan and pay", "scan to pay", "secure payment", "payment details",
            "net banking", "debit account", "credit account", "beneficiary account",
            "card number", "cvv", "bank account number", "confirm payment"
        )

        private val sensitivePackageHints = listOf(
            // UPI, wallets and payment apps
            "bank", "banking", "upi", "paytm", "phonepe", "phonpe",
            "google.android.apps.nbu.paisa", "gpay", "tez", "bhim",
            "cred", "mobikwik", "amazonpay", "payzapp", "yono",
            // Common Indian bank app package-name fragments
            "sbi", "lotus", "icici", "axis", "kotak", "hdfc", "pnb",
            "unionbank", "canara", "idbi", "indusind", "federal",
            "rbl", "yesbank", "mobank", "bankofbaroda", "bobworld"
        )

        private fun clearExternalSnapshot() {
            lastExternalPackage = null
            lastExternalScreenText = ""
            lastExternalCapturedAtMillis = 0L
        }

        private fun containsSensitiveFinanceText(text: String): Boolean {
            val normalized = text.lowercase()
            return sensitiveTextHints.any { hint -> normalized.contains(hint) }
        }

        private fun isSensitiveFinanceScreen(service: AngelAccessibilityService): Boolean {
            val root = service.rootInActiveWindow
            val packageName = root?.packageName?.toString()?.lowercase().orEmpty()
            // Angel's own chat may discuss finance safety; only classify its foreground
            // window by package here, not by the words in Angel's conversation.
            if (packageName == service.packageName.lowercase()) return false
            // Fail closed if Android does not expose the foreground package.
            if (packageName.isBlank() ||
                sensitivePackageHints.any { hint -> packageName.contains(hint) }
            ) return true

            if (root != null) {
                val builder = StringBuilder()
                extractNodeTextRecursive(root, builder, 0)
                if (containsSensitiveFinanceText(builder.toString())) {
                    clearExternalSnapshot()
                    return true
                }
            }
            return false
        }

        /**
         * Reads visible text only when explicitly requested and not on a recognized
         * banking/UPI screen. This is a best-effort safety filter, not a security boundary.
         */
        fun captureVisibleScreenText(): String {
            val service = activeServiceInstance
                ?: return "Accessibility Service is not enabled by user."
            if (isSensitiveFinanceScreen(service)) {
                return "Screen reading paused for a banking or payment app."
            }
            val rootNode = service.rootInActiveWindow
            val activePackage = rootNode?.packageName?.toString().orEmpty()
            // Returning to Angel changes the active window, so use the transient
            // snapshot from the last external app only when explicitly requested.
            if (activePackage == service.packageName && lastExternalScreenText.isNotBlank()) {
                val age = System.currentTimeMillis() - lastExternalCapturedAtMillis
                if (age in 0..SCREEN_SNAPSHOT_TTL_MS &&
                    !containsSensitiveFinanceText(lastExternalScreenText)
                ) {
                    return "Previous app: " + (lastExternalPackage ?: "unknown") + "\n" + lastExternalScreenText
                }
                clearExternalSnapshot()
                return "Previous screen text expired or was blocked for finance safety. Open the app again and request screen reading."
            }
            if (rootNode == null) return "No active window content accessible."
            val builder = StringBuilder()
            extractNodeTextRecursive(rootNode, builder, 0)
            return if (builder.isBlank()) "No readable text detected on screen." else builder.toString()
        }

        /** Scrolls the current app's first available scrollable container. */
        fun scroll(forward: Boolean = true): Boolean {
            val service = activeServiceInstance ?: return false
            if (isSensitiveFinanceScreen(service)) return false
            val root = service.rootInActiveWindow ?: return false
            return findScrollableNode(root)?.let { node ->
                val action = if (forward) {
                    AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
                } else {
                    AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
                }
                node.performAction(action)
            } ?: false
        }

        /** Clicks a visible node whose text or content description matches the user's target. */
        fun clickVisibleTarget(target: String): Boolean {
            val service = activeServiceInstance ?: return false
            if (target.isBlank() || isSensitiveFinanceScreen(service)) return false
            // Never let a generic voice tap target payment/transfer controls.
            val blockedTarget = Regex(
                """\b(pay|payment|upi|transfer money|send money|bank transfer|confirm payment|approve payment)\b""",
                RegexOption.IGNORE_CASE
            )
            if (blockedTarget.containsMatchIn(target)) return false
            val root = service.rootInActiveWindow ?: return false
            // Prefer an exact label match before considering a partial match. This
            // reduces accidental clicks when several controls contain similar wording.
            val normalizedTarget = target.trim().lowercase()
            val node = findExactMatchingNode(root, normalizedTarget)
                ?: findMatchingNode(root, normalizedTarget)
                ?: return false
            var clickable: AccessibilityNodeInfo? = node
            while (clickable != null && !clickable.isClickable) {
                clickable = clickable.parent
            }
            return clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
        }

        /**
         * Sends only after a separate user confirmation, only when a pending WhatsApp
         * draft exists in the caller, and only while the foreground package is WhatsApp.
         */
        fun clickWhatsAppSendButton(expectedMessage: String): Boolean {
            val service = activeServiceInstance ?: return false
            val root = service.rootInActiveWindow ?: return false
            val packageName = root.packageName?.toString().orEmpty()
            if (packageName != "com.whatsapp" && packageName != "com.whatsapp.w4b") return false
            if (isSensitiveFinanceScreen(service) || expectedMessage.isBlank()) return false

            // Require the current WhatsApp composer to contain the exact pending draft.
            val focusedInput = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
            if (!focusedInput.isEditable ||
                focusedInput.text?.toString()?.trim() != expectedMessage.trim()
            ) return false

            val sendNode = findExactTextNode(root, setOf("send", "send message"))
                ?: return false
            var clickable: AccessibilityNodeInfo? = sendNode
            while (clickable != null && !clickable.isClickable) {
                clickable = clickable.parent
            }
            return clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
        }

        /**
         * Starts a WhatsApp call only by clicking an exact, visible call control in WhatsApp.
         * It never clicks a generic screen coordinate or a button in another app.
         */
        fun clickWhatsAppCallButton(video: Boolean): Boolean {
            val service = activeServiceInstance ?: return false
            val root = service.rootInActiveWindow ?: return false
            val packageName = root.packageName?.toString().orEmpty()
            if (packageName != "com.whatsapp" && packageName != "com.whatsapp.w4b") return false
            if (isSensitiveFinanceScreen(service)) return false
            // WhatsApp versions/locales may expose these controls as content descriptions
            // rather than visible text. Match only call-specific labels, never a generic icon.
            val targets = if (video) {
                setOf("video call", "start video call", "video call button", "make video call")
            } else {
                setOf("voice call", "start voice call", "voice call button", "make voice call", "audio call")
            }
            val callNode = findExactTextNode(root, targets)
                ?: findCallControlNode(root, video)
                ?: return false
            var clickable: AccessibilityNodeInfo? = callNode
            while (clickable != null && !clickable.isClickable) {
                clickable = clickable.parent
            }
            return clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
        }


        private fun findCallControlNode(
            node: AccessibilityNodeInfo?,
            video: Boolean
        ): AccessibilityNodeInfo? {
            if (node == null) return null
            val label = listOf(
                node.text?.toString().orEmpty(),
                node.contentDescription?.toString().orEmpty(),
                node.viewIdResourceName.orEmpty()
            ).joinToString(" ").lowercase()
            val hasCall = label.contains("call") || label.contains("phone")
            val hasVideo = label.contains("video") || label.contains("camera")
            val hasVoice = label.contains("voice") || label.contains("audio") || label.contains("phone")
            val matches = hasCall && if (video) hasVideo else (hasVoice && !hasVideo)
            if (matches && (node.isClickable || node.parent?.isClickable == true)) return node
            for (i in 0 until node.childCount) {
                val found = findCallControlNode(node.getChild(i), video)
                if (found != null) return found
            }
            return null
        }

        /** Ends an active call only through the visible call UI after a spoken command. */
        fun clickEndCallButton(): Boolean {
            val service = activeServiceInstance ?: return false
            val root = service.rootInActiveWindow ?: return false
            val packageName = root.packageName?.toString().orEmpty()
            val allowedCallPackages = setOf(
                "com.whatsapp",
                "com.whatsapp.w4b",
                "com.samsung.android.dialer",
                "com.google.android.dialer",
                "com.android.phone"
            )
            if (packageName !in allowedCallPackages || isSensitiveFinanceScreen(service)) return false
            val endNode = findExactTextNode(
                root,
                setOf("end call", "hang up", "disconnect", "end voice call", "end video call")
            ) ?: return false
            var clickable: AccessibilityNodeInfo? = endNode
            while (clickable != null && !clickable.isClickable) {
                clickable = clickable.parent
            }
            return clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
        }

        private fun findExactTextNode(
            node: AccessibilityNodeInfo?,
            targets: Set<String>
        ): AccessibilityNodeInfo? {
            if (node == null) return null
            val text = node.text?.toString()?.trim()?.lowercase().orEmpty()
            val description = node.contentDescription?.toString()?.trim()?.lowercase().orEmpty()
            if (text in targets || description in targets) return node
            for (i in 0 until node.childCount) {
                val found = findExactTextNode(node.getChild(i), targets)
                if (found != null) return found
            }
            return null
        }

        /**
         * Writes text only into the currently focused editable field. It never submits
         * a form or presses Send; the user must separately confirm sending.
         */
        fun typeIntoFocusedField(text: String): Boolean {
            val service = activeServiceInstance ?: return false
            if (text.isEmpty() || isSensitiveFinanceScreen(service)) return false
            val root = service.rootInActiveWindow ?: return false
            val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
            if (!focused.isEditable) return false
            val args = Bundle().apply {
                putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    text
                )
            }
            return focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        }

        private fun findScrollableNode(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
            if (node == null || !node.isVisibleToUser) return null
            // Prefer the focused scroll area when an app exposes one, then the first
            // visible scrollable container. Never issue a coordinate-based gesture.
            if (node.isScrollable && node.isFocused) return node
            for (i in 0 until node.childCount) {
                val found = findScrollableNode(node.getChild(i))
                if (found != null && found.isFocused) return found
            }
            if (node.isScrollable) return node
            for (i in 0 until node.childCount) {
                val found = findScrollableNode(node.getChild(i))
                if (found != null) return found
            }
            return null
        }

        private fun findExactMatchingNode(
            node: AccessibilityNodeInfo?,
            target: String
        ): AccessibilityNodeInfo? {
            if (node == null || !node.isVisibleToUser) return null
            val text = node.text?.toString()?.trim()?.lowercase().orEmpty()
            val description = node.contentDescription?.toString()?.trim()?.lowercase().orEmpty()
            if (text == target || description == target) return node
            for (i in 0 until node.childCount) {
                val found = findExactMatchingNode(node.getChild(i), target)
                if (found != null) return found
            }
            return null
        }

        private fun findMatchingNode(
            node: AccessibilityNodeInfo?,
            target: String
        ): AccessibilityNodeInfo? {
            if (node == null || !node.isVisibleToUser) return null
            val text = node.text?.toString()?.lowercase().orEmpty()
            val description = node.contentDescription?.toString()?.lowercase().orEmpty()
            if (text == target || description == target ||
                (target.length >= 3 && (text.contains(target) || description.contains(target)))
            ) return node

            for (i in 0 until node.childCount) {
                val found = findMatchingNode(node.getChild(i), target)
                if (found != null) return found
            }
            return null
        }

        private fun extractNodeTextRecursive(
            node: AccessibilityNodeInfo?,
            out: StringBuilder,
            depth: Int
        ) {
            if (node == null || depth > 10 || !node.isVisibleToUser) return
            val text = node.text?.toString()?.trim()
            val contentDesc = node.contentDescription?.toString()?.trim()
            if (!text.isNullOrEmpty()) {
                out.appendLine("• $text")
            } else if (!contentDesc.isNullOrEmpty()) {
                out.appendLine("• [Icon: $contentDesc]")
            }
            for (i in 0 until node.childCount) {
                extractNodeTextRecursive(node.getChild(i), out, depth + 1)
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isServiceRunning = true
        activeServiceInstance = this
        Log.i("AngelAccessibility", "Angel foreground interaction foundation connected.")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Screen events never trigger actions. Keep a short-lived text snapshot so
        // the user can return to Angel and explicitly request "read screen".
        val eventPackage = event?.packageName?.toString()?.lowercase().orEmpty()
        if (eventPackage.isBlank()) return
        if (sensitivePackageHints.any { eventPackage.contains(it) }) {
            clearExternalSnapshot()
            return
        }
        if (eventPackage == packageName.lowercase()) return
        // Never carry one app's text into a different external app.
        if (lastExternalPackage != null && lastExternalPackage != eventPackage) {
            clearExternalSnapshot()
        }
        val root = rootInActiveWindow ?: return
        if (root.packageName?.toString()?.lowercase() != eventPackage) return
        val builder = StringBuilder()
        extractNodeTextRecursive(root, builder, 0)
        val snapshot = builder.toString().trim()
        // Some payment flows run inside browsers or non-bank apps. Detect strong
        // sensitive-screen text markers before caching any content from that window.
        if (containsSensitiveFinanceText(snapshot)) {
            clearExternalSnapshot()
            return
        }
        if (snapshot.isNotBlank()) {
            lastExternalPackage = eventPackage
            lastExternalScreenText = snapshot.take(12000)
            lastExternalCapturedAtMillis = System.currentTimeMillis()
        }
    }

    override fun onInterrupt() {
        Log.w("AngelAccessibility", "Angel Accessibility Service interrupted.")
    }

    override fun onDestroy() {
        isServiceRunning = false
        if (activeServiceInstance === this) activeServiceInstance = null
        clearExternalSnapshot()
        super.onDestroy()
        Log.i("AngelAccessibility", "Angel Accessibility Service destroyed.")
    }
}
