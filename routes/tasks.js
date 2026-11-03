const express = require('express');
const router = express.Router();
const Task = require('../models/task');
const User = require('../models/user');
const { parseCollectionQuery, parseProjection } = require('./query');
const {
    ApiError,
    badRequest,
    validateBody,
    requiredString,
    requiredDate,
    optionalString,
    optionalBoolean,
    validateAssignedUser,
    successResponse,
    sendError,
    validUrlId
} = require('./mutationHelpers');

function getTaskFields(body, user) {
    const assignedUser = validateAssignedUser(body.assignedUser);

    if (assignedUser && !user) {
        badRequest('A valid user identity is required to assign a task.');
    }
    if (body.assignedUser !== undefined && body.assignedUser !== '' && assignedUser !== String(user._id).toLowerCase()) {
        badRequest('assignedUser must match the current user.');
    }

    const assignedUserName = optionalString(body.assignedUserName, 'assignedUserName', undefined);
    if (assignedUserName !== undefined && assignedUser === '') {
        if (assignedUserName !== 'unassigned') {
            badRequest('assignedUserName must be "unassigned" when the task is unassigned.');
        }
    } else if (assignedUserName !== undefined && assignedUserName !== user.name) {
        badRequest('assignedUserName must match the current user name.');
    }

    return {
        name: requiredString(body.name, 'name'),
        description: optionalString(body.description, 'description', ''),
        deadline: requiredDate(body.deadline),
        completed: optionalBoolean(body.completed, 'completed', false),
        assignedUser: assignedUser || '',
        assignedUserName: assignedUser ? user.name : 'unassigned'
    };
}

async function getRequestUser(req) {
    const userId = req.get('X-User-Id');
    if (!validUrlId(userId)) {
        throw new ApiError(400, 'A valid user identity is required.');
    }
    const user = await User.findById(userId);
    if (!user) throw new ApiError(400, 'A valid user identity is required.');
    return user;
}

function isLocalUnscopedTaskRequest(req) {
    if (req.baseUrl !== '/api/tasks' || req.get('X-User-Id')) return false;
    const address = req.socket.remoteAddress || '';
    return address === '::1' || address.startsWith('127.') || address.startsWith('::ffff:127.');
}

async function syncTaskAssignment(task, previousUserId, assignedUser) {
    const taskId = String(task._id);
    if (previousUserId && (previousUserId !== assignedUser?._id.toString() || task.completed || !assignedUser)) {
        await User.updateOne({ _id: previousUserId }, { $pull: { pendingTasks: taskId } });
    }
    if (assignedUser && !task.completed) {
        await User.updateOne(
            { _id: assignedUser._id },
            { $addToSet: { pendingTasks: taskId } }
        );
    }
}

router.get('/', async (req, res) => {
    try {
        const user = isLocalUnscopedTaskRequest(req) ? null : await getRequestUser(req);
        const options = parseCollectionQuery(req.query, 100);
        const filter = {
            ...options.where,
            ...(user ? { assignedUser: String(user._id) } : {})
        };
        if (options.count) {
            const count = await Task.countDocuments(filter);
            return successResponse(res, count, 200, 'OK');
        }
        if (options.limit === 0) {
            return successResponse(res, [], 200, 'OK');
        }

        const query = Task.find(filter);
        if (options.sort) query.sort(options.sort);
        if (options.select) query.select(options.select);
        if (options.skip) query.skip(options.skip);
        if (options.limit !== undefined) query.limit(options.limit);
        const tasks = await query;
        return successResponse(res, tasks, 200, 'OK');
    } catch (err) {
        const status = err.statusCode || (err.name === 'CastError' ? 400 : 500);
        res.status(status).json({ message: err.message, data: null });
    }
});

router.post('/', async (req, res) => {
    try {
        const user = req.get('X-User-Id') ? await getRequestUser(req) : null;
        const body = validateBody(req.body);
        const fields = getTaskFields(body, user);
        const task = await new Task(fields).save();
        await syncTaskAssignment(task, null, user);
        return successResponse(res, task, 201, 'Task created successfully.');
    } catch (err) {
        sendError(res, err);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const user = await getRequestUser(req);
        const projection = parseProjection(req.query.select);
        const task = await Task.findOne({ _id: req.params.id, assignedUser: String(user._id) }).select(projection);
        if (!task) {
            return res.status(404).json({ message: 'Task not found', data: null });
        }
        return successResponse(res, task, 200, 'OK');
    } catch (err) {
        const status = err.statusCode || (err.name === 'CastError' ? 404 : 500);
        res.status(status).json({ message: err.message, data: null });
    }
});

router.put('/:id', async (req, res) => {
    try {
        if (!validUrlId(req.params.id)) throw new ApiError(404, 'Task not found.');
        const task = await Task.findById(req.params.id);
        if (!task) {
            throw new ApiError(404, 'Task not found.');
        }

        const user = await getRequestUser(req);
        if (task.assignedUser !== String(user._id)) {
            throw new ApiError(404, 'Task not found.');
        }

        const body = validateBody(req.body);
        const fields = getTaskFields(body, user);
        const previousUserId = task.assignedUser;
        Object.assign(task, fields);
        await task.save();
        await syncTaskAssignment(task, previousUserId, user);
        return successResponse(res, task, 200, 'Task updated successfully.');
    } catch (err) {
        sendError(res, err);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const user = await getRequestUser(req);
        if (!validUrlId(req.params.id)) throw new ApiError(404, 'Task not found.');
        const existing = await Task.findOne({ _id: req.params.id, assignedUser: String(user._id) });
        if (!existing) throw new ApiError(404, 'Task not found.');
        if (existing.assignedUser) {
            await User.updateOne(
                { _id: existing.assignedUser },
                { $pull: { pendingTasks: String(existing._id) } }
            );
        }
        const task = await Task.findOneAndDelete({ _id: req.params.id, assignedUser: String(user._id) });
        return successResponse(res, task, 200, 'Task deleted successfully.');
    } catch (err) {
        sendError(res, err);
    }
});

module.exports = router;