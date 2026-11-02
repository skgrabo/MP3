const express = require('express');
const router = express.Router();
const User = require('../models/user');

let users = [
    {"name" : "John Doe", "email" : "john.doe@example.com", "pendingTasks" : [], "dateCreated": new Date()},
    {"name" : "Jane Smith", "email" : "jane.smith@example.com", "pendingTasks" : [], "dateCreated": new Date()}
];

function getUser(req, res, next) {
    const name = req.params.name;
    const email = req.params.email;
    const pendingTasks = req.params.pendingTasks;
    const dateCreated = req.params.dateCreated;

    const user = users.find(u => u.name === name && u.email === email && u.pendingTasks === pendingTasks && u.dateCreated === dateCreated);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.user = user;
    next();
}

router.get('/', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (err) {
        res.status(404).json({ message: err.message });
    }
});

router.post('/', async (req, res) => {
    const body = req.body ?? {};
    const user = new User({
        name: body.name,
        email: body.email,
        pendingTasks: [],
        dateCreated: Date.now(),
    });

    try {
        const newUser = await user.save();
        res.status(201).json(newUser);
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        if (err.code === 11000) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }
        res.status(500).json({ message: err.message });
    }
});

router.get('/:id', getUser, (req, res) => {
    const id = parseInt(req.params.id);
    const user = users.find(u => u.id === id);

    if (res.user.id !== id) {
        return res.status(404).json({ message: 'User not found' });
    }
    res.json(res.user);
});

router.put('/:id', getUser, async (req, res) => {
    const id = parseInt(req.params.id);
    const index = users.findIndex(u => u.id === id);

    if (index === -1) {
        return res.status(404).json({ message: 'User not found' });
    }
    users[index] = {
        id: id,
        ...req.body
    };
    res.json(users[index]);
});

module.exports = router;