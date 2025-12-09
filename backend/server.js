// Configuración del servidor Express
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Inicialización de la aplicación
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.error('Error conectando a MongoDB:', err));

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No se proporcionó token de acceso' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido o expirado' });
        req.user = user;
        next();
    });
};

// NUEVA RUTA: Health check (SIN autenticación - debe ir antes de las rutas autenticadas)
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK',
        message: 'Backend funcionando correctamente',
        timestamp: new Date().toISOString(),
        port: PORT,
        mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        uptime: process.uptime()
    });
});

// Importar rutas
const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const facturaRoutes = require('./routes/facturaRoutes');

// Usar rutas (CON autenticación)
app.use('/api/products', authenticateToken, productRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/auth', authRoutes); // Auth no necesita token
app.use('/api/transactions', authenticateToken, transactionRoutes);
app.use('/api/facturas', authenticateToken, facturaRoutes);
// Ruta de prueba
app.get('/', (req, res) => {
    res.send('API del Sistema de Inventario Óptico funcionando correctamente');
});

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Ruta no encontrada',
        path: req.path,
        method: req.method
    });
});

// Manejo de errores globales
app.use((err, req, res, next) => {
    console.error('Error del servidor:', err);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});