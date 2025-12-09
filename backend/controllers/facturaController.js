const Factura = require('../models/factura');

// CREAR FACTURA
exports.createFactura = async (req, res) => {
    try {
        console.log('\n💰 [FACTURA] Creando nueva factura...');
        
        const { empresa, cliente, productos, observaciones, salidaId, aplicarIVA, tasaIVA } = req.body;
        
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
        const numeroFactura = await generarNumeroFactura();
        
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
        
        // ✅ CORRECCIÓN CRÍTICA: Calcular IVA correctamente
        let iva = 0;
        
        // Si aplicarIVA está explícitamente en false, no calcular IVA
        if (aplicarIVA === false) {
            iva = 0;
            console.log('📋 [FACTURA] IVA desactivado explícitamente');
        } 
        // Si hay un IVA explícito en el body, usarlo (incluso si es 0)
        else if (req.body.iva !== undefined && req.body.iva !== null) {
            iva = parseFloat(req.body.iva) || 0;
            console.log('📋 [FACTURA] IVA manual:', iva);
        }
        // Si hay tasa de IVA, calcularla
        else if (tasaIVA !== undefined && tasaIVA !== null) {
            iva = subtotal * (parseFloat(tasaIVA) / 100);
            console.log('📋 [FACTURA] IVA calculado con tasa:', tasaIVA + '%');
        }
        // Por defecto: SIN IVA (cambio de comportamiento)
        else {
            iva = 0;
            console.log('📋 [FACTURA] IVA por defecto: 0 (sin IVA)');
        }
        
        const total = subtotal - descuento + iva;
        
        console.log('💵 [FACTURA] Totales calculados:', {
            subtotal,
            descuento,
            iva,
            total,
            aplicarIVA: aplicarIVA ?? 'no especificado'
        });
        
        // Crear factura
        const factura = new Factura({
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
        
        await factura.save();
        
        console.log('✅ [FACTURA] Factura creada:', numeroFactura, '- Total:', total);
        
        res.status(201).json({
            success: true,
            message: 'Factura creada correctamente',
            factura: factura
        });
        
    } catch (error) {
        console.error('💥 [FACTURA] Error:', error);
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
        
        let query = {};
        
        if (estado) query.estado = estado;
        if (cliente) query['cliente.nombre'] = new RegExp(cliente, 'i');
        
        const facturas = await Factura.find(query)
            .sort({ fechaEmision: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));
        
        const total = await Factura.countDocuments(query);
        
        res.json({
            success: true,
            facturas,
            total,
            page: Math.floor(skip / limit) + 1,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// OBTENER FACTURA POR ID
exports.getFacturaById = async (req, res) => {
    try {
        const factura = await Factura.findById(req.params.id);
        
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
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ACTUALIZAR FACTURA
exports.updateFactura = async (req, res) => {
    try {
        const factura = await Factura.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
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
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ANULAR FACTURA
exports.anularFactura = async (req, res) => {
    try {
        const factura = await Factura.findByIdAndUpdate(
            req.params.id,
            { estado: 'anulada', updatedAt: Date.now() },
            { new: true }
        );
        
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
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ✅ NUEVO: ELIMINAR FACTURA (para el botón de eliminar del historial)
exports.deleteFactura = async (req, res) => {
    try {
        const factura = await Factura.findByIdAndDelete(req.params.id);
        
        if (!factura) {
            return res.status(404).json({
                success: false,
                message: 'Factura no encontrada'
            });
        }
        
        console.log('🗑️ [FACTURA] Factura eliminada:', factura.numeroFactura);
        
        res.json({
            success: true,
            message: 'Factura eliminada correctamente',
            factura
        });
    } catch (error) {
        console.error('💥 [FACTURA] Error al eliminar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// FUNCIONES AUXILIARES
async function generarNumeroFactura() {
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    
    // Buscar el último consecutivo del mes
    const ultimaFactura = await Factura.findOne({
        numeroFactura: new RegExp(`^FAC-${año}${mes}`)
    }).sort({ numeroFactura: -1 });
    
    let consecutivo = 1;
    if (ultimaFactura) {
        const ultimoConsecutivo = parseInt(ultimaFactura.numeroFactura.slice(-5));
        consecutivo = ultimoConsecutivo + 1;
    }
    
    return `FAC-${año}${mes}${String(consecutivo).padStart(5, '0')}`;
}

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