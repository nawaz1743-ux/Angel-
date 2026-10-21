package com.angel.assistant.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Mic
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.angel.assistant.R
import com.angel.assistant.data.model.AssistantLanguage
import com.angel.assistant.theme.CyanAccent
import com.angel.assistant.theme.EmeraldGreen
import com.angel.assistant.theme.RoseError
import com.angel.assistant.theme.Slate100
import com.angel.assistant.theme.Slate400
import com.angel.assistant.theme.Slate900
import com.angel.assistant.theme.Slate950
import com.angel.assistant.theme.VioletPrimary

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
    val transition = rememberInfiniteTransition(label = "angel_home_animation")

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
        label = "mic_pulse"
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

        else -> "ONLINE • READY"
    }

    val panelColor = Color(0xCC18243D)
    val panelBorder = Color(0x8869DFFF)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color(0xFF15172D),
                        Color(0xFF101C35),
                        Color(0xFF080B19)
                    )
                )
            )
            .windowInsetsPadding(WindowInsets.safeDrawing)
    ) {
        // LARGE CHARACTER IMAGE AREA
        // Image ab chhoti 250.dp Avatar nahi hai.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.80f)
                .padding(top = 65.dp),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.radialGradient(
                            colors = listOf(
                                CyanAccent.copy(alpha = 0.25f),
                                VioletPrimary.copy(alpha = 0.19f),
                                Color.Transparent
                            )
                        )
                    )
            )

            Image(
                painter = painterResource(id = R.drawable.angel_full_body),
                contentDescription = "Angel AI character",
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 4.dp),
                contentScale = ContentScale.Crop,
                alignment = Alignment.TopCenter
            )

            // Subtle holographic overlay
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color(0x2217BFFF),
                                Color.Transparent,
                                Color(0x44070B1A)
                            )
                        )
                    )
            )
        }

        // TOP HEADER: Menu left, Angel truly centered, language and Settings on the right.
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(horizontal = 6.dp, vertical = 5.dp)
        ) {
            Column(
                modifier = Modifier.align(Alignment.Center),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "ANGEL AI",
                    fontSize = 21.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.5.sp,
                    color = Slate100,
                    textAlign = TextAlign.Center
                )
                Text(
                    text = "YOUR PERSONAL AI",
                    fontSize = 8.sp,
                    letterSpacing = 1.2.sp,
                    color = CyanAccent,
                    textAlign = TextAlign.Center
                )
            }

            IconButton(
                onClick = onOpenMenu,
                modifier = Modifier.align(Alignment.CenterStart).size(44.dp)
            ) {
                Icon(
                    Icons.Default.Menu,
                    contentDescription = "Open menu",
                    tint = Slate100,
                    modifier = Modifier.size(29.dp)
                )
            }

            Row(
                modifier = Modifier.align(Alignment.CenterEnd),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    onClick = onToggleLanguage,
                    shape = RoundedCornerShape(12.dp),
                    color = Slate900,
                    contentColor = Slate100,
                    border = androidx.compose.foundation.BorderStroke(1.dp, panelBorder)
                ) {
                    Text(
                        text = if (language == AssistantLanguage.ENGLISH) "English ▾" else "Hinglish ▾",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 10.dp)
                    )
                }

                IconButton(
                    onClick = onNavigateSettings,
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Settings,
                        contentDescription = "Settings",
                        tint = Slate100,
                        modifier = Modifier.size(25.dp)
                    )
                }
            }
        }

        // WELCOME MESSAGE ON LEFT
        Surface(
            modifier = Modifier
                .align(Alignment.CenterStart)
                .fillMaxWidth(0.43f)
                .padding(start = 12.dp)
                .padding(top = 8.dp),
            shape = RoundedCornerShape(16.dp),
            color = panelColor,
            border = androidx.compose.foundation.BorderStroke(
                1.dp,
                panelBorder
            )
        ) {
            Text(
                text = if (language == AssistantLanguage.ENGLISH) {
                    "Hello! Main hoon Angel, aapki personal AI assistant."
                } else {
                    "Hello! Main hoon Angel, aapki personal AI assistant."
                },
                color = Slate100,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(12.dp)
            )
        }

        // Keep Chat on Home; Screen Understanding and Ads are in the Menu.
        Column(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .fillMaxWidth(0.39f)
                .padding(end = 10.dp)
                .padding(top = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ActionCard(
                title = "Chat",
                subtitle = "Ask Anything",
                icon = {
                    Icon(Icons.Default.Chat, contentDescription = null, tint = CyanAccent, modifier = Modifier.size(25.dp))
                },
                onClick = onNavigateChat
            )
        }

        // BOTTOM CONTROL PANEL
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0xEE171827),
                            Color(0xFF0D0F1C)
                        )
                    ),
                    RoundedCornerShape(
                        topStart = 34.dp,
                        topEnd = 34.dp
                    )
                )
                .border(
                    width = 1.dp,
                    brush = Brush.horizontalGradient(
                        listOf(
                            VioletPrimary,
                            CyanAccent,
                            VioletPrimary
                        )
                    ),
                    shape = RoundedCornerShape(
                        topStart = 34.dp,
                        topEnd = 34.dp
                    )
                )
                .padding(
                    start = 14.dp,
                    end = 14.dp,
                    top = 12.dp,
                    bottom = 8.dp
                ),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Main animated microphone, centered for easier tapping.
            Box(
                modifier = Modifier.fillMaxWidth().height(104.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(94.dp)
                        .scale(micPulse)
                        .background(
                            Brush.radialGradient(listOf(VioletPrimary.copy(alpha = 0.40f), CyanAccent.copy(alpha = 0.16f), Color.Transparent)),
                            CircleShape
                        )
                        .border(
                            width = 3.dp,
                            brush = Brush.linearGradient(listOf(Color(0xFFFF85E8), VioletPrimary, CyanAccent)),
                            shape = CircleShape
                        )
                        .clickable(onClick = onMicClick),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Mic, contentDescription = "Talk to Angel", tint = Slate100, modifier = Modifier.size(43.dp))
                }
            }

            Text(
                text = statusText,
                color = statusColor,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "DESIGNED & DEVELOPED BY SHAAN",
                color = Slate400,
                fontSize = 10.sp,
                letterSpacing = 1.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun ActionCard(
    title: String,
    subtitle: String,
    icon: @Composable () -> Unit,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        color = Color(0xCC18243D),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            Color(0x8869DFFF)
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(
                horizontal = 8.dp,
                vertical = 13.dp
            ),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .background(
                        Color(0x553F72A8),
                        RoundedCornerShape(10.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                icon()
            }

            Column(
                modifier = Modifier.padding(start = 7.dp)
            ) {
                Text(
                    text = title,
                    color = Slate100,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = subtitle,
                    color = Slate100,
                    fontSize = 10.sp,
                    lineHeight = 13.sp
                )
            }
        }
    }
}

@Composable
private fun ControlButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: @Composable () -> Unit
) {
    Column(
        modifier = modifier
            .background(
                Color(0xFF20243A),
                RoundedCornerShape(15.dp)
            )
            .border(
                1.dp,
                Color(0x665D81B5),
                RoundedCornerShape(15.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        icon()

        Spacer(modifier = Modifier.height(5.dp))

        Text(
            text = label,
            color = Slate100,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}
