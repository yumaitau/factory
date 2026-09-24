import 'server-only';

import { enqueuePickup } from '@/lib/automation-queue';
import { automationStatus } from '@/lib/automation-state';
import { factoryApiKey, paperboyConfig } from '@/lib/env';
import { factoryCapabilities, factoryOpenApi } from '@/lib/factory-catalog';
import { latestDigestSend, previewDigest, sendOutstandingDigest } from '@/lib/digest';
import { outstandingSnapshot } from '@/lib/outstanding-query';
import {
  getRun,
  getTicketWithContext,
  listAgentsWithOwners,
  listProjects,
  listTicketsForProject,
} from '@/lib/queries';
import { workBoardCards } from '@/lib/work-board-query';
import { outstandingPullRequests } from '@/lib/work-review-query';

export class FactoryApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function runFactoryOperation(id: string, args: Record<string, unknown> = {}): Promise<unknown> {
  switch (id) {
    case 'listCapabilities':
      return factoryCapabilities();
    case 'getOpenApi':
      return factoryOpenApi();
    case 'getStatus': {
      const last = await latestDigestSend();
      return {
        ok: true,
        paperboy: !!paperboyConfig(),
        factoryApiKey: !!factoryApiKey(),
        digest: last ? {
          sydneyDate: last.sydneyDate,
          sentAt: last.sentAt.toISOString(),
          messageId: last.messageId,
          recipientCount: last.recipientCount,
          error: last.error,
        } : null,
      };
    }
    case 'listOutstanding':
      return outstandingSnapshot();
    case 'listWork':
      return { cards: await workBoardCards() };
    case 'listReviewQueue':
      return outstandingPullRequests();
    case 'listProjects': {
      const projects = await listProjects();
      return {
        projects: projects.map((project) => ({
          id: project.id,
          repo: project.repoFullName,
          defaultBranch: project.defaultBranch,
          description: project.description,
          private: project.private,
          status: project.status,
          issuesSyncedAt: project.issuesSyncedAt?.toISOString() ?? null,
        })),
      };
    }
    case 'listTickets': {
      const projectId = stringArg(args, 'projectId');
      if (projectId) {
        const tickets = await listTicketsForProject(projectId);
        return { tickets };
      }
      return { cards: await workBoardCards() };
    }
    case 'getTicket': {
      const ticketId = stringArg(args, 'ticketId');
      if (!ticketId) throw new FactoryApiError(400, 'ticketId is required.');
      const context = await getTicketWithContext(ticketId);
      if (!context) throw new FactoryApiError(404, 'Ticket not found.');
      return {
        ticket: context.ticket,
        repo: context.project.repoFullName,
        agent: context.agent ? { id: context.agent.id, name: context.agent.name, status: context.agent.status } : null,
      };
    }
    case 'listAgents':
      return { agents: await listAgentsWithOwners() };
    case 'getRun': {
      const runId = stringArg(args, 'runId');
      if (!runId) throw new FactoryApiError(400, 'runId is required.');
      const run = await getRun(runId);
      if (!run) throw new FactoryApiError(404, 'Run not found.');
      return {
        run: {
          id: run.id,
          ticketId: run.ticketId,
          agentId: run.agentId,
          status: run.status,
          sandboxId: run.sandboxId,
          modelId: run.modelId,
          pullRequestUrl: run.pullRequestUrl,
          inputTokens: run.inputTokens,
          outputTokens: run.outputTokens,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          createdAt: run.createdAt,
          waitingReason: run.waitingReason,
        },
      };
    }
    case 'getAutomation':
      return { automation: await automationStatus() };
    case 'enqueuePickup':
      await enqueuePickup('API pickup');
      return { ok: true };
    case 'previewDigest':
      return previewDigest();
    case 'sendDigest':
      return sendOutstandingDigest({ force: args.force === true });
    default:
      throw new FactoryApiError(404, 'Unknown operation.');
  }
}