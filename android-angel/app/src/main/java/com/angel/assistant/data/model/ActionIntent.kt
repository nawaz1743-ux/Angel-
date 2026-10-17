package com.angel.assistant.data.model

enum class ActionType {
    CALL, WHATSAPP, SMS, REMINDER, TASK, MAP, TIMER
}

data class ActionIntent(
    val type: ActionType,
    val title: String? = null,
    val contactName: String? = null,
    val phoneNumber: String? = null,
    val message: String? = null
)
