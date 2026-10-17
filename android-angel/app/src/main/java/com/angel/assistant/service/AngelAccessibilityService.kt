package com.angel.assistant.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class AngelAccessibilityService : AccessibilityService() {

    companion object {
        var isServiceRunning: Boolean = false
            private set

        private var activeServiceInstance: AngelAccessibilityService? = null

        /**
         * Safely inspects visible text on the active foreground window.
         * Only returns data if the service is running and user requested screen assistance.
         */
        fun captureVisibleScreenText(): String {
            val service = activeServiceInstance ?: return "Accessibility Service is not enabled by user."
            val rootNode = service.rootInActiveWindow ?: return "No active window content accessible."
            val builder = StringBuilder()
            extractNodeTextRecursive(rootNode, builder, 0)
            return if (builder.isBlank()) "No readable text detected on screen." else builder.toString()
        }

        private fun extractNodeTextRecursive(node: AccessibilityNodeInfo?, out: StringBuilder, depth: Int) {
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
        Log.i("AngelAccessibility", "Angel Screen Understanding Accessibility Service connected.")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Passive observation only; no unsolicited or hidden gestures are executed.
        // User retains full manual control of their device at all times.
    }

    override fun onInterrupt() {
        Log.w("AngelAccessibility", "Angel Accessibility Service interrupted.")
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        activeServiceInstance = null
        Log.i("AngelAccessibility", "Angel Accessibility Service destroyed.")
    }
}
