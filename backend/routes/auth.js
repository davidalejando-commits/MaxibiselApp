const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');
require('dotenv').config();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Por favor, complete todos los campos' 
            });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'El usuario no existe' 
            });
        }

        const passwordMatch = await user.comparePassword(password);
        if (!passwordMatch) {
            return res.status(401).json({ 
                success: false,
                message: 'La contraseña es incorrecta' 
            });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET
        );

        const userResponse = {
            _id: user._id,
            username: user.username,
            fullName: user.fullName,
            role: user.role
        };

        console.log('✅ Login exitoso:', username);
        
        res.status(200).json({ 
            success: true,
            token, 
            user: userResponse 
        });
    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error del servidor durante la autenticación', 
            error: error.message 
        });
    }
});

router.get('/verify', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            valid: false, 
            message: 'No se proporcionó token de autenticación' 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            ignoreExpiration: true 
        });

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ 
                valid: false, 
                message: 'El usuario ya no existe en el sistema' 
            });
        }

        res.status(200).json({
            valid: true, 
            user: {
                _id: user._id,
                username: user.username,
                fullName: user.fullName,
                role: user.role
            }
        });
    } catch (error) {
        console.error('❌ Error verificando token:', error);
        
        let message = 'Token inválido';
        
        if (error.name === 'JsonWebTokenError') {
            message = 'El token de sesión es inválido';
        } else if (error.name === 'TokenExpiredError') {
            message = 'La sesión ha expirado';
        }
        
        res.status(401).json({ 
            valid: false, 
            message 
        });
    }
});

router.post('/logout', (req, res) => {
    console.log('👋 Sesión cerrada');
    res.status(200).json({ 
        success: true,
        message: 'Sesión cerrada correctamente' 
    });
});

module.exports = router;

