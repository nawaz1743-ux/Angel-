package com.angel.assistant.voice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.angel.assistant.MainActivity
import com.angel.assistant.R
import com.openwakeword.OpenWakeWord

/**
 * On-device wake-word detector. The ongoing notification makes microphone use visible.
 * Built-in model is "Hey Jarvis"; the model itself is non-commercial licensed.
 */
class WakeWordService : Service() {
    private var detector: OpenWakeWord? = null
    private var stoppedByUser = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stoppedByUser = true
            getSharedPreferences("angel_voice", MODE_PRIVATE).edit()
                .putBoolean("wake_word_enabled", false).apply()
            stopDetector()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        try {
            startForeground(NOTIFICATION_ID, buildNotification("Listening for \"Hey Jarvis\" on this device"))
            if (detector == null) {
                detector = OpenWakeWord.Builder(applicationContext)
                    .setModel(OpenWakeWord.BuiltInModel.HEY_JARVIS)
                    .setThreshold(0.65f)
                    .setDebounceMs(2500L)
                    .build()
                detector?.start { score ->
                    Log.i(TAG, "Hey Jarvis detected, score=$score")
                    sendBroadcast(Intent(ACTION_WAKEWORD_DETECTED).setPackage(packageName))
                    val manager = getSystemService(NotificationManager::class.java)
                    manager.notify(NOTIFICATION_ID, buildNotification("Jarvis detected. Tap to open Angel and start speaking."))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Could not start wake-word detection", e)
            stopDetector()
            getSharedPreferences("angel_voice", MODE_PRIVATE).edit()
                .putBoolean("wake_word_enabled", false).apply()
            sendBroadcast(
                Intent(ACTION_WAKEWORD_ERROR)
                    .setPackage(packageName)
                    .putExtra(EXTRA_WAKEWORD_ERROR, e.message ?: "Unknown startup error")
            )
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
        return START_STICKY
    }

    private fun buildNotification(text: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_START_LISTENING, true)
        }
        val openPending = PendingIntent.getActivity(
            this, 100, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopPending = PendingIntent.getService(
            this, 101, Intent(this, WakeWordService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Angel Wake-word")
            .setContentText(text)
            .setContentIntent(openPending)
            .addAction(0, "Stop listening", stopPending)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Angel Wake-word", NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Visible notification for on-device wake-word listening" }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun stopDetector() {
        try { detector?.stop() } catch (_: Exception) {}
        try { detector?.release() } catch (_: Exception) {}
        detector = null
    }

    override fun onDestroy() {
        stopDetector()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val TAG = "AngelWakeWord"
        private const val CHANNEL_ID = "angel_wake_word"
        private const val NOTIFICATION_ID = 8217
        const val ACTION_WAKEWORD_DETECTED = "com.angel.assistant.WAKEWORD_DETECTED"
        const val ACTION_WAKEWORD_ERROR = "com.angel.assistant.WAKEWORD_ERROR"
        const val EXTRA_WAKEWORD_ERROR = "com.angel.assistant.WAKEWORD_ERROR_MESSAGE"
        const val EXTRA_START_LISTENING = "com.angel.assistant.START_LISTENING_AFTER_WAKE"
        const val ACTION_STOP = "com.angel.assistant.STOP_WAKEWORD"
    }
}
