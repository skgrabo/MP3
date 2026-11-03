const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Task = require('../models/task');
const { parseCollectionQuery, parseProjection } = require('./query');
const {
    ApiError,
    badRequest,
    validateBody,
    requiredString,
    requiredEmail,
    validatePendingTaskIds,
    sendError,
    validUrlId
} = require('./mutationHelpers');

async function findPendingTasks(ids) {
    const tasks = await Task.find({ _id: { $in: ids } });
    const foundIds = new Set(tasks.map(task => String(task._id)));
    if (tasks.some(task => task.completed)) {
        badRequest('pendingTasks cannot contain completed tasks.');
    }
    if (ids.some(id => !foundIds.has(id))) {
        throw new ApiError(404, 'One or more tasks were not found.');
    }
    return tasks;
}

async function setTaskAssignment(task, user) {
    task.assignedUser = String(user._id);
    task.assignedUserName = user.name;
    await task.save();
}

router.get('/', async (req, res) => {
    try {
        const options = parseCollectionQuery(req.query);
        if (options.count) {
            const count = await User.countDocuments(options.where);
            return res.json(count);
        }
        if (options.limit === 0) {
            return res.json([]);
        }

        const query = User.find(options.where);
        if (options.sort) query.sort(options.sort);
        if (options.select) query.select(options.select);
        if (options.skip) query.skip(options.skip);
        if (options.limit !== undefined) query.limit(options.limit);
        const users = await query;
        res.json(users);
    } catch (err) {
        const status = err.statusCode || (err.name === 'CastError' ? 400 : 500);
        res.status(status).json({ message: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const body = validateBody(req.body);
        const name = requiredString(body.name, 'name');
        const email = requiredEmail(body.email);
        const pendingTaskIds = validatePendingTaskIds(body.pendingTasks);
        const duplicate = await User.exists({ email });
        if (duplicate) badRequest('A user with this email already exists.');
        const pendingTasks = await findPendingTasks(pendingTaskIds);
        const user = await new User({ name, email, pendingTasks: pendingTaskIds }).save();

        for (const task of pendingTasks) {
            if (task.assignedUser && task.assignedUser !== String(user._id)) {
                await User.updateOne(
                    { _id: task.assignedUser },
                    { $pull: { pendingTasks: String(task._id) } }
                );
            }
            await setTaskAssignment(task, user);
        }

        res.status(201).json({ message: 'User created successfully.', data: user });
    } catch (err) {
        sendError(res, err);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const projection = parseProjection(req.query.select);
        const query = User.findById(req.params.id);
        if (projection) query.select(projection);
        const user = await query;
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        const status = err.statusCode || (err.name === 'CastError' ? 404 : 500);
        res.status(status).json({ message: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        if (!validUrlId(req.params.id)) {
            throw new ApiError(404, 'User not found.');
        }
        const user = await User.findById(req.params.id);
        if (!user) throw new ApiError(404, 'User not found.');

        const body = validateBody(req.body);
        const name = requiredString(body.name, 'name');
        const email = requiredEmail(body.email);
        const pendingTaskIds = validatePendingTaskIds(body.pendingTasks);
        const duplicate = await User.exists({ email, _id: { $ne: user._id } });
        if (duplicate) badRequest('A user with this email already exists.');
        const pendingTasks = await findPendingTasks(pendingTaskIds);

        const newPendingIds = new Set(pendingTaskIds);
        const assignedTasks = await Task.find({ assignedUser: String(user._id) });
        user.name = name;
        user.email = email;
        user.pendingTasks = pendingTaskIds;
        await user.save();

        for (const task of assignedTasks) {
            const taskId = String(task._id);
            if (!task.completed && !newPendingIds.has(taskId)) {
                task.assignedUser = '';
                task.assignedUserName = 'unassigned';
            } else {
                task.assignedUserName = name;
            }
            await task.save();
        }
        for (const task of pendingTasks) {
            if (task.assignedUser && task.assignedUser !== String(user._id)) {
                await User.updateOne(
                    { _id: task.assignedUser },
                    { $pull: { pendingTasks: String(task._id) } }
                );
            }
            await setTaskAssignment(task, user);
        }

        res.status(200).json({ message: 'User updated successfully.', data: user });
    } catch (err) {
        sendError(res, err);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        if (!validUrlId(req.params.id)) throw new ApiError(404, 'User not found.');
        const user = await User.findById(req.params.id);
        if (!user) throw new ApiError(404, 'User not found.');

        await Task.updateMany(
            { assignedUser: String(user._id) },
            { $set: { assignedUser: '', assignedUserName: 'unassigned' } }
        );
        await user.deleteOne();
        res.status(200).json({ message: 'User deleted successfully.', data: user });
    } catch (err) {
        sendError(res, err);
    }
});

module.exports = router;