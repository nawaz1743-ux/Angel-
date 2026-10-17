package com.angel.assistant.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = VioletPrimary,
    secondary = CyanAccent,
    background = Slate950,
    surface = Slate900,
    onPrimary = Slate100,
    onSecondary = Slate950,
    onBackground = Slate100,
    onSurface = Slate100,
)

@Composable
fun AngelTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}
