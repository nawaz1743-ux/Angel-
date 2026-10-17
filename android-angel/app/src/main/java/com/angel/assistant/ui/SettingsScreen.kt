package com.angel.assistant.data.model

enum class AssistantLanguage(
    val displayName: String,
    val code: String,
    val description: String
) {
    HINGLISH(
        "Hinglish",
        "hi-IN",
        "Hindi aur English, Roman script mein"
    ),
    ENGLISH(
        "English",
        "en-IN",
        "English language mode"
    )
}
