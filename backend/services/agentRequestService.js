const prisma = require('../db/prisma');

/**
 * Requests typed into the Assistant page.
 *
 * The flow is deliberately two-stage: an agent reads the request and writes a
 * plan, a person approves that plan, and only then does anything run. Nothing
 * here executes a request — the runner does, and reports back. This module is
 * the queue and the audit trail.
 */

const STATUSES = [
    'pending',            // typed in, nobody has looked at it yet
    'planning',           // a runner has claimed it and is working out the plan
    'awaiting_approval',  // plan is ready and on screen
    'approved',           // a human said yes; waiting for the runner to execute
    'running',            // being executed
    'done',
    'failed',
    'rejected',
    'cancelled',
];

/** What a caller may see: never the raw error stack, which can carry paths. */
const serialize = (row) => ({
    _id: row.id,
    tournamentId: row.tournamentId,
    requestText: row.requestText,
    kind: row.kind,
    status: row.status,
    plan: row.plan ?? null,
    result: row.result ?? null,
    error: row.error ?? null,
    createdByUserId: row.createdByUserId,
    approvedByUserId: row.approvedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy ? (row.createdBy.name || row.createdBy.email) : null,
    approvedBy: row.approvedBy ? (row.approvedBy.name || row.approvedBy.email) : null,
    tournamentName: row.tournament?.name ?? null,
});

/**
 * Names are resolved by hand rather than by relation: AgentRequest deliberately
 * has no foreign keys, so a deleted user or tournament can never block the
 * audit trail from being read.
 */
const decorate = async (rows) => {
    const userIds = [...new Set(rows.flatMap(r => [r.createdByUserId, r.approvedByUserId]).filter(Boolean))];
    const tournamentIds = [...new Set(rows.map(r => r.tournamentId).filter(Boolean))];

    const [users, tournaments] = await Promise.all([
        userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [],
        tournamentIds.length ? prisma.tournament.findMany({ where: { id: { in: tournamentIds } }, select: { id: true, name: true } }) : [],
    ]);
    const userById = new Map(users.map(u => [u.id, u]));
    const tournamentById = new Map(tournaments.map(t => [t.id, t]));

    return rows.map(r => serialize({
        ...r,
        createdBy: userById.get(r.createdByUserId) || null,
        approvedBy: userById.get(r.approvedByUserId) || null,
        tournament: tournamentById.get(r.tournamentId) || null,
    }));
};

const create = async ({ requestText, tournamentId, userId }) => {
    const text = String(requestText || '').trim();
    if (!text) throw new Error('Write what you would like done');
    if (text.length > 4000) throw new Error('That request is too long — keep it under 4000 characters');

    const row = await prisma.agentRequest.create({
        data: {
            requestText: text,
            tournamentId: tournamentId ? String(tournamentId) : null,
            createdByUserId: userId || null,
        },
    });
    return (await decorate([row]))[0];
};

const list = async ({ limit = 30, tournamentId } = {}) => {
    const rows = await prisma.agentRequest.findMany({
        where: tournamentId ? { tournamentId: String(tournamentId) } : undefined,
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(Number(limit) || 30, 1), 100),
    });
    return decorate(rows);
};

const detail = async (id) => {
    const row = await prisma.agentRequest.findUnique({ where: { id: String(id) } });
    if (!row) throw new Error('Request not found');
    return (await decorate([row]))[0];
};

/** A human answering the plan. Only a plan that is on screen can be answered. */
const decide = async (id, { approve, userId }) => {
    const row = await prisma.agentRequest.findUnique({ where: { id: String(id) } });
    if (!row) throw new Error('Request not found');
    if (row.status !== 'awaiting_approval') {
        throw new Error(`This request is ${row.status.replace(/_/g, ' ')} — there is no plan waiting to be answered`);
    }
    const updated = await prisma.agentRequest.update({
        where: { id: row.id },
        data: {
            status: approve ? 'approved' : 'rejected',
            approvedByUserId: userId || null,
        },
    });
    return (await decorate([updated]))[0];
};

/** Stop a request that has not run yet. */
const cancel = async (id) => {
    const row = await prisma.agentRequest.findUnique({ where: { id: String(id) } });
    if (!row) throw new Error('Request not found');
    if (['running', 'done'].includes(row.status)) {
        throw new Error('That request is already under way');
    }
    const updated = await prisma.agentRequest.update({ where: { id: row.id }, data: { status: 'cancelled' } });
    return (await decorate([updated]))[0];
};

/* ---------------------------------------------------------------- runner --- */

/**
 * Take the next piece of work, atomically.
 *
 * `mode` is "plan" (pending requests) or "execute" (approved ones). The status
 * is moved as part of the claim so two runners cannot pick up the same row.
 */
const claimNext = async (mode) => {
    const from = mode === 'execute' ? 'approved' : 'pending';
    const to = mode === 'execute' ? 'running' : 'planning';

    const candidate = await prisma.agentRequest.findFirst({
        where: { status: from },
        orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;

    // Guard against a second runner that read the same row a moment ago.
    const claimed = await prisma.agentRequest.updateMany({
        where: { id: candidate.id, status: from },
        data: { status: to },
    });
    if (claimed.count === 0) return null;

    const row = await prisma.agentRequest.findUnique({ where: { id: candidate.id } });
    return (await decorate([row]))[0];
};

/** The runner's proposed plan; puts the request in front of a human. */
const attachPlan = async (id, { plan, kind }) => {
    const row = await prisma.agentRequest.update({
        where: { id: String(id) },
        data: {
            plan: plan ?? null,
            kind: ['data', 'code', 'mixed', 'unknown'].includes(kind) ? kind : 'unknown',
            status: 'awaiting_approval',
        },
    });
    return (await decorate([row]))[0];
};

/** The outcome of an execution, successful or not. */
const finish = async (id, { result, error }) => {
    const row = await prisma.agentRequest.update({
        where: { id: String(id) },
        data: {
            result: result ?? null,
            error: error ? String(error).slice(0, 2000) : null,
            status: error ? 'failed' : 'done',
        },
    });
    return (await decorate([row]))[0];
};

/** A runner that cannot plan a request hands it back rather than stranding it. */
const fail = async (id, message) => {
    const row = await prisma.agentRequest.update({
        where: { id: String(id) },
        data: { status: 'failed', error: String(message || 'Could not be planned').slice(0, 2000) },
    });
    return (await decorate([row]))[0];
};

module.exports = {
    STATUSES,
    create,
    list,
    detail,
    decide,
    cancel,
    claimNext,
    attachPlan,
    finish,
    fail,
};
