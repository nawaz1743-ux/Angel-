package com.angel.assistant.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.ScreenSearchDesktop
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.angel.assistant.data.model.AssistantLanguage
import com.angel.assistant.theme.CyanAccent
import com.angel.assistant.theme.EmeraldGreen
import com.angel.assistant.theme.RoseError
import com.angel.assistant.theme.Slate100
import com.angel.assistant.theme.Slate400
import com.angel.assistant.theme.Slate800
import com.angel.assistant.theme.Slate900
import com.angel.assistant.theme.Slate950
import com.angel.assistant.theme.VioletPrimary
import com.angel.assistant.ui.components.AngelAvatar

@Composable
fun HomeScreen(
    language: AssistantLanguage,
    isListening: Boolean,
    isSpeaking: Boolean,
    onMicClick: () -> Unit,
    onNavigateChat: () -> Unit,
    onNavigateApprovals: () -> Unit,
    onNavigateSettings: () -> Unit,
    onInspectScreen: () -> Unit,
    onToggleLanguage: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Slate950)
            .padding(16.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Language Switcher Badge
                Button(
                    onClick = onToggleLanguage,
                    shape = RoundedCornerShape(20.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Slate900)
                ) {
                    Text(
                        text = language.displayName,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = CyanAccent
                    )
                }

                // Settings Navigation Button
                IconButton(
                    onClick = onNavigateSettings,
                    modifier = Modifier
                        .background(Slate900, CircleShape)
                        .size(42.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Settings,
                        contentDescription = "Settings",
                        tint = Slate100
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Center: Interactive Avatar
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                AngelAvatar(
                    isListening = isListening,
                    isSpeaking = isSpeaking,
                    onClick = onMicClick,
                    size = 180.dp
                )

                Spacer(modifier = Modifier.height(18.dp))

                Text(
                    text = "Angel",
                    style = MaterialTheme.typography.headlineLarge,
                    color = Slate100
                )

                Text(
                    text = if (language == AssistantLanguage.ENGLISH)
                        "Personal AI Assistant • Samsung Galaxy S26 Ultra"
                    else
                        "Aapki Personal AI Assistant • S26 Ultra",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Slate400,
                    modifier = Modifier.padding(top = 4.dp)
                )

                // Ready Indicator
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(EmeraldGreen, CircleShape)
                    )
                    Text(
                        text = if (isListening) "Sun rahi hoon..." else if (isSpeaking) "Bol rahi hoon..." else "Online & Ready",
                        color = Slate400,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(start = 6.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Bottom Navigation Card Grid
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Chat Action Card
                    Card(
                        onClick = onNavigateChat,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Slate900)
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Chat, contentDescription = null, tint = VioletPrimary)
                            Text(
                                text = "Chat & Voice",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Slate100,
                                modifier = Modifier.padding(start = 8.dp)
                            )
                        }
                    }

                    // Ads Approval Queue Card
                    Card(
                        onClick = onNavigateApprovals,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Slate900)
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Campaign, contentDescription = null, tint = CyanAccent)
                            Text(
                                text = "Ads Approvals",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Slate100,
                                modifier = Modifier.padding(start = 8.dp)
                            )
                        }
                    }
                }

                // Screen Understanding Action
                Card(
                    onClick = onInspectScreen,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Slate900)
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.ScreenSearchDesktop, contentDescription = null, tint = Slate400)
                        Column(modifier = Modifier.padding(start = 8.dp)) {
                            Text(
                                text = "Screen Understanding",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Slate100
                            )
                            Text(
                                text = "Inspect active window via Accessibility (Consent-required)",
                                fontSize = 10.sp,
                                color = Slate400
                            )
                        }
                    }
                }

                // Push-to-Talk Primary Bar
                Button(
                    onClick = onMicClick,
                    shape = RoundedCornerShape(28.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isListening) RoseError else VioletPrimary
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Mic,
                        contentDescription = "Microphone",
                        tint = Slate100,
                        modifier = Modifier.size(24.dp)
                    )
                    Text(
                        text = if (isListening) "Listening... Tap to stop" else "Tap to Speak to Angel",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate100,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
            }
        }
    }
}
