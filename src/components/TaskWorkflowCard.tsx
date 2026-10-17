/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  Bell,
  CheckSquare,
  Share2,
  PhoneCall,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import { TaskWorkflow, PlanStep, ActionPayload, ContactItem } from '../types/assistant';
import { ActionConfirmationCard } from './ActionConfirmationCard';

interface TaskWorkflowCardProps {
  workflow: TaskWorkflow;
  onApproveStep?: (stepId: string) => void;
  onApproveAll?: (workflowId: string) => void;
  onRejectWorkflow?: (workflowId: string) => void;
  onExecuteAction?: (action: ActionPayload) => void;
  savedContacts?: ContactItem[];
  onOpenContactsPicker?: () => void;
}

export const TaskWorkflowCard: React.FC<TaskWorkflowCardProps> = ({
  workflow,
  onApproveStep,
  onApproveAll,
  onRejectWorkflow,
  onExecuteAction,
  savedContacts = [],
  onOpenContactsPicker,
}) => {
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const getStageBadge = (stage: TaskWorkflow['stage']) => {
    switch (stage) {
      case 'understand':
        return { label: '1. Understand', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
      case 'plan':
        return { label: '2. Plan', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
      case 'execute':
        return { label: '3. Execute', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
      case 'verify':
        return { label: '4. Verify', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
      case 'correct':
        return { label: '5. Corrected', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'review':
        return { label: '6. Final Review', color: 'bg-amber-500/25 text-amber-300 border-amber-500/40 animate-pulse' };
      case 'completed':
        return { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      default:
        return { label: stage, color: 'bg-slate-700 text-slate-300 border-slate-600' };
    }
  };

  const getStepIcon = (tool: string) => {
    if (tool.includes('Notes') || tool.includes('Drafter')) return <FileText className="w-3.5 h-3.5 text-blue-400" />;
    if (tool.includes('Reminder')) return <Bell className="w-3.5 h-3.5 text-amber-400" />;
    if (tool.includes('Task')) return <CheckSquare className="w-3.5 h-3.5 text-violet-400" />;
    if (tool.includes('WhatsApp')) return <Share2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (tool.includes('Dialer') || tool.includes('Call')) return <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />;
    return <Sparkles className="w-3.5 h-3.5 text-violet-400" />;
  };

  const stageInfo = getStageBadge(workflow.stage);
  const totalSteps = workflow.plan.length;
  const completedSteps = workflow.plan.filter((s) => s.status === 'completed').length;
  const needsApprovalSteps = workflow.plan.filter((s) => s.status === 'needs_approval').length;
  const isFinalReview = workflow.stage === 'review';
  const isAllCompleted = workflow.stage === 'completed' || (totalSteps > 0 && completedSteps === totalSteps);

  return (
    <div className="mt-3 rounded-2xl bg-slate-900/95 border border-violet-500/30 shadow-xl overflow-hidden text-left animate-fadeIn">
      {/* Header */}
      <div className="p-3.5 bg-gradient-to-r from-violet-950/60 to-slate-900 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Task Workflow</span>
              <span className="text-[10px] text-slate-400 font-normal">
                ({completedSteps}/{totalSteps} steps)
              </span>
            </h4>
            <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
              {workflow.title}
            </p>
          </div>
        </div>

        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${stageInfo.color}`}
        >
          {stageInfo.label}
        </span>
      </div>

      {/* Clarification prompt if in understand stage */}
      {workflow.clarificationNeeded && (
        <div className="p-3 bg-purple-950/30 border-b border-purple-500/20 text-xs text-purple-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-purple-100">Clarification Needed:</p>
            <p className="text-[11px] text-purple-300 mt-0.5">{workflow.clarificationNeeded}</p>
          </div>
        </div>
      )}

      {/* Step by step checklist */}
      <div className="p-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>Planned Steps & Tool Executions</span>
          <span className="text-slate-500">Autonomous Progress</span>
        </div>

        <div className="space-y-1.5">
          {workflow.plan.map((step, idx) => {
            const isExpanded = expandedStepId === step.id;
            return (
              <div
                key={step.id}
                className="p-2.5 rounded-xl bg-slate-950/70 border border-white/5 text-xs transition-all hover:border-white/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className="mt-0.5 shrink-0">{getStepIcon(step.toolOrIntegration)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-200 text-xs">
                          {idx + 1}. {step.title}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-medium">
                          {step.toolOrIntegration}
                        </span>
                      </div>
                      {step.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{step.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="shrink-0 flex items-center gap-1">
                    {step.status === 'completed' && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    )}

                    {step.status === 'in_progress' && (
                      <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-semibold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 animate-pulse">
                        <Clock className="w-3 h-3" />
                        <span>Working...</span>
                      </span>
                    )}

                    {step.status === 'needs_approval' && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-300 font-semibold bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Needs Approval</span>
                      </span>
                    )}

                    {step.status === 'failed' && (
                      <span className="flex items-center gap-1 text-[10px] text-rose-400 font-semibold bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30">
                        <XCircle className="w-3 h-3" />
                        <span>Failed</span>
                      </span>
                    )}

                    {step.status === 'pending' && (
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Step Result Content Preview */}
                {step.result && (
                  <div className="mt-2 p-2 rounded-lg bg-slate-900 border border-white/5 text-[11px] text-slate-300 font-mono whitespace-pre-wrap">
                    {step.result}
                  </div>
                )}

                {/* Verification Evidence */}
                {step.verificationEvidence && (
                  <div className="mt-1.5 flex items-start gap-1 text-[10px] text-emerald-300/90 bg-emerald-950/20 px-2 py-1 rounded border border-emerald-500/20">
                    <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{step.verificationEvidence}</span>
                  </div>
                )}

                {/* Specific Action Confirmation Card if step requires phone intent launch */}
                {step.actionPayload && step.status === 'needs_approval' && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <ActionConfirmationCard
                      action={step.actionPayload}
                      onExecute={(updated) => {
                        if (onExecuteAction) onExecuteAction(updated);
                        if (onApproveStep) onApproveStep(step.id);
                      }}
                      onCancel={() => {
                        if (onApproveStep) onApproveStep(step.id);
                      }}
                      savedContacts={savedContacts}
                      onOpenContactsPicker={onOpenContactsPicker}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Verified Evidence Disclosure */}
      {workflow.verifiedItems && workflow.verifiedItems.length > 0 && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => setIsEvidenceExpanded(!isEvidenceExpanded)}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/5 text-[11px] text-slate-300 font-semibold transition-all"
          >
            <div className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Evidence ({workflow.verifiedItems.length} items verified)</span>
            </div>
            {isEvidenceExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {isEvidenceExpanded && (
            <div className="mt-1.5 p-2.5 rounded-xl bg-slate-950/90 border border-emerald-500/20 space-y-1 text-[11px] text-slate-300">
              {workflow.verifiedItems.map((v, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Final Review & Approval Controls */}
      {isFinalReview && (
        <div className="p-3 bg-gradient-to-t from-slate-950 to-slate-900 border-t border-amber-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Final Review Required</span>
            </span>
            <span className="text-[10px] text-slate-400">
              {needsApprovalSteps > 0 ? `${needsApprovalSteps} pending approval` : 'Ready to finalize'}
            </span>
          </div>

          <p className="text-[11px] text-slate-300 mb-3">
            Angel has prepared the content and verified all parameters. Please confirm to finalize changes into your notes and tasks.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onApproveAll && onApproveAll(workflow.id)}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve & Finalize All</span>
            </button>
            <button
              type="button"
              onClick={() => onRejectWorkflow && onRejectWorkflow(workflow.id)}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isAllCompleted && (
        <div className="p-2.5 bg-emerald-950/40 border-t border-emerald-500/30 text-center text-xs text-emerald-300 flex items-center justify-center gap-1.5 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Workflow completed & all items synchronized.</span>
        </div>
      )}
    </div>
  );
};
