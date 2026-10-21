package com.angel.assistant.ui

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessibilityNew
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.angel.assistant.data.model.AssistantLanguage
import com.angel.assistant.service.AngelAccessibilityService
import com.angel.assistant.theme.CyanAccent
import com.angel.assistant.theme.EmeraldGreen
import com.angel.assistant.theme.Slate100
import com.angel.assistant.theme.Slate400
import com.angel.assistant.theme.Slate800
import com.angel.assistant.theme.Slate900
import com.angel.assistant.theme.Slate950
import com.angel.assistant.theme.VioletPrimary

@Composable
fun SettingsScreen(
    currentLanguage: AssistantLanguage,
    onSelectLanguage: (AssistantLanguage) -> Unit,
    onTestVoice: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val isAccessibilityEnabled = AngelAccessibilityService.isServiceRunning

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Slate950)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Slate900)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Angel Settings",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Slate100,
                modifier = Modifier.padding(start = 8.dp)
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Language Preference",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Slate400
            )

            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Slate900),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AssistantLanguage.values().forEach { lang ->
                        val isSelected = currentLanguage == lang

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    if (isSelected) VioletPrimary.copy(alpha = 0.2f)
                                    else Slate800,
                                    RoundedCornerShape(10.dp)
                                )
                                .clickable { onSelectLanguage(lang) }
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Translate,
                                    contentDescription = null,
                                    tint = if (isSelected) VioletPrimary else Slate400,
                                    modifier = Modifier.size(20.dp)
                                )

                                Column(modifier = Modifier.padding(start = 10.dp)) {
                                    Text(
                                        text = lang.displayName,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Slate100
                                    )

                                    Text(
                                        text = if (lang == AssistantLanguage.HINGLISH)
                                        "Roman Hinglish only"
                                         else
                                        "English language mode",
                                        fontSize = 10.sp,
                                        color = Slate400
                                    )
                                }
                            }

                            if (isSelected) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = "Selected",
                                    tint = CyanAccent,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }
            }

            Text(
                text = "Voice Output",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Slate400
            )

            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Slate900),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Female Assistant Voice",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Slate100
                        )

                        Text(
                            text = "Natural spoken tone in Hinglish and English",
                            fontSize = 11.sp,
                            color = Slate400
                        )
                    }

                    Button(
                        onClick = onTestVoice,
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Slate800
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.VolumeUp,
                            contentDescription = null,
                            tint = CyanAccent,
                            modifier = Modifier.size(16.dp)
                        )

                        Text(
                            text = "Test",
                            fontSize = 11.sp,
                            color = Slate100,
                            modifier = Modifier.padding(start = 4.dp)
                        )
                    }
                }
            }

            Text(
                text = "Screen Understanding Service",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Slate400
            )

            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Slate900),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Accessibility Service Status",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Slate100
                        )

                        Text(
                            text = if (isAccessibilityEnabled) "Active" else "Disabled",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isAccessibilityEnabled) EmeraldGreen else Slate400
                        )
                    }

                    Text(
                        text = "Allows Angel to read screen contents when you explicitly ask. Can be toggled anytime in Samsung Android Settings.",
                        fontSize = 11.sp,
                        color = Slate400,
                        modifier = Modifier.padding(top = 4.dp, bottom = 10.dp)
                    )

                    Button(
                        onClick = {
                            context.startActivity(
                                Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                            )
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Slate800
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = Icons.Default.AccessibilityNew,
                            contentDescription = null,
                            tint = VioletPrimary
                        )

                        Text(
                            text = "Open Accessibility Settings",
                            fontSize = 12.sp,
                            color = Slate100,
                            modifier = Modifier.padding(start = 6.dp)
                        )
                    }
                }
            }

            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Slate900),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = null,
                        tint = Slate400
                    )

                    Column(modifier = Modifier.padding(start = 10.dp)) {
                        Text(
                            text = "Angel Native v1.0.0",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate100
                        )

                        Text(
                            text = "Optimized for Samsung Galaxy S26 Ultra (Android 15+ / One UI)",
                            fontSize = 10.sp,
                            color = Slate400
                        )
                    }
                }
            }
        }
    }
}
