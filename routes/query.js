function invalidQuery(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function parseJsonObject(value, parameter) {
    if (typeof value !== 'string') {
        throw invalidQuery(`${parameter} must be a JSON object.`);
    }

    let parsed;
    try {
        parsed = JSON.parse(value);
    } catch {
        throw invalidQuery(`${parameter} must be valid JSON.`);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw invalidQuery(`${parameter} must be a JSON object.`);
    }

    return parsed;
}

function parseProjection(value) {
    if (value === undefined) return undefined;

    const projection = parseJsonObject(value, 'select');
    for (const [field, direction] of Object.entries(projection)) {
        if (!field || (direction !== 0 && direction !== 1)) {
            throw invalidQuery('select values must be 1 or 0.');
        }
    }

    const values = Object.entries(projection);
    const includes = values.some(([field, direction]) => field !== '_id' && direction === 1);
    const excludes = values.some(([field, direction]) => field !== '_id' && direction === 0);
    if (includes && excludes) {
        throw invalidQuery('select cannot mix included and excluded fields.');
    }

    return projection;
}

function parseCollectionQuery(query, defaultLimit) {
    const where = query.where === undefined ? {} : parseJsonObject(query.where, 'where');
    const sort = query.sort === undefined ? undefined : parseJsonObject(query.sort, 'sort');
    const select = parseProjection(query.select);

    if (sort) {
        for (const direction of Object.values(sort)) {
            if (direction !== 1 && direction !== -1) {
                throw invalidQuery('sort values must be 1 or -1.');
            }
        }
    }

    const parseInteger = (value, parameter, defaultValue) => {
        if (value === undefined) return defaultValue;
        if (typeof value !== 'string' || !/^\d+$/.test(value)) {
            throw invalidQuery(`${parameter} must be a non-negative integer.`);
        }
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed)) {
            throw invalidQuery(`${parameter} must be a non-negative integer.`);
        }
        return parsed;
    };

    const skip = parseInteger(query.skip, 'skip', 0);
    const limit = parseInteger(query.limit, 'limit', defaultLimit);
    if (query.count !== undefined && query.count !== 'true' && query.count !== 'false') {
        throw invalidQuery('count must be true or false.');
    }

    return { where, sort, select, skip, limit, count: query.count === 'true' };
}

module.exports = { parseCollectionQuery, parseProjection };
