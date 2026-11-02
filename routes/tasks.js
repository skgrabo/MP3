const express = require('express');
const router = express.Router();
const Task = require('../models/task');

let tasks = [
    { id: 1, title: 'Task 1', description: 'Description for Task 1' },
    { id: 2, title: 'Task 2', description: 'Description for Task 2' },
];

async function getTasks() {
    const response = await fetch('http://localhost:3000/todos');
    const tasks = await response.json();

    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';

    tasks.forEach(task => {
        const li = document.createElement('li');

        // Display task name
        const taskName = document.createElement('span');
        taskName.textContent = task.name;

        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';

        // Call deleteTask when button is clicked
        deleteButton.onclick = () => deleteTask(task.id);

        // Add task name and button to list item
        li.appendChild(taskName);
        li.appendChild(deleteButton);

        taskList.appendChild(li);
    });
}

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

router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;

        const deletedTodo = await Task.findByIdAndDelete(id);

        if (!deletedTodo) {
            return res.status(404).json({
                error: "Task not found"
            });
        }

        res.status(200).json({
            message: "Task deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            error: "Error deleting task"
        });
    }
});

module.exports = router;