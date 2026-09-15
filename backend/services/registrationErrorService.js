const crypto = require('crypto');
const prisma = require('../db/prisma');

/**
 * Refused player registrations.
 *
 * Before this, a refusal left no trace: the API answered "Failed to register
 * player!", the form showed exactly that, and the only way to learn why was to
 * match response byte sizes in the nginx log against player-name lengths. Now
 * every refusal gets a row and a short id the player sees on the form, and the
 * form shows the actual reason.
 */

// No 0/O/1/I, so an id read out over the phone survives.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const newErrorId = () => {
    const bytes = crypto.randomBytes(6);
    let id = '';
    for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
    return `RG-${id}`;
};

const clip = (value, max) => {
    if (value === undefined || value === null || value === '') return null;
    return String(value).slice(0, max);
};

/** What the player is told for each kind of refusal. */
const friendlyMessage = (code, { name, maxMb } = {}) => {
    switch (code) {
        case 'DUPLICATE_NAME':
            return `${name ? `"${name}"` : 'This player'} is already registered for this tournament. You don't need to register again — contact the organiser if something needs changing.`;
        case 'FILE_TOO_LARGE':
            return `A photo or screenshot is too large. Each file must be under ${maxMb || 10} MB — please choose a smaller image and try again.`;
        case 'UPLOAD_FAILED':
            return 'Your photo or screenshot could not be uploaded. Please try again, or choose a different image.';
        case 'MISSING_TOURNAMENT':
        case 'TOURNAMENT_NOT_FOUND':
            return 'This registration link is not valid. Please ask the organiser for the correct link.';
        case 'NETWORK':
            return 'Could not reach the server. Please check your internet connection and try again.';
        default:
            return 'Registration could not be completed. Please try again.';
    }
};

/** Sort a thrown error into a code the form and the table can both use. */
const classify = (error) => {
    const msg = String(error?.message || error || '');
    const lower = msg.toLowerCase();
    if (error?.code === 'LIMIT_FILE_SIZE' || lower.includes('file too large')) return 'FILE_TOO_LARGE';
    if (error?.name === 'MulterError' || lower.includes('s3') || lower.includes('upload')) return 'UPLOAD_FAILED';
    if (lower.includes('already registered')) return 'DUPLICATE_NAME';
    if (lower.includes('tournament id is required')) return 'MISSING_TOURNAMENT';
    if (lower.includes('foreign key') || lower.includes('tournament not found')) return 'TOURNAMENT_NOT_FOUND';
    return 'UNKNOWN';
};

const requestMeta = (req) => ({
    ipAddress: clip(
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || req.ip,
        64
    ),
    userAgent: clip(req.headers['user-agent'], 400),
});

/**
 * Store one refusal and log it. Never throws: failing to record an error must
 * not turn into a second error for the player.
 *
 * @returns {Promise<string>} the error id to show the player
 */
const record = async ({ req, code, message, source = 'server', httpStatus, tournamentId, name, mobile, details }) => {
    const errorId = newErrorId();
    const meta = req ? requestMeta(req) : {};

    console.warn(
        `[registration] refused ${errorId} code=${code} source=${source} status=${httpStatus ?? '-'} ` +
        `tournament=${tournamentId || '-'} name=${JSON.stringify(name || '')} ip=${meta.ipAddress || '-'} ` +
        `reason=${JSON.stringify(String(message || '').slice(0, 200))}`
    );

    try {
        await prisma.registrationError.create({
            data: {
                errorId,
                code: clip(code, 40) || 'UNKNOWN',
                message: clip(message, 1000) || '',
                source,
                httpStatus: Number.isInteger(httpStatus) ? httpStatus : null,
                tournamentId: clip(tournamentId, 64),
                name: clip(name, 200),
                mobile: clip(mobile, 32),
                details: details && typeof details === 'object' ? details : undefined,
                ...meta,
            },
        });
    } catch (dbErr) {
        console.error(`[registration] could not store ${errorId}:`, dbErr.message);
    }

    return errorId;
};

module.exports = { record, classify, friendlyMessage };
