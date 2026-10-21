package com.angel.assistant.workflow

import com.angel.assistant.data.model.ApprovalStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GoogleAdsApprovalWorkflowTest {

    @Test
    fun approveItem_marksOnlySelectedItemAsApproved() {
        val workflow = GoogleAdsApprovalWorkflow()
        val itemsBefore = workflow.approvalQueue.value
        val selected = itemsBefore.first()

        val result = workflow.approveItem(selected.id)

        assertTrue(result.contains("APPROVED_READY_FOR_OAUTH_SYNC"))
        assertEquals(
            ApprovalStatus.APPROVED_READY_FOR_OAUTH_SYNC,
            workflow.approvalQueue.value.first { it.id == selected.id }.status
        )
        assertEquals(
            itemsBefore.last().status,
            workflow.approvalQueue.value.first { it.id == itemsBefore.last().id }.status
        )
    }

    @Test
    fun rejectItem_marksSelectedItemRejected() {
        val workflow = GoogleAdsApprovalWorkflow()
        val selected = workflow.approvalQueue.value.first()

        val result = workflow.rejectItem(selected.id)

        assertTrue(result.contains("rejected", ignoreCase = true))
        assertEquals(
            ApprovalStatus.REJECTED_BY_USER,
            workflow.approvalQueue.value.first { it.id == selected.id }.status
        )
    }

    @Test
    fun dryRun_marksItemAsSimulationWithoutPublishing() {
        val workflow = GoogleAdsApprovalWorkflow()
        val selected = workflow.approvalQueue.value.first()

        val result = workflow.runSimulatedDryRun(selected.id)

        assertTrue(result.contains("Simulation complete"))
        assertTrue(result.contains("publishing remains safely disabled", ignoreCase = true))
        assertEquals(
            ApprovalStatus.SIMULATED_SAFE_DRY_RUN,
            workflow.approvalQueue.value.first { it.id == selected.id }.status
        )
    }

    @Test
    fun unknownItemId_doesNotChangeQueue() {
        val workflow = GoogleAdsApprovalWorkflow()
        val before = workflow.approvalQueue.value

        workflow.rejectItem("not-a-real-id")

        assertEquals(before, workflow.approvalQueue.value)
    }
}
