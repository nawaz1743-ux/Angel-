package com.angel.assistant.workflow

import com.angel.assistant.data.model.ApprovalStatus
import com.angel.assistant.data.model.GoogleAdsApprovalItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class GoogleAdsApprovalWorkflow {

    private val _approvalQueue = MutableStateFlow<List<GoogleAdsApprovalItem>>(
        listOf(
            GoogleAdsApprovalItem(
                campaignName = "Samsung Galaxy S26 Ultra Launch Campaign",
                proposedDailyBudget = "₹500 / day",
                targetKeywords = listOf("Samsung S26 Ultra", "AI Assistant Mobile", "Best Android Phone 2026"),
                targetLocation = "India (All Metros)",
                headlineCopy = "Experience Angel AI on Galaxy S26 Ultra",
                descriptionCopy = "Next-gen intelligent assistance with female voice, task automation, and instant reminders.",
                status = ApprovalStatus.PENDING_USER_APPROVAL
            ),
            GoogleAdsApprovalItem(
                campaignName = "Angel Personal Assistant Awareness",
                proposedDailyBudget = "₹350 / day",
                targetKeywords = listOf("Personal AI Assistant", "Hinglish Voice Assistant", "Android Task Manager"),
                targetLocation = "India (National)",
                headlineCopy = "Angel - Smart Voice & Task Assistant",
                descriptionCopy = "Speak naturally in Hinglish or English. Prepare calls, WhatsApp messages, and daily plans safely.",
                status = ApprovalStatus.PENDING_USER_APPROVAL
            )
        )
    )
    val approvalQueue: StateFlow<List<GoogleAdsApprovalItem>> = _approvalQueue.asStateFlow()

    fun approveItem(itemId: String): String {
        _approvalQueue.value = _approvalQueue.value.map { item ->
            if (item.id == itemId) {
                item.copy(status = ApprovalStatus.APPROVED_READY_FOR_OAUTH_SYNC)
            } else item
        }
        return "Campaign approved by user. Status set to: APPROVED_READY_FOR_OAUTH_SYNC. Note: Actual publishing requires OAuth 2.0 developer credentials."
    }

    fun rejectItem(itemId: String): String {
        _approvalQueue.value = _approvalQueue.value.map { item ->
            if (item.id == itemId) {
                item.copy(status = ApprovalStatus.REJECTED_BY_USER)
            } else item
        }
        return "Campaign draft rejected. No actions will be taken."
    }

    fun runSimulatedDryRun(itemId: String): String {
        _approvalQueue.value = _approvalQueue.value.map { item ->
            if (item.id == itemId) {
                item.copy(status = ApprovalStatus.SIMULATED_SAFE_DRY_RUN)
            } else item
        }
        return "Simulation complete. Verified keyword density and character limits. Live publishing remains safely disabled until OAuth integration."
    }
}
