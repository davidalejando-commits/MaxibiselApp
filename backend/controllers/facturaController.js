const FacturaLocal = require('../models/facturaLocal');

// ✅ CREAR FACTURA (usando SQLite)
exports.createFactura = async (req, res) => {
  try {
    console.log('\n💰 [FACTURA CONTROLLER] Creando nueva factura...');

    const { empresa, cliente, productos, observaciones, salidaId } = req.body;

    // Validaciones
    if (!cliente || !cliente.nombre) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del cliente es requerido'
      });
    }

    if (!productos || productos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe incluir al menos un producto'
      });
    }

    // Generar número consecutivo
    const numeroFactura = await FacturaLocal.generarNumero();

    // Calcular totales
    let subtotal = 0;
    const productosConSubtotal = productos.map(prod => {
      const subtotalProd = prod.cantidad * prod.precioUnitario;
      subtotal += subtotalProd;
      return {
        ...prod,
        subtotal: subtotalProd
      };
    });

    const descuento = req.body.descuento || 0;
    
    // IVA por defecto es 0 (sin IVA)
    let iva = 0;
    if (req.body.iva !== undefined && req.body.iva !== null) {
      iva = parseFloat(req.body.iva) || 0;
    }
    
    const total = subtotal - descuento + iva;

    console.log('💵 [FACTURA] Totales:', { subtotal, descuento, iva, total });

    // Crear factura
    const factura = await FacturaLocal.create({
      empresa: empresa || getEmpresaPorDefecto(),
      numeroFactura,
      cliente,
      productos: productosConSubtotal,
      subtotal,
      descuento,
      iva,
      total,
      observaciones,
      salidaId,
      creadoPor: req.user ? req.user.name : 'Sistema',
      estado: 'pendiente'
    });

    console.log('✅ [FACTURA] Factura creada:', numeroFactura, '- Total:', total);

    res.status(201).json({
      success: true,
      message: 'Factura creada correctamente',
      factura: factura
    });

  } catch (error) {
    console.error('💥 [FACTURA] Error creando:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear factura',
      error: error.message
    });
  }
};

// ✅ OBTENER TODAS LAS FACTURAS - VERSIÓN CORREGIDA
exports.getAllFacturas = async (req, res) => {
  try {
    console.log('\n📋 [FACTURA CONTROLLER] ========== OBTENIENDO FACTURAS ==========');
    console.log('📋 [FACTURA CONTROLLER] Query params:', req.query);
    
    const { limit = 100, skip = 0, estado, cliente } = req.query;

    const options = {
      limit: parseInt(limit),
      skip: parseInt(skip)
    };

    if (estado) options.estado = estado;
    if (cliente) options.cliente = cliente;

    console.log('📋 [FACTURA CONTROLLER] Opciones de búsqueda:', options);

    // Llamar al modelo
    const facturas = await FacturaLocal.getAll(options);

    console.log(`✅ [FACTURA CONTROLLER] ${facturas.length} facturas obtenidas`);
    
    // ✅ CRÍTICO: Asegurar que siempre retorna un array
    const facturasArray = Array.isArray(facturas) ? facturas : [];
    
    console.log('📋 [FACTURA CONTROLLER] Respuesta preparada:', {
      success: true,
      total: facturasArray.length,
      primerFactura: facturasArray[0]?.numeroFactura || 'N/A'
    });

    res.status(200).json({
      success: true,
      facturas: facturasArray,
      total: facturasArray.length
    });

    console.log('✅ [FACTURA CONTROLLER] Respuesta enviada correctamente');
    console.log('📋 [FACTURA CONTROLLER] ========== FIN ==========\n');

  } catch (error) {
    console.error('💥 [FACTURA CONTROLLER] ========== ERROR ==========');
    console.error('💥 [FACTURA CONTROLLER] Error obteniendo facturas:', error.message);
    console.error('💥 [FACTURA CONTROLLER] Stack:', error.stack);
    console.error('💥 [FACTURA CONTROLLER] =============================\n');
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener facturas',
      error: error.message,
      facturas: [] // ✅ Retornar array vacío en caso de error
    });
  }
};

// ✅ OBTENER FACTURA POR ID - VERSIÓN CORREGIDA
exports.getFacturaById = async (req, res) => {
  try {
    console.log('\n🔍 [FACTURA CONTROLLER] Buscando factura:', req.params.id);
    
    const factura = await FacturaLocal.getById(req.params.id);

    if (!factura) {
      console.log('❌ [FACTURA CONTROLLER] Factura no encontrada:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada'
      });
    }

    console.log('✅ [FACTURA CONTROLLER] Factura encontrada:', factura.numeroFactura);

    res.status(200).json({
      success: true,
      factura
    });

  } catch (error) {
    console.error('💥 [FACTURA CONTROLLER] Error obteniendo factura:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener factura',
      error: error.message
    });
  }
};

