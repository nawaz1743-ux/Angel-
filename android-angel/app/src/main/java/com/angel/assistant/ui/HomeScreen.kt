package com.angel.assistant.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.angel.assistant.data.model.AssistantLanguage
import com.angel.assistant.theme.CyanAccent
import com.angel.assistant.theme.EmeraldGreen
import com.angel.assistant.theme.RoseError
import com.angel.assistant.theme.Slate100
import com.angel.assistant.theme.Slate400
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
            // Protect content from status bar, navigation bar and display cutouts.
            .windowInsetsPadding(WindowInsets.safeDrawing)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {

            // TOP HEADER
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "ANGEL AI",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Slate100,
                        letterSpacing = 2.sp
                    )

                    Text(
                        text = "YOUR PERSONAL AI",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Medium,
                        color = CyanAccent,
                        letterSpacing = 1.5.sp
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Button(
                        onClick = onToggleLanguage,
                        shape = RoundedCornerShape(20.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Slate900
                        )
                    ) {
                        Text(
                            text = if (language == AssistantLanguage.ENGLISH) {
                                "English"
                            } else {
                                "Hinglish"
                            },
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = CyanAccent
                        )
                    }

                    IconButton(
                        onClick = onNavigateSettings,
                        modifier = Modifier
                            .padding(start = 4.dp)
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
            }

            Spacer(modifier = Modifier.height(28.dp))

            // ANIMATED FULL-BODY ANGEL AVATAR
            AngelAvatar(
                isListening = isListening,
                isSpeaking = isSpeaking,
                onClick = onMicClick,
                size = 170.dp
            )

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "Angel",
                style = MaterialTheme.typography.headlineLarge,
                fontSize = 34.sp,
                fontWeight = FontWeight.Bold,
                color = Slate100,
                textAlign = TextAlign.Center
            )

            Text(
                text = if (language == AssistantLanguage.ENGLISH) {
                    "Your Personal AI Assistant"
                } else {
                    "Aapki Personal AI Assistant"
                },
                fontSize = 13.sp,
                color = Slate400,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 5.dp)
            )

            // LIVE VOICE STATUS
            Row(
                modifier = Modifier.padding(top = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(
                            color = when {
                                isListening -> RoseError
                                isSpeaking -> CyanAccent
                                else -> EmeraldGreen
                            },
                            shape = CircleShape
                        )
                )

                Text(
                    text = when {
                        isListening -> "Listening..."
                        isSpeaking -> "Angel is speaking..."
                        else -> "Online & Ready"
                    },
                    fontSize = 12.sp,
                    color = CyanAccent,
                    modifier = Modifier.padding(start = 7.dp)
                )
            }

            Spacer(modifier = Modifier.height(28.dp))

            // MAIN CHAT BUTTON
            Button(
                onClick = onNavigateChat,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp),
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = VioletPrimary
                )
            ) {
                Icon(
                    imageVector = Icons.Default.Chat,
                    contentDescription = null,
                    tint = Slate100
                )

                Text(
                    text = "  Open Angel Chat",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate100
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // VOICE INPUT BUTTON
            Button(
                onClick = onMicClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isListening) RoseError else Slate900
                )
            ) {
                Icon(
                    imageVector = Icons.Default.Mic,
                    contentDescription = "Microphone",
                    tint = Slate100
                )

                Text(
                    text = if (isListening) {
                        "Listening... Tap to Stop"
                    } else {
                        "Hands-Free / Voice Input"
                    },
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Slate100,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // SECONDARY ACTIONS
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Card(
                    onClick = onNavigateApprovals,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = Slate900
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.Campaign,
                            contentDescription = null,
                            tint = CyanAccent,
                            modifier = Modifier.size(25.dp)
                        )

                        Spacer(modifier = Modifier.height(7.dp))

                        Text(
                            text = "Ads Approvals",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Slate100,
                            textAlign = TextAlign.Center
                        )
                    }
                }

                Card(
                    onClick = onInspectScreen,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = Slate900
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.ScreenSearchDesktop,
                            contentDescription = null,
                            tint = VioletPrimary,
                            modifier = Modifier.size(25.dp)
                        )

                        Spacer(modifier = Modifier.height(7.dp))

                        Text(
                            text = "Screen Understanding",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Slate100,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(26.dp))

            // CREATOR CREDIT
            Text(
                text = "DESIGNED & DEVELOPED BY",
                fontSize = 9.sp,
                fontWeight = FontWeight.Medium,
                color = Slate400,
                letterSpacing = 2.sp,
                textAlign = TextAlign.Center
            )

            Text(
                text = "SHAAN",
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Slate100,
                letterSpacing = 4.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 5.dp)
            )

            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}
