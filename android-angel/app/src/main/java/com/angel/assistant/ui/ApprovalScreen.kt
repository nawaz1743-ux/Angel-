package com.angel.assistant.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.angel.assistant.data.model.ApprovalStatus
import com.angel.assistant.data.model.GoogleAdsApprovalItem
import com.angel.assistant.theme.AmberPending
import com.angel.assistant.theme.CyanAccent
import com.angel.assistant.theme.EmeraldGreen
import com.angel.assistant.theme.RoseError
import com.angel.assistant.theme.Slate100
import com.angel.assistant.theme.Slate300
import com.angel.assistant.theme.Slate400
import com.angel.assistant.theme.Slate800
import com.angel.assistant.theme.Slate900
import com.angel.assistant.theme.Slate950
import com.angel.assistant.theme.VioletPrimary

@Composable
fun ApprovalScreen(
    items: List<GoogleAdsApprovalItem>,
    onApprove: (String) -> String,
    onReject: (String) -> String,
    onSimulate: (String) -> String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var feedbackMessage by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Slate950)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Slate900)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = Slate100
                )
            }
            Icon(
                imageVector = Icons.Default.Campaign,
                contentDescription = null,
                tint = CyanAccent,
                modifier = Modifier
                    .size(28.dp)
                    .padding(start = 4.dp)
            )
            Column(modifier = Modifier.padding(start = 10.dp)) {
                Text(
                    text = "Google Ads Approval Queue",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate100
                )
                Text(
                    text = "Human-in-the-Loop Safeguards",
                    fontSize = 11.sp,
                    color = Slate400
                )
            }
        }

        // Safety Banner
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Slate900)
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Info,
                    contentDescription = null,
                    tint = CyanAccent,
                    modifier = Modifier.size(24.dp)
                )
                Text(
                    text = "All future Google Ads publishing requires manual approval in this screen and configured Google OAuth 2.0 developer credentials. No campaign is published without your approval.",
                    fontSize = 11.sp,
                    color = Slate300,
                    lineHeight = 16.sp,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }
        }

        // Feedback Snackbar / Notification
        feedbackMessage?.let { feedback ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(containerColor = Slate800)
            ) {
                Text(
                    text = feedback,
                    fontSize = 12.sp,
                    color = CyanAccent,
                    modifier = Modifier.padding(10.dp)
                )
            }
        }

        // Queue List
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
            contentPadding = PaddingValues(vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(items, key = { it.id }) { item ->
                ApprovalCard(
                    item = item,
                    onApprove = {
                        feedbackMessage = onApprove(item.id)
                    },
                    onReject = {
                        feedbackMessage = onReject(item.id)
                    },
                    onSimulate = {
                        feedbackMessage = onSimulate(item.id)
                    }
                )
            }
        }
    }
}

@Composable
private fun ApprovalCard(
    item: GoogleAdsApprovalItem,
    onApprove: () -> Unit,
    onReject: () -> Unit,
    onSimulate: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Slate900),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // Status Chip & Title
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = item.campaignName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate100,
                    modifier = Modifier.weight(1f)
                )

                val (statusColor, statusText) = when (item.status) {
                    ApprovalStatus.PENDING_USER_APPROVAL -> AmberPending to "Pending Review"
                    ApprovalStatus.APPROVED_READY_FOR_OAUTH_SYNC -> EmeraldGreen to "Approved"
                    ApprovalStatus.REJECTED_BY_USER -> RoseError to "Rejected"
                    ApprovalStatus.SIMULATED_SAFE_DRY_RUN -> CyanAccent to "Simulated"
                }

                Box(
                    modifier = Modifier
                        .background(statusColor.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = statusText,
                        color = statusColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Details
            Text(
                text = "Platform: ${item.targetPlatform}",
                fontSize = 11.sp,
                color = Slate400
            )
            Text(
                text = "Proposed Daily Budget: ${item.proposedDailyBudget}",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = CyanAccent
            )
            Text(
                text = "Target Keywords: ${item.targetKeywords.joinToString(", ")}",
                fontSize = 11.sp,
                color = Slate300
            )

            Spacer(modifier = Modifier.height(6.dp))

            // Copy Preview
            Card(
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(containerColor = Slate800),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(8.dp)) {
                    Text(
                        text = item.headlineCopy,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate100
                    )
                    Text(
                        text = item.descriptionCopy,
                        fontSize = 11.sp,
                        color = Slate400,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action Buttons
            if (item.status == ApprovalStatus.PENDING_USER_APPROVAL) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onApprove,
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldGreen),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                        Text("Approve", fontSize = 12.sp, modifier = Modifier.padding(start = 4.dp))
                    }

                    OutlinedButton(
                        onClick = onSimulate,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(16.dp))
                        Text("Dry-Run", fontSize = 12.sp, modifier = Modifier.padding(start = 4.dp))
                    }

                    Button(
                        onClick = onReject,
                        colors = ButtonDefaults.buttonColors(containerColor = Slate800),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Reject", fontSize = 12.sp, color = RoseError)
                    }
                }
            }
        }
    }
}
