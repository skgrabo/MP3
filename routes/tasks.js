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
    sendError,
    validUrlId
} = require('./mutationHelpers');

async function findAssignedUser(id) {
    if (!id) return null;
    const user = await User.findById(id);
    if (!user) throw new ApiError(404, 'Assigned user not found.');
    return user;
}

function getTaskFields(body) {
    const assignedUser = validateAssignedUser(body.assignedUser);
    optionalString(body.assignedUserName, 'assignedUserName', undefined);

    return {
        name: requiredString(body.name, 'name'),
        description: optionalString(body.description, 'description', ''),
        deadline: requiredDate(body.deadline),
        completed: optionalBoolean(body.completed, 'completed', false),
        assignedUser,
        assignedUserName: 'unassigned'
    };
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
        const options = parseCollectionQuery(req.query, 100);
        if (options.count) {
            const count = await Task.countDocuments(options.where);
            return res.json(count);
        }
        if (options.limit === 0) {
            return res.json([]);
        }

        const query = Task.find(options.where);
        if (options.sort) query.sort(options.sort);
        if (options.select) query.select(options.select);
        if (options.skip) query.skip(options.skip);
        if (options.limit !== undefined) query.limit(options.limit);
        const tasks = await query;
        res.json(tasks);
    } catch (err) {
        const status = err.statusCode || (err.name === 'CastError' ? 400 : 500);
        res.status(status).json({ message: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const body = validateBody(req.body);
        const fields = getTaskFields(body);
        const assignedUserId = fields.assignedUser;
        const assignedUser = await findAssignedUser(assignedUserId);
        if (assignedUser && body.assignedUserName !== undefined && body.assignedUserName !== assignedUser.name) {
            badRequest('assignedUserName must match the assigned user name.');
        }
        fields.assignedUserName = assignedUser ? assignedUser.name : 'unassigned';
        const task = await new Task(fields).save();
        await syncTaskAssignment(task, null, assignedUser);
        res.status(201).json({ message: 'Task created successfully.', data: task });
    } catch (err) {
        sendError(res, err);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const projection = parseProjection(req.query.select);
        const task = await Task.findById(req.params.id).select(projection);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.json(task);
    } catch (err) {
        const status = err.statusCode || (err.name === 'CastError' ? 404 : 500);
        res.status(status).json({ message: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        if (!validUrlId(req.params.id)) throw new ApiError(404, 'Task not found.');
        const task = await Task.findById(req.params.id);
        if (!task) {
            throw new ApiError(404, 'Task not found.');
        }

        const body = validateBody(req.body);
        const fields = getTaskFields(body);
        const assignedUserId = fields.assignedUser;
        const assignedUser = await findAssignedUser(assignedUserId);
        if (assignedUser && body.assignedUserName !== undefined && body.assignedUserName !== assignedUser.name) {
            badRequest('assignedUserName must match the assigned user name.');
        }
        fields.assignedUserName = assignedUser ? assignedUser.name : 'unassigned';
        const previousUserId = task.assignedUser;
        Object.assign(task, fields);
        await task.save();
        await syncTaskAssignment(task, previousUserId, assignedUser);
        res.status(200).json({ message: 'Task updated successfully.', data: task });
    } catch (err) {
        sendError(res, err);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        if (!validUrlId(req.params.id)) throw new ApiError(404, 'Task not found.');
        const existing = await Task.findById(req.params.id);
        if (!existing) throw new ApiError(404, 'Task not found.');
        if (existing.assignedUser) {
            await User.updateOne(
                { _id: existing.assignedUser },
                { $pull: { pendingTasks: String(existing._id) } }
            );
        }
        const task = await Task.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Task deleted successfully.', data: task });
    } catch (err) {
        sendError(res, err);
    }
});

module.exports = router;