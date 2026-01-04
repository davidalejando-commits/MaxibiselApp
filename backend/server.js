const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ✅ NUEVO: Importar database manager
const dbManager = require('./config/database');
const ActivityLog = require('./models/activityLog');

// Inicialización de la aplicación
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// ===== LIMPIEZA AUTOMÁTICA DE LOGS =====
const setupLogCleanup = () => {
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas
    const CLEANUP_HOUR = 3; // 3:00 AM
    const DAYS_TO_KEEP = 90; // Mantener logs de últimos 90 días
    
    const runCleanup = async () => {
        try {
            const now = new Date();
            const hour = now.getHours();
            
            // Solo ejecutar entre las 3:00 AM y 4:00 AM
            if (hour !== CLEANUP_HOUR) return;
            
            console.log('🧹 Iniciando limpieza automática de logs...');
            
            // Eliminar logs antiguos
            const deleted = await ActivityLog.deleteOld(DAYS_TO_KEEP);
            
            if (deleted > 0) {
                console.log(`✅ Limpieza completada: ${deleted} logs eliminados (>${DAYS_TO_KEEP} días)`);
            } else {
                console.log('✅ No hay logs antiguos para eliminar');
            }
        } catch (error) {
            console.error('❌ Error en limpieza automática:', error);
        }
    };
    
    // Ejecutar cada 24 horas
    setInterval(runCleanup, CLEANUP_INTERVAL);
    
    // Ejecutar inmediatamente al iniciar (si es la hora correcta)
    runCleanup();
    
    console.log(`✅ Tarea de limpieza programada (diaria a las ${CLEANUP_HOUR}:00 AM, mantener últimos ${DAYS_TO_KEEP} días)`);
};

// ===== FUNCIÓN PARA INICIALIZAR BASES DE DATOS =====
async function initializeDatabases() {
    try {
        console.log('🔄 Inicializando bases de datos...');
        
        // Conectar MongoDB (usa la conexión existente de Mongoose)
        await dbManager.connectMongoDB();
        
        // Conectar SQLite (para facturas y logs)
        await dbManager.connectSQLite();
        
        // ✅ NUEVO: Iniciar limpieza automática de logs
        setupLogCleanup();
        
        console.log('✅ Todas las bases de datos conectadas correctamente\n');
    } catch (error) {
        console.error('💥 Error crítico inicializando bases de datos:', error);
        process.exit(1);
    }
}

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

// NUEVA RUTA: Health check (SIN autenticación)
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK',
        message: 'Backend funcionando correctamente',
        timestamp: new Date().toISOString(),
        port: PORT,
        databases: {
            mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
            sqlite: dbManager.sqliteConnection ? 'Connected' : 'Disconnected'
        },
        uptime: process.uptime()
    });
});

// Importar rutas
const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const facturaRoutes = require('./routes/facturaRoutes');
const logRoutes = require('./routes/logs');

// Usar rutas (CON autenticación)
app.use('/api/products', authenticateToken, productRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/auth', authRoutes); // Auth no necesita token
app.use('/api/transactions', authenticateToken, transactionRoutes);
app.use('/api/facturas', authenticateToken, facturaRoutes);
app.use('/api/logs', authenticateToken, logRoutes);

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

// ===== MANEJO DE CIERRE GRACIOSO =====
process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando servidor...');
    await dbManager.closeAll();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Cerrando servidor...');
    await dbManager.closeAll();
    process.exit(0);
});

// ===== INICIAR EL SERVIDOR =====
async function startServer() {
    try {
        // Inicializar bases de datos primero
        await initializeDatabases();
        
        // Iniciar servidor Express
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
            console.log(`📊 MongoDB: Inventario de productos`);
            console.log(`💾 SQLite: Facturas y logs locales`);
            console.log(`🔗 Health check: http://localhost:${PORT}/api/health\n`);
        });
    } catch (error) {
        console.error('💥 Error iniciando servidor:', error);
        process.exit(1);
    }
}

// Ejecutar servidor
startServer();