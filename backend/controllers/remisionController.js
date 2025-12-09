// backend/controllers/remisionController.js
const Remision = require('../models/remision');

// ============================================================================
// CREAR REMISIÓN
// ============================================================================
exports.createRemision = async (req, res) => {
    try {
        console.log('\n📄 [REMISION] Creando nueva remisión...');
        
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
        const numeroRemision = await generarNumeroRemision();
        
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
        const iva = req.body.iva || 0;
        const total = subtotal - descuento + iva;
        
        // Crear remisión
        const remision = new Remision({
            empresa: empresa || getEmpresaPorDefecto(),
            numeroRemision,
            cliente,
            productos: productosConSubtotal,
            subtotal,
            descuento,
            iva,
            total,
            observaciones,
            salidaId,
            creadoPor: req.user ? req.user.name : 'Sistema'
        });
        
        await remision.save();
        
        console.log('✅ [REMISION] Remisión creada:', numeroRemision);
        
        res.status(201).json({
            success: true,
            message: 'Remisión creada correctamente',
            remision: remision
        });
        
    } catch (error) {
        console.error('💥 [REMISION] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear remisión',
            error: error.message
        });
    }
};

// ============================================================================
// OBTENER TODAS LAS REMISIONES
// ============================================================================
exports.getAllRemisiones = async (req, res) => {
    try {
        const remisiones = await Remision.find()
            .sort({ fechaEmision: -1 })
            .limit(100);
        
        res.json({
            success: true,
            remisiones
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================================================
// OBTENER REMISIÓN POR ID
// ============================================================================
exports.getRemisionById = async (req, res) => {
    try {
        const remision = await Remision.findById(req.params.id);
        
        if (!remision) {
            return res.status(404).json({
                success: false,
                message: 'Remisión no encontrada'
            });
        }
        
        res.json({
            success: true,
            remision
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================================================
// ACTUALIZAR REMISIÓN
// ============================================================================
exports.updateRemision = async (req, res) => {
    try {
        const remision = await Remision.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!remision) {
            return res.status(404).json({
                success: false,
                message: 'Remisión no encontrada'
            });
        }
        
        res.json({
            success: true,
            message: 'Remisión actualizada',
            remision
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================================================
// ELIMINAR REMISIÓN
// ============================================================================
exports.deleteRemision = async (req, res) => {
    try {
        const remision = await Remision.findByIdAndDelete(req.params.id);
        
        if (!remision) {
            return res.status(404).json({
                success: false,
                message: 'Remisión no encontrada'
            });
        }
        
        res.json({
            success: true,
            message: 'Remisión eliminada'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

async function generarNumeroRemision() {
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    
    // Buscar el último consecutivo del mes
    const ultimaRemision = await Remision.findOne({
        numeroRemision: new RegExp(`^${año}${mes}`)
    }).sort({ numeroRemision: -1 });
    
    let consecutivo = 1;
    if (ultimaRemision) {
        const ultimoConsecutivo = parseInt(ultimaRemision.numeroRemision.slice(-4));
        consecutivo = ultimoConsecutivo + 1;
    }
    
    return `${año}${mes}${String(consecutivo).padStart(4, '0')}`;
}

function getEmpresaPorDefecto() {
    // ⚠️ IMPORTANTE: Cambiar esta información por los datos de tu empresa
    return {
        nombre: 'TU EMPRESA ÓPTICA S.A.S',
        nit: '900.123.456-7',
        direccion: 'Calle 123 #45-67, Bogotá D.C.',
        telefono: '(601) 234-5678',
        email: 'contacto@tuempresa.com',
        logo: null
    };
}