package com.angel.assistant.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.text.format.DateFormat
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.angel.assistant.productivity.ProductivityItem
import com.angel.assistant.productivity.ProductivityKind
import com.angel.assistant.productivity.ProductivityStore
import com.angel.assistant.theme.Slate100
import com.angel.assistant.theme.Slate400
import com.angel.assistant.theme.Slate800
import com.angel.assistant.theme.Slate900
import com.angel.assistant.theme.Slate950
import com.angel.assistant.theme.VioletPrimary
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

enum class ProductivityTab { REMINDERS, TASKS, TODO }

@Composable
fun ProductivityScreen(initialTab: ProductivityTab, onBack: () -> Unit) {
    val context = LocalContext.current
    val entries = remember { mutableStateListOf<ProductivityItem>().apply { addAll(ProductivityStore.load(context)) } }
    var title by remember { mutableStateOf("") }
    var dueAt by remember { mutableStateOf(System.currentTimeMillis() + 60 * 60 * 1000L) }
    var selectedTab by remember { mutableStateOf(initialTab) }
    var statusMessage by remember { mutableStateOf("") }

    fun refresh() {
        entries.clear()
        entries.addAll(ProductivityStore.load(context))
    }
    fun chooseDate() {
        val cal = Calendar.getInstance().apply { timeInMillis = dueAt }
        DatePickerDialog(context, { _, year, month, day ->
            dueAt = Calendar.getInstance().apply {
                timeInMillis = dueAt
                set(Calendar.YEAR, year); set(Calendar.MONTH, month); set(Calendar.DAY_OF_MONTH, day)
            }.timeInMillis
        }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
    }
    fun chooseTime() {
        val cal = Calendar.getInstance().apply { timeInMillis = dueAt }
        TimePickerDialog(context, { _, hour, minute ->
            dueAt = Calendar.getInstance().apply {
                timeInMillis = dueAt
                set(Calendar.HOUR_OF_DAY, hour); set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            }.timeInMillis
        }, cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE), DateFormat.is24HourFormat(context)).show()
    }

    val visible = entries.filter { item ->
        when (selectedTab) {
            ProductivityTab.REMINDERS -> item.kind == ProductivityKind.REMINDER
            ProductivityTab.TASKS -> item.kind == ProductivityKind.TASK
            ProductivityTab.TODO -> item.kind == ProductivityKind.TODO
        }
    }

    Column(Modifier.fillMaxSize().background(Slate950).padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(when (selectedTab) {
                ProductivityTab.REMINDERS -> "Reminders & Alarms"
                ProductivityTab.TASKS -> "Task Manager"
                ProductivityTab.TODO -> "To-do List"
            }, color = Slate100, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Button(onClick = onBack, colors = ButtonDefaults.buttonColors(containerColor = Slate800)) { Text("Back") }
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            TabButton("Reminders", selectedTab == ProductivityTab.REMINDERS, Modifier.weight(1f)) { selectedTab = ProductivityTab.REMINDERS }
            TabButton("Tasks", selectedTab == ProductivityTab.TASKS, Modifier.weight(1f)) { selectedTab = ProductivityTab.TASKS }
            TabButton("To-do", selectedTab == ProductivityTab.TODO, Modifier.weight(1f)) { selectedTab = ProductivityTab.TODO }
        }
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = title, onValueChange = { title = it }, modifier = Modifier.fillMaxWidth(),
            label = { Text(when (selectedTab) {
                ProductivityTab.REMINDERS -> "Reminder title"
                ProductivityTab.TASKS -> "Task name"
                ProductivityTab.TODO -> "To-do item"
            }) }, singleLine = true
        )
        if (selectedTab == ProductivityTab.REMINDERS) {
            Spacer(Modifier.height(8.dp))
            Text("Scheduled: " + SimpleDateFormat("EEE, dd MMM yyyy • hh:mm a", Locale.getDefault()).format(Date(dueAt)), color = Slate400, fontSize = 12.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = ::chooseDate, modifier = Modifier.weight(1f)) { Text("Pick date") }
                Button(onClick = ::chooseTime, modifier = Modifier.weight(1f)) { Text("Pick time") }
            }
        }
        Spacer(Modifier.height(8.dp))
        Button(onClick = {
            val clean = title.trim()
            if (clean.isBlank()) statusMessage = "Please enter a title first."
            else {
                val kind = when (selectedTab) {
                    ProductivityTab.REMINDERS -> ProductivityKind.REMINDER
                    ProductivityTab.TASKS -> ProductivityKind.TASK
                    ProductivityTab.TODO -> ProductivityKind.TODO
                }
                if (kind == ProductivityKind.REMINDER && dueAt <= System.currentTimeMillis()) {
                    statusMessage = "Choose a future date and time for the reminder."
                } else {
                    ProductivityStore.create(context, clean, kind, if (kind == ProductivityKind.REMINDER) dueAt else null)
                    title = ""
                    statusMessage = when (kind) {
                        ProductivityKind.REMINDER -> "Reminder saved and scheduled."
                        ProductivityKind.TASK -> "Task saved."
                        ProductivityKind.TODO -> "To-do item saved."
                    }
                    refresh()
                }
            }
        }, modifier = Modifier.fillMaxWidth()) {
            Text(when (selectedTab) {
                ProductivityTab.REMINDERS -> "Save & Schedule Reminder"
                ProductivityTab.TASKS -> "Add Task"
                ProductivityTab.TODO -> "Add To-do"
            })
        }
        if (statusMessage.isNotBlank()) Text(statusMessage, color = Slate400, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
        Spacer(Modifier.height(12.dp))
        Text("${visible.count { !it.completed }} active • ${visible.count { it.completed }} completed", color = Slate400, fontSize = 12.sp)
        Spacer(Modifier.height(6.dp))
        if (visible.isEmpty()) {
            Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Slate900), shape = RoundedCornerShape(14.dp)) {
                Text("Nothing here yet. Add your first item above.", color = Slate400, modifier = Modifier.padding(16.dp))
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(visible, key = { it.id }) { item ->
                    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = Slate900)) {
                        Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = item.completed, onCheckedChange = { checked ->
                                ProductivityStore.update(context, item.copy(completed = checked)); refresh()
                            })
                            Column(Modifier.weight(1f).padding(start = 4.dp)) {
                                Text(item.title, color = if (item.completed) Slate400 else Slate100, fontWeight = FontWeight.SemiBold)
                                item.dueAtMillis?.let {
                                    Text(SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault()).format(Date(it)), color = Slate400, fontSize = 11.sp)
                                }
                                Text(if (item.completed) "Completed" else "Active", color = Slate400, fontSize = 10.sp)
                            }
                            Button(onClick = { ProductivityStore.delete(context, item); refresh() }, colors = ButtonDefaults.buttonColors(containerColor = Slate800)) {
                                Text("Delete")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TabButton(label: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Button(onClick = onClick, modifier = modifier, colors = ButtonDefaults.buttonColors(containerColor = if (selected) VioletPrimary else Slate800)) {
        Text(label, fontSize = 11.sp)
    }
}
