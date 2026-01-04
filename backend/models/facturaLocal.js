const dbManager = require('../config/database');

class FacturaLocal {
  // ✅ OBTENER CONEXIÓN SQLite
  static getDB() {
    return dbManager.getSQLite();
  }

  // ✅ GENERAR NÚMERO CONSECUTIVO
  static async generarNumero() {
    try {
      console.log('🔢 [FacturaLocal] Generando número de factura...');
      
      const db = this.getDB();
      const sql = `
        SELECT numero_factura 
        FROM facturas 
        ORDER BY CAST(SUBSTR(numero_factura, 4) AS INTEGER) DESC 
        LIMIT 1
      `;

      const row = await db.get(sql);

      let numero = 1;
      if (row && row.numero_factura) {
        const match = row.numero_factura.match(/FAC(\d+)/);
        if (match) {
          numero = parseInt(match[1]) + 1;
        }
      }

      const numeroFactura = `FAC${numero.toString().padStart(6, '0')}`;
      console.log('✅ [FacturaLocal] Número generado:', numeroFactura);
      return numeroFactura;
    } catch (error) {
      console.error('❌ [FacturaLocal] Error generando número:', error);
      throw error;
    }
  }

  // ✅ CREAR FACTURA
  static async create(data) {
    try {
      console.log('💾 [FacturaLocal] Creando factura...');
      
      const db = this.getDB();
      const now = new Date().toISOString();

      // Iniciar transacción
      await db.run('BEGIN TRANSACTION');

      try {
        // Insertar factura principal
        const facturaSQL = `
          INSERT INTO facturas (
            numero_factura,
            empresa_nombre, empresa_nit, empresa_direccion, empresa_telefono, empresa_email,
            cliente_nombre, cliente_documento, cliente_telefono, cliente_direccion, cliente_email,
            subtotal, descuento, iva, total,
            observaciones, fecha_emision, creado_por, estado, salida_id,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const empresa = data.empresa || {};
        const cliente = data.cliente || {};

        const facturaValues = [
          data.numeroFactura,
          empresa.nombre || 'MAXI BISEL',
          empresa.nit || '',
          empresa.direccion || '',
          empresa.telefono || '',
          empresa.email || '',
          cliente.nombre || '',
          cliente.documento || '',
          cliente.telefono || '',
          cliente.direccion || '',
          cliente.email || '',
          data.subtotal,
          data.descuento || 0,
          data.iva || 0,
          data.total,
          data.observaciones || null,
          now,
          data.creadoPor || 'Sistema',
          data.estado || 'pendiente',
          data.salidaId || null,
          now,
          now
        ];

        const result = await db.run(facturaSQL, facturaValues);
        const facturaId = result.lastID;

        console.log('✅ [FacturaLocal] Factura insertada con ID:', facturaId);

        // Insertar productos
        if (data.productos && data.productos.length > 0) {
          const productoSQL = `
            INSERT INTO factura_productos (
              factura_id, product_id, nombre, descripcion,
              esfera, cilindro, adicion,
              cantidad, precio_unitario, subtotal
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          for (const prod of data.productos) {
            await db.run(productoSQL, [
              facturaId,
              prod.productId || prod._id || null,
              prod.nombre || '',
              prod.descripcion || '',
              prod.esfera || null,
              prod.cilindro || null,
              prod.adicion || null,
              prod.cantidad,
              prod.precioUnitario,
              prod.subtotal
            ]);
          }

          console.log(`✅ [FacturaLocal] ${data.productos.length} productos insertados`);
        }

        // Commit transacción
        await db.run('COMMIT');

        // Obtener factura completa
        const factura = await this.getById(facturaId);
        return factura;

      } catch (error) {
        // Rollback en caso de error
        await db.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('❌ [FacturaLocal] Error creando factura:', error);
      throw error;
    }
  }

  // ✅ OBTENER TODAS LAS FACTURAS
  static async getAll(options = {}) {
    try {
      console.log('\n📦 [FacturaLocal] ========== OBTENIENDO FACTURAS ==========');
      console.log('📦 [FacturaLocal] Opciones:', options);
      
      const db = this.getDB();
      
      let sql = 'SELECT * FROM facturas WHERE 1=1';
      const params = [];

      if (options.estado) {
        sql += ' AND estado = ?';
        params.push(options.estado);
      }

      if (options.cliente) {
        sql += ' AND cliente_nombre LIKE ?';
        params.push(`%${options.cliente}%`);
      }

      sql += ' ORDER BY fecha_emision DESC';

      if (options.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }

      if (options.skip) {
        sql += ' OFFSET ?';
        params.push(options.skip);
      }

      console.log('📦 [FacturaLocal] SQL:', sql);
      console.log('📦 [FacturaLocal] Params:', params);

      const rows = await db.all(sql, params);

      console.log('✅ [FacturaLocal] Rows obtenidas:', rows ? rows.length : 0);

      if (!rows || !Array.isArray(rows)) {
        console.warn('⚠️ [FacturaLocal] No se obtuvieron rows válidas');
        return [];
      }

      // Parsear cada factura y obtener sus productos
      const facturas = await Promise.all(
        rows.map(async (row) => {
          const productos = await this.getProductosByFacturaId(row.id);
          return this.parseRow(row, productos);
        })
      );

      console.log('✅ [FacturaLocal] Facturas parseadas:', facturas.length);
      console.log('📦 [FacturaLocal] ========== FIN ==========\n');
      
      return facturas;

    } catch (error) {
      console.error('💥 [FacturaLocal] Error obteniendo facturas:', error);
      throw error;
    }
  }

  // ✅ OBTENER FACTURA POR ID
  static async getById(id) {
    try {
      console.log('🔍 [FacturaLocal] Buscando factura por ID:', id);
      
      const db = this.getDB();
      const sql = 'SELECT * FROM facturas WHERE id = ?';
      const row = await db.get(sql, [id]);

      if (!row) {
        console.log('⚠️ [FacturaLocal] Factura no encontrada');
        return null;
      }

      const productos = await this.getProductosByFacturaId(id);
      const factura = this.parseRow(row, productos);
      
      console.log('✅ [FacturaLocal] Factura encontrada:', factura.numeroFactura);
      return factura;

    } catch (error) {
      console.error('❌ [FacturaLocal] Error obteniendo factura:', error);
      throw error;
    }
  }

  // ✅ OBTENER PRODUCTOS DE UNA FACTURA
  static async getProductosByFacturaId(facturaId) {
    try {
      const db = this.getDB();
      const sql = 'SELECT * FROM factura_productos WHERE factura_id = ?';
      const rows = await db.all(sql, [facturaId]);
      
      return (rows || []).map(row => ({
        productId: row.product_id,
        nombre: row.nombre,
        descripcion: row.descripcion,
        esfera: row.esfera,
        cilindro: row.cilindro,
        adicion: row.adicion,
        cantidad: row.cantidad,
        precioUnitario: row.precio_unitario,
        subtotal: row.subtotal
      }));
    } catch (error) {
      console.error('❌ [FacturaLocal] Error obteniendo productos:', error);
      return [];
    }
  }

  // ✅ ACTUALIZAR FACTURA
  static async update(id, data) {
    try {
      console.log('✏️ [FacturaLocal] Actualizando factura:', id);
      
      const db = this.getDB();
      const fields = [];
      const values = [];

      if (data.estado !== undefined) {
        fields.push('estado = ?');
        values.push(data.estado);
      }

      if (data.observaciones !== undefined) {
        fields.push('observaciones = ?');
        values.push(data.observaciones);
      }

      if (data.cliente && data.cliente.nombre !== undefined) {
        fields.push('cliente_nombre = ?');
        values.push(data.cliente.nombre);
      }

      if (fields.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);

      const sql = `UPDATE facturas SET ${fields.join(', ')} WHERE id = ?`;
      const result = await db.run(sql, values);

      if (result.changes === 0) {
        return null;
      }

      console.log('✅ [FacturaLocal] Factura actualizada');
      return await this.getById(id);

    } catch (error) {
      console.error('❌ [FacturaLocal] Error actualizando factura:', error);
      throw error;
    }
  }

  // ✅ ANULAR FACTURA
  static async anular(id) {
    try {
      console.log('🚫 [FacturaLocal] Anulando factura:', id);
      
      const db = this.getDB();
      const sql = 'UPDATE facturas SET estado = ?, updated_at = ? WHERE id = ?';
      const values = ['anulada', new Date().toISOString(), id];

      const result = await db.run(sql, values);

      if (result.changes === 0) {
        return null;
      }

      console.log('✅ [FacturaLocal] Factura anulada');
      return await this.getById(id);

    } catch (error) {
      console.error('❌ [FacturaLocal] Error anulando factura:', error);
      throw error;
    }
  }

  // ✅ ELIMINAR FACTURA
  static async delete(id) {
    try {
      console.log('🗑️ [FacturaLocal] Eliminando factura ID:', id);

      const db = this.getDB();
      
      // Obtener factura antes de eliminar
      const factura = await this.getById(id);
      
      if (!factura) {
        console.log('⚠️ [FacturaLocal] Factura no encontrada');
        return false;
      }

      console.log('✅ [FacturaLocal] Factura encontrada:', factura.numeroFactura);

      // Eliminar (los productos se eliminan automáticamente por CASCADE)
      const sql = 'DELETE FROM facturas WHERE id = ?';
      const result = await db.run(sql, [id]);

      if (result.changes === 0) {
        console.log('⚠️ [FacturaLocal] No se eliminó ninguna factura');
        return false;
      }

      console.log('✅ [FacturaLocal] Factura eliminada correctamente');
      return true;

    } catch (error) {
      console.error('❌ [FacturaLocal] Error eliminando factura:', error);
      throw error;
    }
  }

  // ✅ PARSEAR FILA DE BASE DE DATOS
  static parseRow(row, productos = []) {
    if (!row) {
      console.warn('⚠️ [FacturaLocal] Intento de parsear row nulo');
      return null;
    }

    try {
      return {
        _id: row.id,
        empresa: {
          nombre: row.empresa_nombre,
          nit: row.empresa_nit,
          direccion: row.empresa_direccion,
          telefono: row.empresa_telefono,
          email: row.empresa_email
        },
        numeroFactura: row.numero_factura,
        cliente: {
          nombre: row.cliente_nombre,
          documento: row.cliente_documento,
          telefono: row.cliente_telefono,
          direccion: row.cliente_direccion,
          email: row.cliente_email
        },
        productos: productos,
        subtotal: row.subtotal,
        descuento: row.descuento,
        iva: row.iva,
        total: row.total,
        observaciones: row.observaciones,
        salidaId: row.salida_id,
        creadoPor: row.creado_por,
        estado: row.estado,
        fechaEmision: row.fecha_emision,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('❌ [FacturaLocal] Error parseando row:', error);
      throw error;
    }
  }
}

module.exports = FacturaLocal;

console.log('✅ [FacturaLocal] Modelo cargado correctamente - Compatible con estructura SQLite');