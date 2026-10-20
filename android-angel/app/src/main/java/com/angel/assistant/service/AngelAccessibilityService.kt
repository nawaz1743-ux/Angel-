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

        private fun isSensitiveFinanceScreen(service: AngelAccessibilityService): Boolean {
            val packageName = service.rootInActiveWindow?.packageName
                ?.toString()?.lowercase().orEmpty()
            // Fail closed if Android does not expose the foreground package.
            return packageName.isBlank() ||
                sensitivePackageHints.any { hint -> packageName.contains(hint) }
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
                ?: return "No active window content accessible."
            val builder = StringBuilder()
            extractNodeTextRecursive(rootNode, builder, 0)
            return if (builder.isBlank()) {
                "No readable text detected on screen."
            } else {
                builder.toString()
            }
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
            return findMatchingNode(root, target.trim().lowercase())?.let { node ->
                var clickable: AccessibilityNodeInfo? = node
                while (clickable != null && !clickable.isClickable) {
                    clickable = clickable.parent
                }
                clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false
            } ?: false
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
            if (node == null) return null
            if (node.isScrollable) return node
            for (i in 0 until node.childCount) {
                val found = findScrollableNode(node.getChild(i))
                if (found != null) return found
            }
            return null
        }

        private fun findMatchingNode(
            node: AccessibilityNodeInfo?,
            target: String
        ): AccessibilityNodeInfo? {
            if (node == null) return null
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
            if (node == null || depth > 10) return
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
        // No automatic actions are triggered by screen events.
    }

    override fun onInterrupt() {
        Log.w("AngelAccessibility", "Angel Accessibility Service interrupted.")
    }

    override fun onDestroy() {
        isServiceRunning = false
        if (activeServiceInstance === this) activeServiceInstance = null
        super.onDestroy()
        Log.i("AngelAccessibility", "Angel Accessibility Service destroyed.")
    }
}
