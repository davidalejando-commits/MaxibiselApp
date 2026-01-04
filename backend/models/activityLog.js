// backend/models/activityLog.js
const dbManager = require('../config/database');

class ActivityLog {
  // ===== CREAR LOG =====
  static async create(logData) {
    try {
      const db = dbManager.getSQLite();

      const result = await db.run(`
        INSERT INTO activity_logs (
          tipo, accion, usuario, entidad, entidad_id,
          datos_anteriores, datos_nuevos, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        logData.tipo || 'GENERAL',
        logData.accion,
        logData.usuario || 'Sistema',
        logData.entidad || null,
        logData.entidad_id || null,
        logData.datos_anteriores ? JSON.stringify(logData.datos_anteriores) : null,
        logData.datos_nuevos ? JSON.stringify(logData.datos_nuevos) : null,
        logData.ip_address || null,
        logData.user_agent || null
      ]);

      console.log('📝 Log guardado en DB:', logData.accion);
      return result.lastID;
    } catch (error) {
      console.error('❌ Error guardando log:', error);
      throw error;
    }
  }

  // ===== OBTENER LOGS CON FILTROS =====
  static async getAll(filters = {}) {
    try {
      const db = dbManager.getSQLite();

      let query = 'SELECT * FROM activity_logs WHERE 1=1';
      const params = [];

      // Filtro por tipo
      if (filters.tipo) {
        query += ' AND tipo = ?';
        params.push(filters.tipo);
      }

      // Filtro por usuario
      if (filters.usuario) {
        query += ' AND usuario LIKE ?';
        params.push(`%${filters.usuario}%`);
      }

      // Filtro por entidad
      if (filters.entidad) {
        query += ' AND entidad = ?';
        params.push(filters.entidad);
      }

      // Filtro por fecha desde
      if (filters.fechaDesde) {
        query += ' AND timestamp >= ?';
        params.push(filters.fechaDesde);
      }

      // Filtro por fecha hasta
      if (filters.fechaHasta) {
        query += ' AND timestamp <= ?';
        params.push(filters.fechaHasta);
      }

      // Búsqueda de texto
      if (filters.search) {
        query += ' AND (accion LIKE ? OR usuario LIKE ? OR entidad LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
      }

      // Ordenar por más reciente primero
      query += ' ORDER BY timestamp DESC';

      // Límite y offset
      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(parseInt(filters.limit));
      }

      if (filters.skip) {
        query += ' OFFSET ?';
        params.push(parseInt(filters.skip));
      }

      const logs = await db.all(query, params);

      // Parsear JSON
      return logs.map(log => ({
        ...log,
        datos_anteriores: log.datos_anteriores ? JSON.parse(log.datos_anteriores) : null,
        datos_nuevos: log.datos_nuevos ? JSON.parse(log.datos_nuevos) : null
      }));
    } catch (error) {
      console.error('❌ Error obteniendo logs:', error);
      throw error;
    }
  }

  // ===== OBTENER LOG POR ID =====
  static async getById(id) {
    try {
      const db = dbManager.getSQLite();

      const log = await db.get(
        'SELECT * FROM activity_logs WHERE id = ?',
        [id]
      );

      if (!log) return null;

      return {
        ...log,
        datos_anteriores: log.datos_anteriores ? JSON.parse(log.datos_anteriores) : null,
        datos_nuevos: log.datos_nuevos ? JSON.parse(log.datos_nuevos) : null
      };
    } catch (error) {
      console.error('❌ Error obteniendo log:', error);
      throw error;
    }
  }

  // ===== CONTAR LOGS =====
  static async count(filters = {}) {
    try {
      const db = dbManager.getSQLite();

      let query = 'SELECT COUNT(*) as total FROM activity_logs WHERE 1=1';
      const params = [];

      if (filters.tipo) {
        query += ' AND tipo = ?';
        params.push(filters.tipo);
      }

      if (filters.usuario) {
        query += ' AND usuario LIKE ?';
        params.push(`%${filters.usuario}%`);
      }

      const result = await db.get(query, params);
      return result.total;
    } catch (error) {
      console.error('❌ Error contando logs:', error);
      return 0;
    }
  }

  // ===== ELIMINAR LOGS ANTIGUOS =====
  static async deleteOld(days = 90) {
    try {
      const db = dbManager.getSQLite();
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - days);
      const fechaLimite = fecha.toISOString();

      const result = await db.run(
        'DELETE FROM activity_logs WHERE timestamp < ?',
        [fechaLimite]
      );

      console.log(`🗑️ ${result.changes} logs antiguos eliminados`);
      return result.changes;
    } catch (error) {
      console.error('❌ Error eliminando logs antiguos:', error);
      throw error;
    }
  }

  // ===== ELIMINAR POR TIPO =====
  static async deleteByType(tipo, days = 90) {
    try {
      const db = dbManager.getSQLite();
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - days);
      const fechaLimite = fecha.toISOString();

      const result = await db.run(
        'DELETE FROM activity_logs WHERE tipo = ? AND timestamp < ?',
        [tipo, fechaLimite]
      );

      console.log(`🗑️ ${result.changes} logs tipo ${tipo} eliminados`);
      return result.changes;
    } catch (error) {
      console.error('❌ Error eliminando logs por tipo:', error);
      throw error;
    }
  }

  // ===== ELIMINAR TODOS =====
  static async deleteAll() {
    try {
      const db = dbManager.getSQLite();

      const result = await db.run('DELETE FROM activity_logs');

      console.log(`🗑️ ${result.changes} logs eliminados (TODOS)`);
      return result.changes;
    } catch (error) {
      console.error('❌ Error eliminando todos los logs:', error);
      throw error;
    }
  }

  // ===== ESTADÍSTICAS =====
  static async getStats() {
    try {
      const db = dbManager.getSQLite();

      // Total de logs
      const total = await db.get('SELECT COUNT(*) as count FROM activity_logs');

      // Logs por tipo
      const porTipo = await db.all(`
        SELECT tipo, COUNT(*) as count 
        FROM activity_logs 
        GROUP BY tipo
        ORDER BY count DESC
      `);

      // Logs de hoy
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const logsHoy = await db.get(
        'SELECT COUNT(*) as count FROM activity_logs WHERE timestamp >= ?',
        [hoy.toISOString()]
      );

      // Logs últimos 7 días
      const hace7dias = new Date();
      hace7dias.setDate(hace7dias.getDate() - 7);
      const logsUltimaSemana = await db.get(
        'SELECT COUNT(*) as count FROM activity_logs WHERE timestamp >= ?',
        [hace7dias.toISOString()]
      );

      return {
        total: total.count,
        hoy: logsHoy.count,
        ultimaSemana: logsUltimaSemana.count,
        porTipo: porTipo
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return {
        total: 0,
        hoy: 0,
        ultimaSemana: 0,
        porTipo: []
      };
    }
  }
}

module.exports = ActivityLog;