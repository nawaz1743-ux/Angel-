package com.angel.assistant.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.angel.assistant.theme.CyanAccent
import com.angel.assistant.theme.Slate100
import com.angel.assistant.theme.Slate300
import com.angel.assistant.theme.Slate400
import com.angel.assistant.theme.Slate900
import com.angel.assistant.theme.Slate950
import kotlinx.coroutines.launch

@Composable
fun SmartAdsManagerScreen(
    onBack: () -> Unit,
    onGeneratePlan: suspend (platform: String, goal: String, budget: String, location: String, offer: String) -> String,
    onSpeak: (String) -> Unit
) {
    var platform by remember { mutableStateOf("Google Ads") }
    var goal by remember { mutableStateOf("Phone calls / enquiries") }
    var budget by remember { mutableStateOf("300") }
    var location by remember { mutableStateOf("Chinchwad, Pimpri-Chinchwad") }
    var offer by remember { mutableStateOf("Sunshine Spa Chinchwad; massage services; ask customers to call for details") }
    var platformMenu by remember { mutableStateOf(false) }
    var goalMenu by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Column(modifier = Modifier.fillMaxSize().background(Slate950).verticalScroll(rememberScrollState()).padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Slate100)
            }
            Column(modifier = Modifier.weight(1f).padding(top = 8.dp)) {
                Text("Smart Ads Manager", color = Slate100, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text("Google Ads • Facebook • Instagram", color = CyanAccent, fontSize = 12.sp)
            }
            Icon(Icons.Default.Campaign, contentDescription = null, tint = CyanAccent, modifier = Modifier.padding(top = 12.dp))
        }
        Spacer(Modifier.height(12.dp))
        Card(colors = CardDefaults.cardColors(containerColor = Slate900), shape = RoundedCornerShape(14.dp)) {
            Column(Modifier.padding(14.dp)) {
                Text("Angel will explain benefits and risks before you decide.", color = Slate100, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Text("Abhi yeh screen AI-based plan aur ad drafts banati hai. Live Google/Meta account connection aur publishing abhi configure nahi hain, isliye yahan se koi ad live nahi hoga aur koi paisa kharch nahi hoga.", color = Slate300, fontSize = 12.sp, lineHeight = 17.sp)
            }
        }
        Spacer(Modifier.height(14.dp))
        Text("Ad platform", color = Slate100, fontWeight = FontWeight.SemiBold)
        TextButton(onClick = { platformMenu = true }) { Text(platform, color = CyanAccent) }
        DropdownMenu(expanded = platformMenu, onDismissRequest = { platformMenu = false }) {
            listOf("Google Ads", "Facebook Ads", "Instagram Ads", "Facebook + Instagram Ads").forEach {
                DropdownMenuItem(text = { Text(it) }, onClick = { platform = it; platformMenu = false })
            }
        }
        Text("Main goal", color = Slate100, fontWeight = FontWeight.SemiBold)
        TextButton(onClick = { goalMenu = true }) { Text(goal, color = CyanAccent) }
        DropdownMenu(expanded = goalMenu, onDismissRequest = { goalMenu = false }) {
            listOf("Phone calls / enquiries", "WhatsApp enquiries", "Website visits", "Directions / local visits", "Brand awareness").forEach {
                DropdownMenuItem(text = { Text(it) }, onClick = { goal = it; goalMenu = false })
            }
        }
        OutlinedTextField(value = budget, onValueChange = { budget = it.filter(Char::isDigit).take(6) }, label = { Text("Proposed daily budget (₹)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(value = location, onValueChange = { location = it }, label = { Text("Target location") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(value = offer, onValueChange = { offer = it }, label = { Text("Business, offer and details") }, modifier = Modifier.fillMaxWidth(), minLines = 3)
        Spacer(Modifier.height(14.dp))
        Button(
            onClick = {
                error = ""
                result = ""
                val parsedBudget = budget.toLongOrNull()
                if (parsedBudget == null || parsedBudget <= 0L || location.isBlank() || offer.isBlank()) {
                    error = "Sir, valid daily budget, target location aur business details bhariye."
                } else {
                    busy = true
                    scope.launch {
                        try {
                            result = onGeneratePlan(platform, goal, budget, location, offer)
                        } catch (e: Exception) {
                            error = "Plan generate nahi ho saka. Internet/API key check karke dobara try karein."
                        } finally {
                            busy = false
                        }
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = !busy,
            colors = ButtonDefaults.buttonColors(containerColor = CyanAccent, contentColor = Slate950)
        ) {
            if (busy) CircularProgressIndicator() else Text("Create smart plan & ad draft", fontWeight = FontWeight.Bold)
        }
        if (error.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(error, color = Slate100)
        }
        if (result.isNotBlank()) {
            Spacer(Modifier.height(16.dp))
            Card(colors = CardDefaults.cardColors(containerColor = Slate900), shape = RoundedCornerShape(14.dp)) {
                Column(Modifier.padding(14.dp)) {
                    Text("Angel's proposal — review before launch", color = CyanAccent, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(10.dp))
                    Text(result, color = Slate100, fontSize = 14.sp, lineHeight = 20.sp)
                    Spacer(Modifier.height(10.dp))
                    Text("This is a draft only. It has not been sent to Google or Meta and no campaign has been published.", color = Slate400, fontSize = 12.sp)
                    TextButton(onClick = { onSpeak(result) }) {
                        Icon(Icons.Default.VolumeUp, contentDescription = null, tint = CyanAccent)
                        Text("  Read proposal aloud", color = CyanAccent)
                    }
                }
            }
        }
        Spacer(Modifier.height(18.dp))
        Text("Next integration step: secure Google Ads OAuth/API access and Meta Marketing API access. Never put access tokens or API secrets directly in app source code.", color = Slate400, fontSize = 12.sp, lineHeight = 17.sp)
    }
}
