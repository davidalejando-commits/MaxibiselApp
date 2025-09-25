//Script para crear usuario administrador inicial
const mongoose = require('mongoose');
const User = require('./models/user');
require('dotenv').config();

// Función para sembrar los datos iniciales
async function seedDatabase() {
    try {
        // Conectar a MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Conectado a MongoDB para sembrar datos iniciales');

        // Verificar si ya existe un usuario administrador
        const adminExists = await User.findOne({ role: 'admin' });

        if (!adminExists) {
            // Crear usuario administrador
            const adminUser = new User({
                username: 'admin',
                password: 'admin123', // Se aplicará hash automáticamente
                fullName: 'Administrador del Sistema',
                role: 'admin'
            });

            await adminUser.save();
            console.log('Usuario administrador creado con éxito');
            console.log('Usuario: admin');
            console.log('Contraseña: admin123');
            console.log('IMPORTANTE: Cambie esta contraseña después del primer inicio de sesión');
        } else {
            console.log('El usuario administrador ya existe, no se creará uno nuevo');
        }

        // Desconectar de la base de datos
        await mongoose.disconnect();
        console.log('Desconectado de MongoDB');

    } catch (error) {
        console.error('Error al sembrar datos iniciales:', error);
    }
}

// Ejecutar la función
seedDatabase();