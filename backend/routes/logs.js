const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/activityLog');

// ===== CREAR LOG =====
router.post('/', async (req, res) => {
  try {
    const logData = {
      tipo: req.body.tipo,
      accion: req.body.accion,
      usuario: req.user?.name || req.body.usuario || 'Sistema',
      entidad: req.body.entidad,
      entidad_id: req.body.entidad_id,
      datos_anteriores: req.body.datos_anteriores,
      datos_nuevos: req.body.datos_nuevos,
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    };

    const logId = await ActivityLog.create(logData);

    res.status(201).json({
      success: true,
      message: 'Log creado correctamente',
      logId
    });
  } catch (error) {
    console.error('Error creando log:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== OBTENER LOGS CON FILTROS =====
router.get('/', async (req, res) => {
  try {
    const filters = {
      tipo: req.query.tipo,
      usuario: req.query.usuario,
      entidad: req.query.entidad,
      fechaDesde: req.query.fechaDesde,
      fechaHasta: req.query.fechaHasta,
      search: req.query.search,
      limit: req.query.limit || 100,
      skip: req.query.skip || 0
    };

    const logs = await ActivityLog.getAll(filters);
    const total = await ActivityLog.count(filters);

    res.json({
      success: true,
      logs,
      total,
      page: Math.floor(filters.skip / filters.limit) + 1,
      totalPages: Math.ceil(total / filters.limit)
    });
  } catch (error) {
    console.error('Error obteniendo logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== OBTENER LOG POR ID =====
router.get('/:id', async (req, res) => {
  try {
    const log = await ActivityLog.getById(req.params.id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Log no encontrado'
      });
    }

    res.json({
      success: true,
      log
    });
  } catch (error) {
    console.error('Error obteniendo log:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== OBTENER ESTADÍSTICAS =====
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await ActivityLog.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== LIMPIAR LOGS ANTIGUOS =====
router.delete('/cleanup/old', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;

    const deleted = await ActivityLog.deleteOld(days);

    res.json({
      success: true,
      message: `${deleted} logs eliminados`,
      deleted
    });
  } catch (error) {
    console.error('Error limpiando logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== LIMPIAR POR TIPO =====
router.delete('/cleanup/by-type', async (req, res) => {
  try {
    const { tipo, days = 90 } = req.body;

    if (!tipo) {
      return res.status(400).json({
        success: false,
        message: 'El tipo es requerido'
      });
    }

    const deleted = await ActivityLog.deleteByType(tipo, days);

    res.json({
      success: true,
      message: `${deleted} logs tipo ${tipo} eliminados`,
      deleted
    });
  } catch (error) {
    console.error('Error limpiando logs por tipo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== ELIMINAR TODOS (CON CONFIRMACIÓN) =====
router.delete('/cleanup/all', async (req, res) => {
  try {
    // Requiere confirmación explícita
    const confirmacion = req.body.confirmar;

    if (confirmacion !== 'ELIMINAR_TODOS') {
      return res.status(400).json({
        success: false,
        message: 'Confirmación requerida. Enviar { "confirmar": "ELIMINAR_TODOS" }'
      });
    }

    const deleted = await ActivityLog.deleteAll();

    res.json({
      success: true,
      message: `${deleted} logs eliminados (TODOS)`,
      deleted
    });
  } catch (error) {
    console.error('Error eliminando todos los logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;