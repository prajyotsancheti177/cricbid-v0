/**
 * Shared column matching for the Google Sheets integration.
 *
 * Both directions of the sync depend on lining a sheet's header row up with
 * the tournament's registration config, and they must agree: if the reader and
 * the writer disagree about which column is which, an export silently writes
 * values under the wrong headers. Keeping the logic in one place is what stops
 * that. See getSyncDiff (sheet -> DB) and updateEntireSheetWithPlayers (DB ->
 * sheet).
 */

/** Headers are hand-edited, so compare them trimmed, collapsed, case-folded. */
const norm = (h) => String(h ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Accepted alternatives for the standard fields, for sheets whose headers were
 * renamed by hand. Only consulted after exact label/key matches, so a custom
 * field named e.g. "Category" still wins its own column.
 */
const FIELD_ALIASES = {
    playerCategory: ['category', 'player category', 'playercategory'],
    mobile: ['mobile', 'mobile number', 'phone', 'phone number'],
    email: ['email', 'email address'],
    name: ['name', 'player name'],
    age: ['age'],
    gender: ['gender'],
    photo: ['photo', 'photo url'],
    skill: ['skill', 'skills'],
    address: ['address'],
    auctionSerialNumber: ['s.no.', 's.no', 'sno', 'serial', 'serial no', 'serial number'],
};

/** Column headers the exporter writes for the two always-present fields. */
const SERIAL_HEADER = 'S.No.';
const NAME_HEADER = 'Name';
const PLAYER_ID_HEADER = 'Player ID';

/**
 * Maps each column index to the field it holds:
 *   { key, type: 'standard' | 'custom' | 'system' }
 * Columns that match nothing are left out — they belong to the host, not to us.
 */
const buildHeaderMap = (headers, config) => {
    const standardKeys = Object.keys(config?.fields || {});
    const map = {};

    (headers || []).forEach((h, colIdx) => {
        const n = norm(h);
        if (!n) return;

        if (n === norm(SERIAL_HEADER)) { map[colIdx] = { key: 'auctionSerialNumber', type: 'standard' }; return; }
        if (n === norm(NAME_HEADER)) { map[colIdx] = { key: 'name', type: 'standard' }; return; }
        if (n === norm(PLAYER_ID_HEADER)) { map[colIdx] = { key: '_id', type: 'system' }; return; }

        // 1. exact label or key on a configured standard field
        let found = standardKeys.find(k => norm(config.fields[k].label) === n || norm(k) === n);
        if (found) { map[colIdx] = { key: found, type: 'standard' }; return; }

        // 2. exact label on a custom field
        const cfMatch = (config?.customFields || []).find(cf => norm(cf.label) === n);
        if (cfMatch) { map[colIdx] = { key: cfMatch.id, type: 'custom' }; return; }

        // 3. a known alias for a standard field
        found = Object.keys(FIELD_ALIASES).find(k => FIELD_ALIASES[k].includes(n));
        if (found) map[colIdx] = { key: found, type: 'standard' };
    });

    return map;
};

/** Every column headed "Player ID". A sheet can carry more than one. */
const findIdColumns = (headers) =>
    (headers || []).reduce((acc, h, i) => (norm(h) === norm(PLAYER_ID_HEADER) ? acc.concat(i) : acc), []);

/**
 * Picks the column that actually holds player ids. A custom field whose label
 * happens to be "Player ID" can sit to the left of the real one, so prefer the
 * column whose values match known players; the exporter always appends the real
 * one last, which is the fallback when nothing matches (e.g. an empty sheet).
 *
 * @param {string[][]} dataRows rows below the header
 * @param {(id: string) => boolean} isKnownId
 * @returns {number} column index, or -1 when the sheet has no id column
 */
const resolveIdColumn = (headers, dataRows, isKnownId) => {
    const idColumns = findIdColumns(headers);
    if (idColumns.length === 0) return -1;
    if (idColumns.length === 1) return idColumns[0];

    const scored = idColumns.map(idx => ({
        idx,
        hits: (dataRows || []).filter(r => r && isKnownId(String(r[idx] || '').trim())).length,
    }));
    const best = scored.reduce((a, b) => (b.hits > a.hits ? b : a));
    return best.hits > 0 ? best.idx : idColumns[idColumns.length - 1];
};

/** Standard fields the exporter can write, in the order it lays them out. */
const STANDARD_FIELD_ORDER = ['age', 'gender', 'photo', 'mobile', 'email', 'skill', 'address', 'playerCategory'];

/**
 * The columns this export owns, left to right, for a given config:
 * S.No., Name, every enabled standard field, every custom field, Player ID.
 *
 * Both the header row and the data rows are built from this one list, which is
 * what stops them disagreeing — a disabled field used to shorten the data rows
 * without shortening the headers, shifting every later value a column left.
 */
const buildColumnPlan = (config) => {
    const plan = [
        { header: SERIAL_HEADER, key: 'auctionSerialNumber', type: 'standard' },
        { header: NAME_HEADER, key: 'name', type: 'standard' },
    ];

    STANDARD_FIELD_ORDER.forEach((f) => {
        const field = config?.fields?.[f];
        if (field && field.enabled) plan.push({ header: field.label || f, key: f, type: 'standard' });
    });

    (config?.customFields || []).forEach((cf) => {
        plan.push({ header: cf.label, key: cf.id, type: 'custom' });
    });

    plan.push({ header: PLAYER_ID_HEADER, key: '_id', type: 'system' });
    return plan;
};

/** Reads one field off a player, handling Mongoose Map and Prisma JSON alike. */
const readPlayerValue = (player, { key, type }) => {
    if (type === 'system' || key === '_id') {
        return player._id ? player._id.toString() : (player.id || '');
    }
    if (type === 'custom') {
        const cv = player.customFields;
        const val = cv ? (typeof cv.get === 'function' ? cv.get(key) : cv[key]) : undefined;
        return val !== undefined && val !== null ? val : '';
    }
    return player[key] !== undefined && player[key] !== null ? player[key] : '';
};

/** 0 -> A, 25 -> Z, 26 -> AA. */
const columnLetter = (index) => {
    let n = index, letters = '';
    do {
        letters = String.fromCharCode(65 + (n % 26)) + letters;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return letters;
};

module.exports = {
    norm,
    STANDARD_FIELD_ORDER,
    buildColumnPlan,
    FIELD_ALIASES,
    SERIAL_HEADER,
    NAME_HEADER,
    PLAYER_ID_HEADER,
    buildHeaderMap,
    findIdColumns,
    resolveIdColumn,
    readPlayerValue,
    columnLetter,
};
