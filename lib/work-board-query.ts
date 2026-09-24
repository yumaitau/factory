import 'server-only';
import { desc, eq, sql } from 'drizzle-orm';
import { agents, codexAccounts, projects, runs, tickets } from '@/db/schema';
import { getDb } from '@/lib/db';
import { runWaitReason } from '@/lib/run-wait';
import type { WorkCard } from '@/lib/work-board';

/** One malformed labels row must not break the whole board. */
function parseLabels(labels: string | null): string[] {
  if (!labels) return [];
  try {
    const parsed: unknown = JSON.parse(labels);
    return Array.isArray(parsed) ? parsed.filter((label): label is string => typeof label === 'string') : [];
  } catch {
    return [];
  }
}

export async function workBoardCards(): Promise<WorkCard[]> {
  const db = await getDb();
  const rows = await db.select({ ticket: tickets, repo: projects.repoFullName, agent: agents, run: runs, account: codexAccounts })
    .from(tickets).innerJoin(projects, eq(tickets.projectId, projects.id))
    .leftJoin(agents, eq(tickets.assignedAgentId, agents.id))
    .leftJoin(runs, sql`${runs.id} = (select latest.id from runs latest where latest.ticket_id = ${tickets.id} order by latest.created_at desc, latest.id desc limit 1)`)
    .leftJoin(codexAccounts, eq(runs.codexAccountId, codexAccounts.id))
    .where(eq(projects.status, 'active')).orderBy(desc(tickets.updatedAt)).all();
  return rows.map(({ ticket, repo, agent, run, account }) => ({
    id: ticket.id, title: ticket.title, number: ticket.githubIssueNumber, repo, projectId: ticket.projectId,
    htmlUrl: ticket.htmlUrl, stage: ticket.stage, githubState: ticket.githubState,
    labels: parseLabels(ticket.labels), assignedAgentId: ticket.assignedAgentId,
    agentName: agent?.name ?? null, automationSlot: agent?.automationSlot ?? null,
    runStatus: run?.status ?? null, runId: run?.id ?? null,
    waitingReason: run?.status === 'running' ? runWaitReason(run.id, account) : null,
    completionPending: run?.status === 'running' && !!run.log?.startsWith('CI green;'),
    startedAt: run?.startedAt?.toISOString() ?? null, finishedAt: run?.finishedAt?.toISOString() ?? null,
    pullRequestUrl: run?.pullRequestUrl ?? null,
  }));
}
