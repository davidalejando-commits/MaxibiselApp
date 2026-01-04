const FacturaLocal = require('../models/facturaLocal');

// CREAR FACTURA (usando SQLite)
exports.createFactura = async (req, res) => {
  try {
    console.log('\n💰 [FACTURA LOCAL] Creando nueva factura...');

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
    
    // ✅ IVA por defecto es 0 (sin IVA)
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

    console.log('✅ [FACTURA LOCAL] Factura creada:', numeroFactura, '- Total:', total);

    res.status(201).json({
      success: true,
      message: 'Factura creada correctamente',
      factura: factura
    });

  } catch (error) {
    console.error('💥 [FACTURA LOCAL] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear factura',
      error: error.message
    });
  }
};

// OBTENER TODAS LAS FACTURAS
exports.getAllFacturas = async (req, res) => {
  try {
    const { limit = 100, skip = 0, estado, cliente } = req.query;

    const facturas = await FacturaLocal.getAll({
      estado,
      cliente,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    res.json({
      success: true,
      facturas,
      total: facturas.length
    });
  } catch (error) {
    console.error('💥 Error obteniendo facturas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// OBTENER FACTURA POR ID
exports.getFacturaById = async (req, res) => {
  try {
    const factura = await FacturaLocal.getById(req.params.id);

    if (!factura) {
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada'
      });
    }

    res.json({
      success: true,
      factura
    });
  } catch (error) {
    console.error('💥 Error obteniendo factura:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ACTUALIZAR FACTURA
exports.updateFactura = async (req, res) => {
  try {
    const factura = await FacturaLocal.update(req.params.id, req.body);

    if (!factura) {
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Factura actualizada',
      factura
    });
  } catch (error) {
    console.error('💥 Error actualizando factura:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ANULAR FACTURA
exports.anularFactura = async (req, res) => {
  try {
    const factura = await FacturaLocal.anular(req.params.id);

    if (!factura) {
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Factura anulada',
      factura
    });
  } catch (error) {
    console.error('💥 Error anulando factura:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ELIMINAR FACTURA
exports.deleteFactura = async (req, res) => {
  try {
    console.log('🗑️ [FACTURA LOCAL] Intentando eliminar:', req.params.id);
    
    // Verificar que la factura existe
    const factura = await FacturaLocal.getById(req.params.id);

    if (!factura) {
      console.log('❌ [FACTURA LOCAL] Factura no encontrada:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Factura no encontrada'
      });
    }

    console.log('✅ [FACTURA LOCAL] Factura encontrada:', factura.numeroFactura);
    
    // Eliminar factura
    await FacturaLocal.delete(req.params.id);

    console.log('🗑️ [FACTURA LOCAL] Factura eliminada correctamente:', factura.numeroFactura);

    res.json({
      success: true,
      message: 'Factura eliminada correctamente',
      factura
    });
  } catch (error) {
    console.error('💥 [FACTURA LOCAL] Error al eliminar:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar factura',
      error: error.message
    });
  }
};


// FUNCIÓN AUXILIAR
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