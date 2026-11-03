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

async function getTaskFields(body) {
    const assignedUserId = validateAssignedUser(body.assignedUser);
    const assignedUser = assignedUserId ? await User.findById(assignedUserId) : null;
    if (assignedUserId && !assignedUser) {
        throw new ApiError(404, 'The assigned user was not found.');
    }
    const assignedUserName = optionalString(body.assignedUserName, 'assignedUserName', undefined);
    const expectedAssignedUserName = assignedUser ? assignedUser.name : 'unassigned';
    if (assignedUserName !== undefined && assignedUserName !== expectedAssignedUserName) {
        badRequest('assignedUserName must match assignedUser.');
    }

    return {
        fields: {
            name: requiredString(body.name, 'name'),
            description: optionalString(body.description, 'description', ''),
            deadline: requiredDate(body.deadline),
            completed: optionalBoolean(body.completed, 'completed', false),
            assignedUser: assignedUser ? String(assignedUser._id) : '',
            assignedUserName: expectedAssignedUserName
        },
        assignedUser
    };
}

async function getOptionalRequestUser(req) {
    const userId = req.get('X-User-Id');
    if (!validUrlId(userId)) return null;
    return User.findById(userId);
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
        const user = await getOptionalRequestUser(req);
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
        const body = validateBody(req.body);
        const { fields, assignedUser } = await getTaskFields(body);
        const task = await new Task(fields).save();
        await syncTaskAssignment(task, null, assignedUser);
        return successResponse(res, task, 201, 'Task created successfully.');
    } catch (err) {
        sendError(res, err);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const user = await getOptionalRequestUser(req);
        const projection = parseProjection(req.query.select);
        const filter = user
            ? { _id: req.params.id, assignedUser: String(user._id) }
            : { _id: req.params.id };
        const query = Task.findOne(filter);
        if (projection) query.select(projection);
        const task = await query;
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
        const user = await getOptionalRequestUser(req);
        const filter = user
            ? { _id: req.params.id, assignedUser: String(user._id) }
            : { _id: req.params.id };
        const task = await Task.findOne(filter);
        if (!task) {
            throw new ApiError(404, 'Task not found.');
        }

        const body = validateBody(req.body);
        const { fields, assignedUser } = await getTaskFields(body);
        const previousUserId = task.assignedUser;
        Object.assign(task, fields);
        await task.save();
        await syncTaskAssignment(task, previousUserId, assignedUser);
        return successResponse(res, task, 200, 'Task updated successfully.');
    } catch (err) {
        sendError(res, err);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        if (!validUrlId(req.params.id)) throw new ApiError(404, 'Task not found.');
        const user = await getOptionalRequestUser(req);
        const filter = user
            ? { _id: req.params.id, assignedUser: String(user._id) }
            : { _id: req.params.id };
        const existing = await Task.findOne(filter);
        if (!existing) throw new ApiError(404, 'Task not found.');
        if (existing.assignedUser) {
            await User.updateOne(
                { _id: existing.assignedUser },
                { $pull: { pendingTasks: String(existing._id) } }
            );
        }
        const task = await Task.findOneAndDelete(filter);
        return successResponse(res, task, 200, 'Task deleted successfully.');
    } catch (err) {
        sendError(res, err);
    }
});

module.exports = router;