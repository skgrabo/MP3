const express = require('express');
const router = express.Router();
const User = require('../models/user');

let users = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' },
];

function getUser(req, res, next) {
    const id = parseInt(req.params.id, 10);
    const user = users.find(u => u.id === id);

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
    const user = new User({
        name: req.body.name,
        id: req.body.id,
    });
    try {
        const newUser = await user.save();
        res.status(201).json(newUser);
    } catch (err) {
        res.status(404).json({ message: err.message });
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