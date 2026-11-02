const express = require('express');
const router = express.Router();
const Task = require('../models/task');

let tasks = [
    { id: 1, title: 'Task 1', description: 'Description for Task 1' },
    { id: 2, title: 'Task 2', description: 'Description for Task 2' },
];

function getTask(req, res, next) {
    const id = parseInt(req.params.id, 10);
    const task = tasks.find(t => t.id === id);

    if (!task) {
        return res.status(404).json({ message: 'Task not found' });
    }

    res.task = task;
    next();
}

router.get('/', async (req, res) => {
    try {
        const tasks = await Task.find();
        res.json(tasks);
    } catch (err) {
        res.status(404).json({ message: err.message });
    }
});

router.post('/', async (req, res) => {
    const task = new Task({
        name: req.body.name,
        description: req.body.description,
        deadline: req.body.deadline,
        completed: req.body.completed,
        assignedUser: req.body.assignedUser,
        assignedUserName: req.body.assignedUserName,
    });
    try {
        const newTask = await task.save();
        res.status(201).json(newTask);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});


router.get('/:id', getTask, (req, res) => {
    const id = parseInt(req.params.id);
    const task = tasks.find(t => t.id === id);

    if (res.task.id !== id) {
        return res.status(404).json({ message: 'Task not found' });
    }
    res.json(res.task);
});

router.put('/:id', getTask, async (req, res) => {
    const id = parseInt(req.params.id);
    const index = tasks.findIndex(t => t.id === id);

    if (index === -1) {
        return res.status(404).json({ message: 'Task not found' });
    }
    tasks[index] = {
        id: id,
        ...req.body
    };
    res.json(tasks[index]);
});

router.delete('/:id', getTask, async (req, res) => {
    const id = parseInt(req.params.id);
    const index = tasks.findIndex(t => t.id === id);

    if (index === -1) {
        return res.status(404).json({ message: 'Task not found' });
    }
    tasks.splice(index, 1);
    res.json({ message: 'Task deleted' });
});

module.exports = router;