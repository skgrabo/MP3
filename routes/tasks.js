const express = require('express');
const router = express.Router();
const Task = require('../models/task');

router.get('/', async (req, res) => {
    try {
        const tasks = await Task.find();
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', async (req, res) => {
    const body = req.body ?? {};
    const task = new Task({
        name: body.name,
        description: body.description ?? '',
        deadline: body.deadline,
        completed: body.completed ?? false,
        assignedUser: body.assignedUser ?? '',
        assignedUserName: body.assignedUserName ?? 'unassigned',
    });

    try {
        const newTask = await task.save();
        res.status(201).json(newTask);
    } catch (err) {
        const status = ['CastError', 'ValidationError'].includes(err.name) ? 400 : 500;
        res.status(status).json({ message: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.json(task);
    } catch (err) {
        const status = err.name === 'CastError' ? 400 : 500;
        res.status(status).json({ message: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const body = req.body ?? {};
        task.name = body.name;
        task.description = body.description ?? '';
        task.deadline = body.deadline;
        task.completed = body.completed ?? false;
        task.assignedUser = body.assignedUser ?? '';
        task.assignedUserName = body.assignedUserName ?? 'unassigned';

        await task.save();
        res.json(task);
    } catch (err) {
        const status = ['CastError', 'ValidationError'].includes(err.name) ? 400 : 500;
        res.status(status).json({ message: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (err) {
        const status = err.name === 'CastError' ? 400 : 500;
        res.status(status).json({ message: err.message });
    }
});

module.exports = router;