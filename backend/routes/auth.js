//Rutas para autenticación
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');
require('dotenv').config();

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Buscar usuario
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }

        // Verificar contraseña
        const passwordMatch = await user.comparePassword(password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }

        // Generar token JWT
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // No incluir la contraseña en la respuesta
        const userResponse = {
            _id: user._id,
            username: user.username,
            fullName: user.fullName,
            role: user.role
        };

        res.status(200).json({ token, user: userResponse });
    } catch (error) {
        res.status(500).json({ message: 'Error durante la autenticación', error: error.message });
    }
});

// Verificar token
router.get('/verify', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ valid: false, message: 'No se proporcionó token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verificar que el usuario sigue existiendo
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ valid: false, message: 'Usuario inválido' });
        }

        res.status(200).json({
            valid: true, user: {
                _id: user._id,
                username: user.username,
                fullName: user.fullName,
                role: user.role
            }
        });
    } catch (error) {
        res.status(401).json({ valid: false, message: 'Token inválido o expirado' });
    }
});

// Logout (en clientes, esto se maneja eliminando el token)
router.post('/logout', (req, res) => {
    res.status(200).json({ message: 'Sesión cerrada correctamente' });
});

module.exports = router;