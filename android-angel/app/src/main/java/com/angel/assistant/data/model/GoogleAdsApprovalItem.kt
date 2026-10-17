package com.angel.assistant.data.model

import java.util.UUID

enum class ApprovalStatus {
    PENDING_USER_APPROVAL,
    APPROVED_READY_FOR_OAUTH_SYNC,
    REJECTED_BY_USER,
    SIMULATED_SAFE_DRY_RUN
}

data class GoogleAdsApprovalItem(
    val id: String = UUID.randomUUID().toString(),
    val campaignName: String,
    val proposedDailyBudget: String,
    val targetKeywords: List<String>,
    val targetLocation: String = "India",
    val targetPlatform: String = "Google Search & YouTube",
    val headlineCopy: String,
    val descriptionCopy: String,
    val status: ApprovalStatus = ApprovalStatus.PENDING_USER_APPROVAL
)
