// backend/config/database.js
const mongoose = require('mongoose');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    this.mongoConnection = null;
    this.sqliteConnection = null;
  }

  // ===== MONGODB (Para inventario crítico) =====
  async connectMongoDB() {
    try {
      if (mongoose.connection.readyState === 1) {
        console.log('✅ MongoDB ya está conectado');
        this.mongoConnection = mongoose.connection;
        return this.mongoConnection;
      }

      this.mongoConnection = await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      
      console.log('✅ MongoDB conectado (Inventario)');
      return this.mongoConnection;
    } catch (error) {
      console.error('❌ Error conectando MongoDB:', error);
      throw error;
    }
  }

  // ===== SQLITE (Para facturas y logs locales) =====
  async connectSQLite() {
    try {
      // Crear directorio de datos si no existe
      const dbPath = path.join(__dirname, '../data/local.db');
      const dbDir = path.dirname(dbPath);
      
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log('📁 Directorio /data creado');
      }

      // Abrir conexión SQLite
      this.sqliteConnection = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      console.log('✅ SQLite conectado:', dbPath);
      
      // Crear tablas
      await this.initializeSQLiteTables();
      
      return this.sqliteConnection;
    } catch (error) {
      console.error('❌ Error conectando SQLite:', error);
      throw error;
    }
  }

  // Crear estructura de tablas SQLite
  async initializeSQLiteTables() {
    const db = this.sqliteConnection;

    console.log('🔨 Inicializando tablas SQLite...');

    // ===== TABLA DE FACTURAS =====
    await db.exec(`
      CREATE TABLE IF NOT EXISTS facturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_factura TEXT UNIQUE NOT NULL,
        
        -- Empresa
        empresa_nombre TEXT NOT NULL,
        empresa_nit TEXT NOT NULL,
        empresa_direccion TEXT,
        empresa_telefono TEXT,
        empresa_email TEXT,
        
        -- Cliente
        cliente_nombre TEXT NOT NULL,
        cliente_documento TEXT,
        cliente_telefono TEXT,
        cliente_direccion TEXT,
        cliente_email TEXT,
        
        -- Totales
        subtotal REAL NOT NULL,
        descuento REAL DEFAULT 0,
        iva REAL DEFAULT 0,
        total REAL NOT NULL,
        
        -- Metadata
        observaciones TEXT,
        fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
        creado_por TEXT,
        estado TEXT DEFAULT 'pendiente',
        salida_id TEXT,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ===== TABLA DE PRODUCTOS DE FACTURA =====
    await db.exec(`
      CREATE TABLE IF NOT EXISTS factura_productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        factura_id INTEGER NOT NULL,
        product_id TEXT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        esfera TEXT,
        cilindro TEXT,
        adicion TEXT,
        cantidad INTEGER NOT NULL,
        precio_unitario REAL NOT NULL,
        subtotal REAL NOT NULL,
        
        FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE
      );
    `);

    // ===== TABLA DE LOGS DE ACTIVIDAD =====
    await db.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        accion TEXT NOT NULL,
        usuario TEXT,
        entidad TEXT,
        entidad_id TEXT,
        datos_anteriores TEXT,
        datos_nuevos TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ===== ÍNDICES PARA OPTIMIZACIÓN =====
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_facturas_numero ON facturas(numero_factura);
      CREATE INDEX IF NOT EXISTS idx_facturas_cliente ON facturas(cliente_nombre);
      CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON facturas(fecha_emision);
      CREATE INDEX IF NOT EXISTS idx_logs_tipo ON activity_logs(tipo);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON activity_logs(timestamp);
    `);

    console.log('✅ Tablas SQLite inicializadas');
  }

  // Obtener conexión SQLite
  getSQLite() {
    if (!this.sqliteConnection) {
      throw new Error('SQLite no está conectado');
    }
    return this.sqliteConnection;
  }

  // Obtener conexión MongoDB
  getMongoDB() {
    if (!this.mongoConnection) {
      throw new Error('MongoDB no está conectado');
    }
    return mongoose;
  }

  // Cerrar todas las conexiones
  async closeAll() {
    try {
      if (this.sqliteConnection) {
        await this.sqliteConnection.close();
        console.log('✅ SQLite cerrado');
      }
      if (this.mongoConnection) {
        await mongoose.connection.close();
        console.log('✅ MongoDB cerrado');
      }
    } catch (error) {
      console.error('❌ Error cerrando conexiones:', error);
    }
  }
}

module.exports = new DatabaseManager();