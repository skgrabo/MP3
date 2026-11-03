const mongoose = require('mongoose');

class ApiError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

function badRequest(message) {
    throw new ApiError(400, message);
}

function isObjectId(value) {
    return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

function validateBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        badRequest('Request body must be a JSON object.');
    }
    return body;
}

function requiredString(value, field) {
    if (typeof value !== 'string' || value.trim() === '') {
        badRequest(`${field} is required and must be a non-empty string.`);
    }
    return value.trim();
}

function requiredEmail(value) {
    const email = requiredString(value, 'email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        badRequest('email must be a valid email address.');
    }
    return email;
}

function optionalString(value, field, fallback) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string') badRequest(`${field} must be a string.`);
    return value;
}

function requiredDate(value) {
    if (typeof value !== 'string' || value.trim() === '' || !Number.isFinite(Date.parse(value))) {
        badRequest('deadline is required and must be a valid date.');
    }
    return new Date(value);
}

function optionalBoolean(value, field, fallback) {
    if (value === undefined) return fallback;
    if (typeof value !== 'boolean') badRequest(`${field} must be a boolean.`);
    return value;
}

function validatePendingTaskIds(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value)) badRequest('pendingTasks must be an array of task ids.');
    for (const id of value) {
        if (!isObjectId(id)) badRequest('Each pendingTasks entry must be a valid task id.');
    }
    return [...new Set(value.map(id => id.toLowerCase()))];
}

function validateAssignedUser(value) {
    if (value === undefined || value === '') return '';
    if (!isObjectId(value)) badRequest('assignedUser must be a valid user id.');
    return value.toLowerCase();
}

function sendError(res, error) {
    if (error instanceof ApiError) {
        return res.status(error.statusCode).json({ message: error.message, data: null });
    }
    if (error?.code === 11000) {
        return res.status(400).json({ message: 'A user with this email already exists.', data: null });
    }
    if (error?.name === 'ValidationError' || error?.name === 'CastError') {
        return res.status(400).json({ message: 'The request contains invalid field values.', data: null });
    }
    return res.status(500).json({ message: 'An unexpected server error occurred.', data: null });
}

function validUrlId(id) {
    return isObjectId(id) && mongoose.isValidObjectId(id);
}

module.exports = {
    ApiError,
    badRequest,
    isObjectId,
    validateBody,
    requiredString,
    requiredEmail,
    optionalString,
    requiredDate,
    optionalBoolean,
    validatePendingTaskIds,
    validateAssignedUser,
    sendError,
    validUrlId
};
