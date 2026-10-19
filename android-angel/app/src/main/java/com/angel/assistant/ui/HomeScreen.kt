package com.angel.assistant.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.ScreenSearchDesktop
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
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
    modifier: Modifier = Modifier,
    onOpenMenu: () -> Unit = {}
) {
    val transition = rememberInfiniteTransition(label = "home_glow")

    val micPulse by transition.animateFloat(
        initialValue = 0.94f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = if (isListening) 650 else 1200,
                easing = FastOutSlowInEasing
            ),
            repeatMode = RepeatMode.Reverse
        ),
        label = "microphone_pulse"
    )

    val statusColor = when {
        isListening -> RoseError
        isSpeaking -> CyanAccent
        else -> EmeraldGreen
    }

    val statusText = when {
        isListening -> if (language == AssistantLanguage.ENGLISH) {
            "LISTENING TO YOU..."
        } else {
            "SUN RAHI HOON..."
        }

        isSpeaking -> if (language == AssistantLanguage.ENGLISH) {
            "ANGEL IS SPEAKING..."
        } else {
            "ANGEL BOL RAHI HAI..."
        }

        else -> if (language == AssistantLanguage.ENGLISH) {
            "ONLINE • READY"
        } else {
            "ONLINE • READY HOON"
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF10152E),
                        Color(0xFF080B19),
                        Slate950
                    )
                )
            )
            .windowInsetsPadding(WindowInsets.safeDrawing)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // HEADER
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "ANGEL AI",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 3.sp,
                        color = Slate100
                    )

                    Text(
                        text = "YOUR PERSONAL AI",
                        fontSize = 9.sp,
                        letterSpacing = 2.sp,
                        color = CyanAccent
                    )
                }

                Surface(
                    onClick = onToggleLanguage,
                    shape = RoundedCornerShape(20.dp),
                    color = Slate900,
                    contentColor = CyanAccent
                ) {
                    Text(
                        text = if (
                            language == AssistantLanguage.ENGLISH
                        ) {
                            "EN"
                        } else {
                            "HINGLISH"
                        },
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(
                            horizontal = 12.dp,
                            vertical = 10.dp
                        )
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                IconButton(
                    onClick = onNavigateSettings,
                    modifier = Modifier
                        .size(42.dp)
                        .background(Slate900, CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Settings,
                        contentDescription = "Settings",
                        tint = Slate100
                    )
                }

                Spacer(modifier = Modifier.width(4.dp))

                IconButton(
                    onClick = onOpenMenu,
                    modifier = Modifier
                        .size(42.dp)
                        .background(Slate900, CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.Menu,
                        contentDescription = "Open Angel Menu",
                        tint = CyanAccent
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // CHARACTER AND HOLOGRAPHIC BACKGROUND
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(260.dp)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(
                                    VioletPrimary.copy(alpha = 0.24f),
                                    CyanAccent.copy(alpha = 0.09f),
                                    Color.Transparent
                                )
                            ),
                            CircleShape
                        )
                )

                AngelAvatar(
                    isListening = isListening,
                    isSpeaking = isSpeaking,
                    onClick = onMicClick,
                    size = 250.dp
                )
            }

            Text(
                text = "Angel",
                fontSize = 34.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Slate100,
                letterSpacing = 1.5.sp,
                textAlign = TextAlign.Center
            )

            Text(
                text = if (
                    language == AssistantLanguage.ENGLISH
                ) {
                    "Your Personal AI Assistant"
                } else {
                    "Aapki Personal AI Assistant"
                },
                fontSize = 13.sp,
                color = Slate400,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp)
            )

            // STATUS
            Row(
                modifier = Modifier.padding(top = 13.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(statusColor, CircleShape)
                )

                Text(
                    text = statusText,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.2.sp,
                    color = statusColor,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // GLOWING MICROPHONE
            Box(
                modifier = Modifier
                    .size(86.dp)
                    .scale(micPulse)
                    .background(
                        Brush.radialGradient(
                            colors = listOf(
                                if (isListening) {
                                    RoseError.copy(alpha = 0.38f)
                                } else {
                                    CyanAccent.copy(alpha = 0.30f)
                                },
                                VioletPrimary.copy(alpha = 0.12f),
                                Color.Transparent
                            )
                        ),
                        CircleShape
                    )
                    .border(
                        width = 1.dp,
                        color = if (isListening) {
                            RoseError
                        } else {
                            CyanAccent.copy(alpha = 0.7f)
                        },
                        shape = CircleShape
                    )
                    .clickable(onClick = onMicClick),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Mic,
                    contentDescription = if (isListening) {
                        "Stop voice input"
                    } else {
                        "Talk to Angel"
                    },
                    tint = Slate100,
                    modifier = Modifier.size(38.dp)
                )
            }

            Text(
                text = if (isListening) {
                    if (language == AssistantLanguage.ENGLISH) {
                        "TAP TO STOP"
                    } else {
                        "ROKNE KE LIYE TAP KAREIN"
                    }
                } else {
                    if (language == AssistantLanguage.ENGLISH) {
                        "TAP TO TALK TO ANGEL"
                    } else {
                        "ANGEL SE BAAT KARNE KE LIYE TAP KAREIN"
                    }
                },
                fontSize = 9.sp,
                fontWeight = FontWeight.SemiBold,
                color = Slate400,
                letterSpacing = 1.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 12.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // SCREEN UNDERSTANDING
            Button(
                onClick = onInspectScreen,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Slate900
                )
            ) {
                Icon(
                    imageVector = Icons.Default.ScreenSearchDesktop,
                    contentDescription = null,
                    tint = CyanAccent
                )

                Text(
                    text = if (
                        language == AssistantLanguage.ENGLISH
                    ) {
                        "Screen Understanding"
                    } else {
                        "Screen Ko Samjho"
                    },
                    color = Slate100,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(start = 9.dp)
                )
            }

            Spacer(modifier = Modifier.height(17.dp))

            // CREATOR CREDIT
            Text(
                text = "DESIGNED & DEVELOPED BY",
                fontSize = 9.sp,
                color = Slate400,
                letterSpacing = 2.sp,
                textAlign = TextAlign.Center
            )

            Text(
                text = "SHAAN",
                fontSize = 19.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Slate100,
                letterSpacing = 5.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 3.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}