// ✅ ACTUALIZAR FACTURA
exports.updateFactura = async (req, res) => {
  try {
    console.log('\n✏️ [FACTURA CONTROLLER] Actualizando factura:', req.params.id);
    console.log('✏️ [FACTURA CONTROLLER] Datos:', req.body);
    
    const factura = await FacturaLocal.update(req.params.id, req.body);

    if (!factura) {
      console.log('❌ [FACTURA CONTROLLER] Factura no encontrada para actualizar');
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada'
      });
    }

    console.log('✅ [FACTURA CONTROLLER] Factura actualizada:', factura.numeroFactura);

    res.status(200).json({
      success: true,
      message: 'Factura actualizada',
      factura
    });

  } catch (error) {
    console.error('💥 [FACTURA CONTROLLER] Error actualizando factura:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar factura',
      error: error.message
    });
  }
};

// ✅ ANULAR FACTURA
exports.anularFactura = async (req, res) => {
  try {
    console.log('\n🚫 [FACTURA CONTROLLER] Anulando factura:', req.params.id);
    
    const factura = await FacturaLocal.anular(req.params.id);

    if (!factura) {
      console.log('❌ [FACTURA CONTROLLER] Factura no encontrada para anular');
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada'
      });
    }

    console.log('✅ [FACTURA CONTROLLER] Factura anulada:', factura.numeroFactura);

    res.status(200).json({
      success: true,
      message: 'Factura anulada',
      factura
    });

  } catch (error) {
    console.error('💥 [FACTURA CONTROLLER] Error anulando factura:', error);
    res.status(500).json({
      success: false,
      message: 'Error al anular factura',
      error: error.message
    });
  }
};

// ✅ ELIMINAR FACTURA - VERSIÓN FINAL
exports.deleteFactura = async (req, res) => {
  try {
    console.log('\n🗑️ [FACTURA CONTROLLER] ========== INICIO ELIMINACIÓN ==========');
    console.log('🗑️ [FACTURA CONTROLLER] ID recibido:', req.params.id);
    
    // PASO 1: Obtener factura ANTES de eliminar
    const factura = await FacturaLocal.getById(req.params.id);

    if (!factura) {
      console.log('❌ [FACTURA CONTROLLER] Factura no encontrada:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada'
      });
    }

    console.log('✅ [FACTURA CONTROLLER] Factura encontrada:', factura.numeroFactura);
    
    // PASO 2: Guardar datos de la factura
    const facturaData = {
      _id: factura._id,
      numeroFactura: factura.numeroFactura,
      cliente: factura.cliente,
      total: factura.total,
      productos: factura.productos,
      fechaEmision: factura.fechaEmision
    };
    
    console.log('📋 [FACTURA CONTROLLER] Datos guardados:', {
      numero: facturaData.numeroFactura,
      cliente: facturaData.cliente?.nombre || 'N/A',
      total: facturaData.total
    });
    
    // PASO 3: Eliminar de SQLite
    console.log('🔄 [FACTURA CONTROLLER] Eliminando de SQLite...');
    const eliminado = await FacturaLocal.delete(req.params.id);
    
    if (!eliminado) {
      console.log('❌ [FACTURA CONTROLLER] No se pudo eliminar la factura');
      return res.status(500).json({
        success: false,
        message: 'No se pudo eliminar la factura'
      });
    }

    console.log('✅ [FACTURA CONTROLLER] Factura eliminada correctamente');
    console.log('🗑️ [FACTURA CONTROLLER] ========== FIN ELIMINACIÓN ==========\n');

    // PASO 4: Responder con éxito
    res.status(200).json({
      success: true,
      message: 'Factura eliminada correctamente',
      factura: facturaData
    });
    
  } catch (error) {
    console.error('💥 [FACTURA CONTROLLER] ========== ERROR EN ELIMINACIÓN ==========');
    console.error('💥 [FACTURA CONTROLLER] Error:', error.message);
    console.error('💥 [FACTURA CONTROLLER] Stack:', error.stack);
    console.error('💥 [FACTURA CONTROLLER] ========================================\n');
    
    res.status(500).json({
      success: false,
      message: 'Error al eliminar factura',
      error: error.message
    });
  }
};

// ✅ FUNCIÓN AUXILIAR
function getEmpresaPorDefecto() {
  return {
    nombre: 'MAXI BISEL',
    nit: '1036838690',
    direccion: 'Calle 50 #46-41, Medellín - Antioquia',
    telefono: '323 590 66 81',
    email: 'distribuidoramaxibisel@outlook.com',
    logo: null
  };
}

console.log('✅ [FACTURA CONTROLLER] Controlador cargado correctamente - SQLite');