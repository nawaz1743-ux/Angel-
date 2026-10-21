package com.angel.assistant.productivity

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.angel.assistant.MainActivity
import com.angel.assistant.R

class ReminderAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != ACTION_REMINDER) return
        val id = intent.getLongExtra(EXTRA_ID, System.currentTimeMillis())
        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "Angel reminder" }
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(NotificationChannel(
                CHANNEL_ID, "Angel reminders", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Scheduled reminders created in Angel"
                enableVibration(true)
            })
        }
        val openApp = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Angel Reminder")
            .setContentText(title)
            .setStyle(NotificationCompat.BigTextStyle().bigText(title))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(openApp)
            .build()
        manager.notify(id.hashCode(), notification)
        ProductivityStore.load(context).firstOrNull { it.id == id }?.let {
            ProductivityStore.update(context, it.copy(completed = true))
        }
    }

    companion object {
        const val ACTION_REMINDER = "com.angel.assistant.ACTION_REMINDER"
        const val EXTRA_ID = "reminder_id"
        const val EXTRA_TITLE = "reminder_title"
        const val CHANNEL_ID = "angel_reminders"
    }
}

class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            ProductivityStore.scheduleAllPendingReminders(context)
        }
    }
}
