package com.angel.assistant.data.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AssistantModelsTest {

    @Test
    fun assistantLanguagesExposeExpectedNamesAndLocaleCodes() {
        assertEquals("Hinglish", AssistantLanguage.HINGLISH.displayName)
        assertEquals("hi-IN", AssistantLanguage.HINGLISH.code)
        assertEquals("English", AssistantLanguage.ENGLISH.displayName)
        assertEquals("en-IN", AssistantLanguage.ENGLISH.code)
    }

    @Test
    fun chatMessageKeepsProvidedContentAndSender() {
        val message = ChatMessage(
            text = "Hello Sir",
            isFromUser = false,
            timestamp = 123L,
            provider = "Angel"
        )

        assertEquals("Hello Sir", message.text)
        assertEquals(false, message.isFromUser)
        assertEquals(123L, message.timestamp)
        assertEquals("Angel", message.provider)
        assertTrue(message.id.isNotBlank())
    }

    @Test
    fun chatMessagesGetDistinctDefaultIds() {
        val first = ChatMessage(text = "First", isFromUser = true)
        val second = ChatMessage(text = "Second", isFromUser = true)

        assertNotEquals(first.id, second.id)
        assertNull(first.provider)
    }

    @Test
    fun approvalItemDefaultsToPendingUserApproval() {
        val item = GoogleAdsApprovalItem(
            campaignName = "Test campaign",
            proposedDailyBudget = "₹100 / day",
            targetKeywords = listOf("Angel assistant"),
            headlineCopy = "Test headline",
            descriptionCopy = "Test description"
        )

        assertEquals(ApprovalStatus.PENDING_USER_APPROVAL, item.status)
        assertEquals("India", item.targetLocation)
        assertTrue(item.targetKeywords.contains("Angel assistant"))
    }
}
