// backend/models/facturaLocal.js
const dbManager = require('../config/database');

class FacturaLocal {
  // CREAR FACTURA
  static async create(facturaData) {
    const db = dbManager.getSQLite();
    
    try {
      await db.run('BEGIN TRANSACTION');

      // Insertar factura principal
      const result = await db.run(`
        INSERT INTO facturas (
          numero_factura, empresa_nombre, empresa_nit, empresa_direccion,
          empresa_telefono, empresa_email, cliente_nombre, cliente_documento,
          cliente_telefono, cliente_direccion, cliente_email,
          subtotal, descuento, iva, total, observaciones,
          fecha_emision, creado_por, estado, salida_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        facturaData.numeroFactura,
        facturaData.empresa.nombre,
        facturaData.empresa.nit,
        facturaData.empresa.direccion || null,
        facturaData.empresa.telefono || null,
        facturaData.empresa.email || null,
        facturaData.cliente.nombre,
        facturaData.cliente.documento || null,
        facturaData.cliente.telefono || null,
        facturaData.cliente.direccion || null,
        facturaData.cliente.email || null,
        facturaData.subtotal,
        facturaData.descuento || 0,
        facturaData.iva || 0,
        facturaData.total,
        facturaData.observaciones || null,
        facturaData.fechaEmision || new Date().toISOString(),
        facturaData.creadoPor || null,
        facturaData.estado || 'pendiente',
        facturaData.salidaId || null
      ]);

      const facturaId = result.lastID;

      // Insertar productos
      for (const producto of facturaData.productos) {
        await db.run(`
          INSERT INTO factura_productos (
            factura_id, product_id, nombre, descripcion,
            esfera, cilindro, adicion, cantidad, precio_unitario, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          facturaId,
          producto.productId || null,
          producto.nombre,
          producto.descripcion || null,
          producto.esfera || null,
          producto.cilindro || null,
          producto.adicion || null,
          producto.cantidad,
          producto.precioUnitario,
          producto.subtotal
        ]);
      }

      await db.run('COMMIT');

      // Retornar factura completa
      return await this.getById(facturaId);
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }

  // OBTENER POR ID
  static async getById(id) {
    const db = dbManager.getSQLite();

    const factura = await db.get(`
      SELECT * FROM facturas WHERE id = ?
    `, [id]);

    if (!factura) return null;

    const productos = await db.all(`
      SELECT * FROM factura_productos WHERE factura_id = ?
    `, [id]);

    if (!factura && typeof id === 'string') {
      factura = await db.get(`
        SELECT * FROM facturas WHERE numero_factura = ?
      `, [id]);
    }

    return this.formatFactura(factura, productos);
  }

  // LISTAR TODAS
  static async getAll(filters = {}) {
    const db = dbManager.getSQLite();

    let query = 'SELECT * FROM facturas WHERE 1=1';
    const params = [];

    if (filters.estado) {
      query += ' AND estado = ?';
      params.push(filters.estado);
    }

    if (filters.cliente) {
      query += ' AND cliente_nombre LIKE ?';
      params.push(`%${filters.cliente}%`);
    }

    if (filters.fechaDesde) {
      query += ' AND fecha_emision >= ?';
      params.push(filters.fechaDesde);
    }

    if (filters.fechaHasta) {
      query += ' AND fecha_emision <= ?';
      params.push(filters.fechaHasta);
    }

    query += ' ORDER BY fecha_emision DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.skip) {
      query += ' OFFSET ?';
      params.push(filters.skip);
    }

    const facturas = await db.all(query, params);

    // Cargar productos para cada factura
    const facturasCompletas = await Promise.all(
      facturas.map(async (factura) => {
        const productos = await db.all(`
          SELECT * FROM factura_productos WHERE factura_id = ?
        `, [factura.id]);
        return this.formatFactura(factura, productos);
      })
    );

    return facturasCompletas;
  }

  // ACTUALIZAR
  static async update(id, updateData) {
    const db = dbManager.getSQLite();

    const campos = [];
    const valores = [];

    if (updateData.estado) {
      campos.push('estado = ?');
      valores.push(updateData.estado);
    }

    if (updateData.observaciones !== undefined) {
      campos.push('observaciones = ?');
      valores.push(updateData.observaciones);
    }

    campos.push('updated_at = CURRENT_TIMESTAMP');
    valores.push(id);

    await db.run(`
      UPDATE facturas SET ${campos.join(', ')} WHERE id = ?
    `, valores);

    return await this.getById(id);
  }

  // ANULAR
  static async anular(id) {
    return await this.update(id, { estado: 'anulada' });
  }

  // ELIMINAR
  static async delete(id) {
    const db = dbManager.getSQLite();
    await db.run('DELETE FROM facturas WHERE id = ?', [id]);
  }

  // FORMATEAR FACTURA
  static formatFactura(factura, productos) {
    return {
      _id: factura.id,
      numeroFactura: factura.numero_factura,
      empresa: {
        nombre: factura.empresa_nombre,
        nit: factura.empresa_nit,
        direccion: factura.empresa_direccion,
        telefono: factura.empresa_telefono,
        email: factura.empresa_email
      },
      cliente: {
        nombre: factura.cliente_nombre,
        documento: factura.cliente_documento,
        telefono: factura.cliente_telefono,
        direccion: factura.cliente_direccion,
        email: factura.cliente_email
      },
      productos: productos.map(p => ({
        productId: p.product_id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        esfera: p.esfera,
        cilindro: p.cilindro,
        adicion: p.adicion,
        cantidad: p.cantidad,
        precioUnitario: p.precio_unitario,
        subtotal: p.subtotal
      })),
      subtotal: factura.subtotal,
      descuento: factura.descuento,
      iva: factura.iva,
      total: factura.total,
      observaciones: factura.observaciones,
      fechaEmision: factura.fecha_emision,
      creadoPor: factura.creado_por,
      estado: factura.estado,
      salidaId: factura.salida_id,
      createdAt: factura.created_at,
      updatedAt: factura.updated_at
    };
  }

  // GENERAR NÚMERO DE FACTURA
  static async generarNumero() {
    const db = dbManager.getSQLite();
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');

    const ultimaFactura = await db.get(`
      SELECT numero_factura 
      FROM facturas 
      WHERE numero_factura LIKE ?
      ORDER BY numero_factura DESC 
      LIMIT 1
    `, [`FAC-${año}${mes}%`]);

    let consecutivo = 1;
    if (ultimaFactura) {
      const ultimoConsecutivo = parseInt(ultimaFactura.numero_factura.slice(-5));
      consecutivo = ultimoConsecutivo + 1;
    }

    return `FAC-${año}${mes}${String(consecutivo).padStart(5, '0')}`;
  }
}

module.exports = FacturaLocal;