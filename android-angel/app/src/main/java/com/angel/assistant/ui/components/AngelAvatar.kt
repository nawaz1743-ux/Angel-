package com.angel.assistant.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.angel.assistant.R
import com.angel.assistant.theme.CyanAccent
import com.angel.assistant.theme.RoseError
import com.angel.assistant.theme.VioletPrimary

@Composable
fun AngelAvatar(
    isListening: Boolean,
    isSpeaking: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 160.dp
) {
    val transition = rememberInfiniteTransition(label = "angel_animation")

    val breathing by transition.animateFloat(
        initialValue = 0.97f,
        targetValue = 1.03f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 1800,
                easing = FastOutSlowInEasing
            ),
            repeatMode = RepeatMode.Reverse
        ),
        label = "angel_breathing"
    )

    val listeningPulse by transition.animateFloat(
        initialValue = 0.88f,
        targetValue = 1.12f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 850,
                easing = FastOutSlowInEasing
            ),
            repeatMode = RepeatMode.Reverse
        ),
        label = "angel_listening_pulse"
    )

    val speakingPulse by transition.animateFloat(
        initialValue = 0.94f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 500,
                easing = FastOutSlowInEasing
            ),
            repeatMode = RepeatMode.Reverse
        ),
        label = "angel_speaking_pulse"
    )

    val ringScale = when {
        isListening -> listeningPulse
        isSpeaking -> speakingPulse
        else -> breathing
    }

    val ringColor = when {
        isListening -> RoseError
        isSpeaking -> CyanAccent
        else -> VioletPrimary
    }

    val description = when {
        isListening -> "Angel is listening. Tap to stop."
        isSpeaking -> "Angel is speaking."
        else -> "Angel AI assistant. Tap to speak."
    }

    Box(
        modifier = modifier
            .size(size)
            .scale(if (isListening || isSpeaking) ringScale else breathing)
            .clickable(onClick = onClick)
            .semantics {
                contentDescription = description
            },
        contentAlignment = Alignment.Center
    ) {
        // Animated holographic rings
        Canvas(
            modifier = Modifier.fillMaxSize()
        ) {
            val centerX = this.size.width / 2f
            val centerY = this.size.height / 2f
            val baseRadius = this.size.minDimension * 0.43f

            drawCircle(
                color = ringColor.copy(alpha = 0.14f),
                radius = baseRadius * ringScale,
                center = androidx.compose.ui.geometry.Offset(centerX, centerY),
                style = Stroke(width = 2.dp.toPx())
            )

            drawCircle(
                color = ringColor.copy(alpha = 0.28f),
                radius = baseRadius * 0.86f * ringScale,
                center = androidx.compose.ui.geometry.Offset(centerX, centerY),
                style = Stroke(width = 1.5.dp.toPx())
            )

            drawCircle(
                color = ringColor.copy(alpha = 0.12f),
                radius = baseRadius * 0.70f,
                center = androidx.compose.ui.geometry.Offset(centerX, centerY),
                style = Stroke(width = 1.dp.toPx())
            )
        }

        // Full-body Angel image uploaded to drawable-nodpi
        Image(
            painter = painterResource(id = R.drawable.angel_full_body),
            contentDescription = "Angel full-body character",
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .fillMaxSize()
                .padding(size * 0.04f)
        )
    }
}
