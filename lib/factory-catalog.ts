import { APP_NAME } from '@/lib/brand';
import { appUrl, paperboyConfig } from '@/lib/env';

export type FactoryOperation = {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  mcp: string | null;
  auth: boolean;
  mutating: boolean;
  description: string;
  input?: Record<string, unknown>;
};

export const FACTORY_OPERATIONS: FactoryOperation[] = [
  { id: 'listCapabilities', method: 'GET', path: '', mcp: 'factory_list_capabilities', auth: false, mutating: false,
    description: 'List Factory HTTP routes and MCP tools.' },
  { id: 'getOpenApi', method: 'GET', path: 'openapi.json', mcp: null, auth: false, mutating: false,
    description: 'OpenAPI 3.1 document for the Factory HTTP API.' },
  { id: 'getStatus', method: 'GET', path: 'status', mcp: 'factory_get_status', auth: true, mutating: false,
    description: 'PaperBoy, API-key, and last digest status.' },
  { id: 'listOutstanding', method: 'GET', path: 'outstanding', mcp: 'factory_list_outstanding', auth: true, mutating: false,
    description: 'Work-board items that are not done, plus open Factory PRs.' },
  { id: 'listWork', method: 'GET', path: 'work', mcp: 'factory_list_work', auth: true, mutating: false,
    description: 'Full live work-board cards.' },
  { id: 'listReviewQueue', method: 'GET', path: 'work/review', mcp: 'factory_list_review_queue', auth: true, mutating: false,
    description: 'Open Factory pull requests still waiting for review.' },
  { id: 'listProjects', method: 'GET', path: 'projects', mcp: 'factory_list_projects', auth: true, mutating: false,
    description: 'Active connected GitHub repositories.' },
  { id: 'listTickets', method: 'GET', path: 'tickets', mcp: 'factory_list_tickets', auth: true, mutating: false,
    description: 'Tickets on active projects. Optional projectId filter.',
    input: { type: 'object', properties: { projectId: { type: 'string' } }, additionalProperties: false } },
  { id: 'getTicket', method: 'GET', path: 'tickets/{ticketId}', mcp: 'factory_get_ticket', auth: true, mutating: false,
    description: 'One ticket with project and assignee, without GitHub installation tokens.',
    input: { type: 'object', properties: { ticketId: { type: 'string' } }, required: ['ticketId'], additionalProperties: false } },
  { id: 'listAgents', method: 'GET', path: 'agents', mcp: 'factory_list_agents', auth: true, mutating: false,
    description: 'Factory agents and owners.' },
  { id: 'getRun', method: 'GET', path: 'runs/{runId}', mcp: 'factory_get_run', auth: true, mutating: false,
    description: 'One run without execution logs.',
    input: { type: 'object', properties: { runId: { type: 'string' } }, required: ['runId'], additionalProperties: false } },
  { id: 'getAutomation', method: 'GET', path: 'automation', mcp: 'factory_get_automation', auth: true, mutating: false,
    description: 'Background worker pool status.' },
  { id: 'enqueuePickup', method: 'POST', path: 'automation/pickup', mcp: 'factory_enqueue_pickup', auth: true, mutating: true,
    description: 'Queue a pickup if the background worker is enabled.' },
  { id: 'previewDigest', method: 'GET', path: 'digest', mcp: 'factory_preview_digest', auth: true, mutating: false,
    description: 'Render the outstanding digest without sending mail.' },
  { id: 'sendDigest', method: 'POST', path: 'digest', mcp: 'factory_send_digest', auth: true, mutating: true,
    description: 'Send the outstanding digest through PaperBoy.',
    input: { type: 'object', properties: { force: { type: 'boolean' } }, additionalProperties: false } },
];

export function factoryCapabilities() {
  return {
    name: 'factory',
    baseUrl: appUrl(),
    transports: { http: '/api/v1', mcp: '/api/mcp' },
    from: paperboyConfig()?.from ?? null,
    operations: FACTORY_OPERATIONS.map(({ id, method, path, mcp, auth, mutating, description }) => ({
      id, method, path: `/api/v1/${path}`.replace(/\/$/, '') || '/api/v1', mcp, auth, mutating, description,
    })),
  };
}

export function factoryOpenApi() {
  const paths: Record<string, unknown> = {};
  for (const operation of FACTORY_OPERATIONS) {
    const path = `/api/v1/${operation.path}`.replace(/\/$/, '') || '/api/v1';
    const item = (paths[path] as Record<string, unknown>) ?? {};
    item[operation.method.toLowerCase()] = {
      operationId: operation.id,
      summary: operation.description,
      security: operation.auth ? [{ bearerAuth: [] }] : [],
      'x-factory-mcp': operation.mcp,
    };
    paths[path] = item;
  }
  return {
    openapi: '3.1.0',
    info: { title: `${APP_NAME} HTTP API`, version: '1.0.0' },
    servers: [{ url: appUrl() }],
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
    },
    'x-factory-mcp': {
      url: `${appUrl()}/api/mcp`,
      equivalents: Object.fromEntries(FACTORY_OPERATIONS.filter((operation) => operation.mcp).map((operation) => [operation.id, operation.mcp])),
    },
  };
}