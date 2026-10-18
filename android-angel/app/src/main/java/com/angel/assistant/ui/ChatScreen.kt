package com.angel.assistant.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.angel.assistant.data.model.AssistantLanguage
import com.angel.assistant.data.model.ChatMessage
import com.angel.assistant.theme.CyanAccent
import com.angel.assistant.theme.RoseError
import com.angel.assistant.theme.Slate100
import com.angel.assistant.theme.Slate300
import com.angel.assistant.theme.Slate400
import com.angel.assistant.theme.Slate800
import com.angel.assistant.theme.Slate900
import com.angel.assistant.theme.Slate950
import com.angel.assistant.theme.VioletPrimary

@Composable
fun ChatScreen(
    messages: List<ChatMessage>,
    language: AssistantLanguage,
    isListening: Boolean,
    isSpeaking: Boolean,
    transcript: String,
    onSendMessage: (String) -> Unit,
    onMicClick: () -> Unit,
    onSpeakMessage: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(transcript) {
        if (transcript.isNotBlank()) {
            inputText = transcript
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    val quickPrompts = if (language == AssistantLanguage.ENGLISH) {
        listOf(
            "Hello Angel! How can you help me today?",
            "Explain modern Android Jetpack Compose architecture.",
            "Draft a WhatsApp message for my team.",
            "Plan a productive schedule for tomorrow."
        )
    } else {
        listOf(
            "Hello Angel! Aaj meri kya help kar sakti ho?",
            "React aur Kotlin ka difference simple words mein samjhao.",
            "Boss ko WhatsApp par leave application draft karke do.",
            "Kal ke liye ek productive daily plan bana kar do."
        )
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Slate950)
            .statusBarsPadding()
            .windowInsetsPadding(
                androidx.compose.foundation.layout.WindowInsets.navigationBars
            )
            .imePadding()
    ) {
        // TOP HEADER
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Slate900)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = Slate100
                )
            }

            Box(
                modifier = Modifier
                    .size(38.dp)
                    .background(VioletPrimary, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.AutoAwesome,
                    contentDescription = "Angel AI",
                    tint = Slate100,
                    modifier = Modifier.size(21.dp)
                )
            }

            Column(modifier = Modifier.padding(start = 10.dp)) {
                Text(
                    text = "Angel AI Assistant",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate100
                )

                Text(
                    text = if (language == AssistantLanguage.ENGLISH) {
                        "English Mode"
                    } else {
                        "Hinglish • Roman Script"
                    },
                    fontSize = 11.sp,
                    color = CyanAccent
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            Text(
                text = when {
                    isListening -> "Listening"
                    isSpeaking -> "Speaking"
                    else -> "Online"
                },
                fontSize = 10.sp,
                color = CyanAccent
            )
        }

        // CHAT MESSAGES
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
            contentPadding = PaddingValues(vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(messages, key = { it.id }) { message ->
                MessageBubble(
                    message = message,
                    onSpeak = { onSpeakMessage(message.text) }
                )
            }
        }

        // QUICK PROMPTS
        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .background(Slate950)
                .padding(horizontal = 10.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(quickPrompts) { prompt ->
                Button(
                    onClick = { onSendMessage(prompt) },
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Slate900
                    ),
                    contentPadding = PaddingValues(
                        horizontal = 12.dp,
                        vertical = 6.dp
                    )
                ) {
                    Text(
                        text = prompt,
                        fontSize = 11.sp,
                        color = Slate300
                    )
                }
            }
        }

        // BOTTOM MESSAGE INPUT
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Slate900)
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onMicClick,
                modifier = Modifier
                    .size(44.dp)
                    .background(
                        if (isListening) RoseError else Slate800,
                        CircleShape
                    )
            ) {
                Icon(
                    imageVector = Icons.Default.Mic,
                    contentDescription = "Voice input",
                    tint = Slate100
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            OutlinedTextField(
                value = inputText,
                onValueChange = { inputText = it },
                placeholder = {
                    Text(
                        text = if (
                            language == AssistantLanguage.ENGLISH
                        ) {
                            "Ask Angel anything..."
                        } else {
                            "Kuch bhi poochiye..."
                        },
                        color = Slate400,
                        fontSize = 13.sp
                    )
                },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(24.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Slate800,
                    unfocusedContainerColor = Slate800,
                    focusedBorderColor = VioletPrimary,
                    unfocusedBorderColor = Slate800,
                    focusedTextColor = Slate100,
                    unfocusedTextColor = Slate100,
                    cursorColor = CyanAccent
                ),
                singleLine = true
            )

            Spacer(modifier = Modifier.width(8.dp))

            IconButton(
                onClick = {
                    val clean = inputText.trim()

                    if (clean.isNotBlank()) {
                        onSendMessage(clean)
                        inputText = ""
                    }
                },
                enabled = inputText.isNotBlank(),
                modifier = Modifier
                    .size(44.dp)
                    .background(
                        if (inputText.isNotBlank()) {
                            VioletPrimary
                        } else {
                            Slate800
                        },
                        CircleShape
                    )
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Send message",
                    tint = Slate100
                )
            }
        }
    }
}

@Composable
private fun MessageBubble(
    message: ChatMessage,
    onSpeak: () -> Unit
) {
    val isUser = message.isFromUser

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) {
            Arrangement.End
        } else {
            Arrangement.Start
        }
    ) {
        Card(
            shape = RoundedCornerShape(
                topStart = 16.dp,
                topEnd = 16.dp,
                bottomStart = if (isUser) 16.dp else 4.dp,
                bottomEnd = if (isUser) 4.dp else 16.dp
            ),
            colors = CardDefaults.cardColors(
                containerColor = if (isUser) VioletPrimary else Slate900
            ),
            modifier = Modifier.padding(horizontal = 4.dp)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = message.text,
                    fontSize = 14.sp,
                    color = Slate100,
                    lineHeight = 20.sp
                )

                if (!isUser) {
                    Spacer(modifier = Modifier.height(6.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = message.provider ?: "Angel Assistant",
                            fontSize = 9.sp,
                            color = Slate400
                        )

                        Icon(
                            imageVector = Icons.Default.VolumeUp,
                            contentDescription = "Read aloud",
                            tint = CyanAccent,
                            modifier = Modifier
                                .size(20.dp)
                                .clickable { onSpeak() }
                        )
                    }
                }
            }
        }
    }
}
