package com.angel.assistant.productivity

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicLong

enum class ProductivityKind { REMINDER, TASK, TODO }

data class ProductivityItem(
    val id: Long,
    val title: String,
    val kind: ProductivityKind,
    val dueAtMillis: Long? = null,
    val completed: Boolean = false
)

object ProductivityStore {
    private const val PREFS = "angel_productivity"
    private const val ITEMS_KEY = "items"
    private val idCounter = AtomicLong(System.currentTimeMillis())

    fun load(context: Context): List<ProductivityItem> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(ITEMS_KEY, "[]") ?: "[]"
        return try {
            val array = JSONArray(raw)
            buildList {
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val due = if (obj.isNull("dueAtMillis")) null else obj.optLong("dueAtMillis")
                    add(ProductivityItem(
                        id = obj.optLong("id", idCounter.incrementAndGet()),
                        title = obj.optString("title"),
                        kind = runCatching { ProductivityKind.valueOf(obj.optString("kind")) }
                            .getOrDefault(ProductivityKind.TODO),
                        dueAtMillis = due,
                        completed = obj.optBoolean("completed", false)
                    ))
                }
            }
        } catch (_: Exception) { emptyList() }
    }

    fun save(context: Context, items: List<ProductivityItem>) {
        val array = JSONArray()
        items.forEach { item ->
            array.put(JSONObject().apply {
                put("id", item.id)
                put("title", item.title)
                put("kind", item.kind.name)
                put("dueAtMillis", item.dueAtMillis ?: JSONObject.NULL)
                put("completed", item.completed)
            })
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(ITEMS_KEY, array.toString()).apply()
    }

    fun create(context: Context, title: String, kind: ProductivityKind, dueAtMillis: Long? = null): ProductivityItem {
        val item = ProductivityItem(idCounter.incrementAndGet(), title.trim(), kind, dueAtMillis)
        val items = load(context).toMutableList()
        items.add(0, item)
        save(context, items)
        if (kind == ProductivityKind.REMINDER && dueAtMillis != null && dueAtMillis > System.currentTimeMillis()) {
            scheduleReminder(context, item)
        }
        return item
    }

    fun update(context: Context, item: ProductivityItem) {
        val items = load(context).toMutableList()
        val index = items.indexOfFirst { it.id == item.id }
        if (index >= 0) items[index] = item
        save(context, items)
        if (item.kind == ProductivityKind.REMINDER) {
            if (item.completed || item.dueAtMillis == null) cancelReminder(context, item.id)
            else if (item.dueAtMillis > System.currentTimeMillis()) scheduleReminder(context, item)
        }
    }

    fun delete(context: Context, item: ProductivityItem) {
        save(context, load(context).filterNot { it.id == item.id })
        if (item.kind == ProductivityKind.REMINDER) cancelReminder(context, item.id)
    }

    fun scheduleAllPendingReminders(context: Context) {
        load(context).filter {
            it.kind == ProductivityKind.REMINDER && !it.completed &&
                it.dueAtMillis != null && it.dueAtMillis > System.currentTimeMillis()
        }.forEach { scheduleReminder(context, it) }
    }

    private fun scheduleReminder(context: Context, item: ProductivityItem) {
        val due = item.dueAtMillis ?: return
        val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ReminderAlarmReceiver::class.java).apply {
            action = ReminderAlarmReceiver.ACTION_REMINDER
            putExtra(ReminderAlarmReceiver.EXTRA_ID, item.id)
            putExtra(ReminderAlarmReceiver.EXTRA_TITLE, item.title)
        }
        val pending = PendingIntent.getBroadcast(
            context, item.id.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && manager.canScheduleExactAlarms()) {
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, due, pending)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, due, pending)
        } else {
            manager.setExact(AlarmManager.RTC_WAKEUP, due, pending)
        }
    }

    private fun cancelReminder(context: Context, id: Long) {
        val intent = Intent(context, ReminderAlarmReceiver::class.java).apply {
            action = ReminderAlarmReceiver.ACTION_REMINDER
        }
        val pending = PendingIntent.getBroadcast(
            context, id.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pending)
        pending.cancel()
    }
}
