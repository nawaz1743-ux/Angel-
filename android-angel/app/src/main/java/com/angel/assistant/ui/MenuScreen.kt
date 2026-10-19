package com.angel.assistant.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.NoteAlt
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.angel.assistant.theme.CyanAccent
import com.angel.assistant.theme.Slate100
import com.angel.assistant.theme.Slate400
import com.angel.assistant.theme.Slate900
import com.angel.assistant.theme.Slate950
import com.angel.assistant.theme.VioletPrimary

data class AngelMenuItem(
    val title: String,
    val description: String,
    val icon: ImageVector,
    val onClick: () -> Unit
)

@Composable
fun MenuScreen(
    onBack: () -> Unit,
    onOpenChat: () -> Unit,
    onOpenApprovals: () -> Unit,
    onOpenSettings: () -> Unit,
    onInspectScreen: () -> Unit
) {
    val menuItems = listOf(
        AngelMenuItem(
            "Chat with Angel",
            "Angel se baat karein",
            Icons.Default.Chat,
            onOpenChat
        ),
        AngelMenuItem(
            "Screen Understanding",
            "Current screen ko samajhne mein madad",
            Icons.Default.Apps,
            onInspectScreen
        ),
        AngelMenuItem(
            "Reminders & Alarms",
            "Reminders aur alarms",
            Icons.Default.Alarm,
            {}
        ),
        AngelMenuItem(
            "Call Dialer",
            "Phone dialer kholein",
            Icons.Default.Contacts,
            {}
        ),
        AngelMenuItem(
            "Task Manager",
            "Apne tasks manage karein",
            Icons.Default.Assignment,
            {}
        ),
        AngelMenuItem(
            "To-do List",
            "Daily tasks ki list",
            Icons.Default.NoteAlt,
            {}
        ),
        AngelMenuItem(
            "Writing Assistant",
            "Messages aur writing mein madad",
            Icons.Default.MenuBook,
            onOpenChat
        ),
        AngelMenuItem(
            "Translation",
            "Languages translate karein",
            Icons.Default.Translate,
            onOpenChat
        ),
        AngelMenuItem(
            "Learning Assistant",
            "Naye topics seekhein",
            Icons.Default.Language,
            onOpenChat
        ),
        AngelMenuItem(
            "Voice & Animation",
            "Voice aur animation settings",
            Icons.Default.VolumeUp,
            onOpenSettings
        ),
        AngelMenuItem(
            "Ads Approvals",
            "Pending approvals dekhein",
            Icons.Default.Campaign,
            onOpenApprovals
        ),
        AngelMenuItem(
            "App Settings",
            "Angel ki settings",
            Icons.Default.Settings,
            onOpenSettings
        )
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Slate950)
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = Slate100
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "ANGEL AI",
                    style = MaterialTheme.typography.titleLarge,
                    color = Slate100,
                    fontWeight = FontWeight.ExtraBold
                )
                Text(
                    text = "YOUR PERSONAL AI",
                    style = MaterialTheme.typography.labelSmall,
                    color = CyanAccent
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Text(
            text = "Angel Menu",
            style = MaterialTheme.typography.headlineMedium,
            color = Slate100,
            fontWeight = FontWeight.Bold
        )

        Text(
            text = "Aapke saare tools ek hi jagah",
            style = MaterialTheme.typography.bodyMedium,
            color = Slate400,
            modifier = Modifier.padding(top = 5.dp, bottom = 18.dp)
        )

        menuItems.forEach { item ->
            Card(
                onClick = item.onClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 10.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Slate900
                )
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = item.icon,
                        contentDescription = null,
                        tint = VioletPrimary
                    )

                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(start = 14.dp)
                    ) {
                        Text(
                            text = item.title,
                            color = Slate100,
                            fontWeight = FontWeight.SemiBold
                        )

                        Text(
                            text = item.description,
                            color = Slate400,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 3.dp)
                        )
                    }
                }
            }
        }

        TextButton(
            onClick = onBack,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        ) {
            Text("Back to Home", color = CyanAccent)
        }
    }
}
