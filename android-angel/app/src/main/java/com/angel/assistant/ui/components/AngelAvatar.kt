package com.angel.assistant.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.angel.assistant.theme.CyanAccent
import com.angel.assistant.theme.RoseError
import com.angel.assistant.theme.Slate100
import com.angel.assistant.theme.VioletDark
import com.angel.assistant.theme.VioletLight
import com.angel.assistant.theme.VioletPrimary

@Composable
fun AngelAvatar(
    isListening: Boolean,
    isSpeaking: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 160.dp
) {
    val infiniteTransition = rememberInfiniteTransition(label = "avatarPulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    val currentScale = if (isListening || isSpeaking) pulseScale else 1.0f

    val gradientBrush = when {
        isListening -> Brush.radialGradient(
            colors = listOf(RoseError, VioletDark, Color(0xFF1E1035))
        )
        isSpeaking -> Brush.radialGradient(
            colors = listOf(CyanAccent, VioletPrimary, Color(0xFF0F0B26))
        )
        else -> Brush.radialGradient(
            colors = listOf(VioletLight, VioletPrimary, Color(0xFF0A071E))
        )
    }

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(size)
            .scale(currentScale)
            .clickable(onClick = onClick)
    ) {
        // Outer Glow Aura
        Box(
            modifier = Modifier
                .size(size)
                .background(
                    color = (if (isListening) RoseError else VioletPrimary).copy(alpha = 0.25f),
                    shape = CircleShape
                )
        )

        // Core Orb Body
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(size * 0.82f)
                .background(brush = gradientBrush, shape = CircleShape)
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                when {
                    isListening -> {
                        Icon(
                            imageVector = Icons.Default.Mic,
                            contentDescription = "Listening",
                            tint = Slate100,
                            modifier = Modifier.size(36.dp)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Sun rahi hoon...",
                            color = Slate100,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    isSpeaking -> {
                        Icon(
                            imageVector = Icons.Default.VolumeUp,
                            contentDescription = "Speaking",
                            tint = Slate100,
                            modifier = Modifier.size(36.dp)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Angel bol rahi hai...",
                            color = Slate100,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    else -> {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = "Angel Ready",
                            tint = Slate100,
                            modifier = Modifier.size(36.dp)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Angel",
                            color = Slate100,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
