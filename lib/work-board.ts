import { LABEL_PREFIX, LABELS } from '@/lib/brand';
import { isLowRisk as isLowRiskFor } from '@/shared/ticket-risk';

const isLowRisk = (labels: string[]) => isLowRiskFor(labels, LABEL_PREFIX);

export type WorkCard = {
  id: string; title: string; number: number; repo: string; projectId: string; htmlUrl: string;
  stage: string; githubState: string; labels: string[]; assignedAgentId: string | null;
  agentName: string | null; automationSlot: number | null; runStatus: string | null;
  runId: string | null; startedAt: string | null; finishedAt: string | null; pullRequestUrl: string | null;
  completionPending?: boolean;
  waitingReason?: string | null;
};

export function workLane(card: WorkCard) {
  if (card.runStatus === 'running' || card.stage === 'in_progress') return card.waitingReason ? 'waiting' : 'running';
  if (card.stage === 'done' || card.githubState !== 'open') return 'done';
  if (card.runStatus === 'failed') return 'attention';
  if (card.stage === 'review' || card.runStatus === 'succeeded') return 'review';
  // Stopped attempts require a manual decision, just like automationCandidates.
  if (card.runStatus === 'cancelled') return 'intake';
  // A queued attempt is queued.
  const blockingRun = card.runId && card.runStatus !== 'cancelled' && card.runStatus !== 'queued';
  if (card.labels.some((label) => label.toLowerCase() === LABELS.ready) && ['intake', 'assigned'].includes(card.stage) && !blockingRun && (!card.assignedAgentId || card.automationSlot)) return 'queued';
  return 'intake';
}
export function workReason(card: WorkCard) {
  const lane = workLane(card);
  if (lane === 'waiting') return card.waitingReason!;
  if (lane === 'running') return card.completionPending
    ? (isLowRisk(card.labels) ? 'CI green. Merging low-risk PR and closing GitHub issue.' : `CI green. Syncing ${LABELS.done} and closing GitHub issue.`)
    : (card.pullRequestUrl
      ? (isLowRisk(card.labels) ? 'PR ready. Monitoring CI. Low risk merges when green, then watches the default branch pipeline.' : 'PR ready. Monitoring CI and fixing failures before closing the ticket.')
      : 'Codex is working in an isolated worker.');
  if (lane === 'attention') return 'Previous run failed. Review and restart manually.';
  if (lane === 'review') return isLowRisk(card.labels)
    ? 'Implementation finished. Low-risk merge did not complete; review the pull request.'
    : 'Implementation finished. Review the result and pull request.';
  if (lane === 'done') return card.githubState === 'closed' ? 'GitHub issue closed.' : 'Marked done.';
  if (card.runStatus === 'cancelled') return 'Run stopped. Automatic recovery disabled. Move or restart the ticket from its project board.';
  if (!card.labels.some((label) => label.toLowerCase() === LABELS.ready)) return `Add ${LABELS.ready} on GitHub to request automatic pickup.`;
  if (card.assignedAgentId && !card.automationSlot) return 'Assigned to another agent. Start manually or unassign for automatic pickup.';
  return 'Waiting for an available Factory agent and enabled subscription.';
}
