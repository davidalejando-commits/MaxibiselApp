//Rutas para usuarios
const express = require('express');
const router = express.Router();
const User = require('../models/user');

// Middleware para verificar permisos de administrador
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado. Se requieren privilegios de administrador' });
    }
    next();
};

// Obtener todos los usuarios (solo admin)
router.get('/', isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
    }
});

// Crear un nuevo usuario (solo admin)
router.post('/', isAdmin, async (req, res) => {
    try {
        const { username, password, fullName, role } = req.body;

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'El nombre de usuario ya está en uso' });
        }

        // Crear nuevo usuario
        const user = new User({
            username,
            password, // Se hará hash en el hook pre-save
            fullName,
            role: role || 'employee' // Por defecto, rol de empleado
        });

        await user.save();

        // No incluir contraseña en la respuesta
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

// Obtener un usuario por ID (solo admin)
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

// Actualizar un usuario (solo admin, o el propio usuario para datos limitados)
router.put('/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        // Solo los admins pueden editar a otros usuarios
        if (req.user.role !== 'admin' && req.user.id !== userId) {
            return res.status(403).json({ message: 'No tienes permiso para editar este usuario' });
        }

        // Datos que se pueden actualizar
        const updateData = {};

        // Si es admin, puede cambiar el rol
        if (req.user.role === 'admin' && req.body.role) {
            updateData.role = req.body.role;
        }

        // Cualquier usuario puede cambiar su nombre completo
        if (req.body.fullName) {
            updateData.fullName = req.body.fullName;
        }

        // Cambio de contraseña (se hará hash en el hook)
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

// Eliminar un usuario (solo admin)
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        // Evitar que se elimine a sí mismo
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