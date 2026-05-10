const express = require('express');
const router = express.Router();
const User = require('../models/user');

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado. Se requieren privilegios de administrador' });
    }
    next();
};

router.get('/', isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
    }
});

router.post('/', isAdmin, async (req, res) => {
    try {
        const { username, password, fullName, role } = req.body;

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'El nombre de usuario ya está en uso' });
        }

        const user = new User({
            username,
            password, 
            fullName,
            role: role || 'employee' 
        });

        await user.save();

        const userResponse = {
            _id: user._id,
            username: user.username,
            fullName: user.fullName,
            role: user.role
        };

        res.status(201).json(userResponse);
    } catch (error) {
        res.status(400).json({ message: 'Error al crear usuario', error: error.message });
    }
});

router.get('/:id', isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener usuario', error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        if (req.user.role !== 'admin' && req.user.id !== userId) {
            return res.status(403).json({ message: 'No tienes permiso para editar este usuario' });
        }

        const updateData = {};

        if (req.user.role === 'admin' && req.body.role) {
            updateData.role = req.body.role;
        }

        if (req.body.fullName) {
            updateData.fullName = req.body.fullName;
        }

        if (req.body.password) {
            updateData.password = req.body.password;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(400).json({ message: 'Error al actualizar usuario', error: error.message });
    }
});

router.delete('/:id', isAdmin, async (req, res) => {
    try {
        if (req.user.id === req.params.id) {
            return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta' });
        }

        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.status(200).json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar usuario', error: error.message });
    }
});

module.exports = router;