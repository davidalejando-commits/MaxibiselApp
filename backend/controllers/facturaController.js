const Factura = require('../models/factura');

// CREAR FACTURA
exports.createFactura = async (req, res) => {
    try {
        console.log('\n💰 [FACTURA] Creando nueva factura...');
        
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
        const iva = req.body.iva || (subtotal * 0.19); // IVA del 19% por defecto
        const total = subtotal - descuento + iva;
        
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
        
        console.log('✅ [FACTURA] Factura creada:', numeroFactura);
        
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