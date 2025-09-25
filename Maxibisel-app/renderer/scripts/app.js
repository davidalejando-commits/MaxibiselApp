//Script principal de la aplicación - VERSIÓN SINCRONIZADA
import { authManager } from './auth.js';
import { dataSync } from './dataSync.js'; // 🆕 NUEVO
import { eventManager } from './eventManager.js'; // 🆕 NUEVO
import { productManager } from './products.js';
import { salesManager } from './sales.js';
import { transactionManager } from './transactions.js';
import { uiManager } from './ui.js';
import { userManager } from './users.js';

// Variable global para gestores (útil para debugging)
window.appManagers = {
    auth: authManager,
    products: productManager,
    sales: salesManager,
    transactions: transactionManager,
    users: userManager,
    ui: uiManager,
    events: eventManager, // 🆕 NUEVO
    sync: dataSync // 🆕 NUEVO
};

// Variable global para debugging
window.debugSync = () => {
    console.log('🔍 ESTADO DEL SISTEMA DE SINCRONIZACIÓN:');
    console.log('📊 Estadísticas de caché:', dataSync.getCacheStats());
    console.log('📝 Estadísticas de suscriptores:', dataSync.getSubscriberStats());
    console.log('🎯 Estadísticas de eventos:', eventManager.getStats());
    
    // Mostrar datos en caché
    console.log('💾 Datos en caché:');
    dataSync.cache.forEach((data, type) => {
        console.log(`  ${type}: ${Array.isArray(data) ? data.length : 1} elementos`);
    });
};

// Inicializar la aplicación una vez que el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando aplicación con sistema de sincronización...');
    
    try {
        // 🆕 PASO 1: Inicializar sistemas centrales PRIMERO
        console.log('🔄 Inicializando sistemas centrales...');
        dataSync.init();
        
        // 🆕 PASO 2: Configurar listeners globales
        setupGlobalEventListeners();
        
        // 🆕 PASO 3: Inicializar componentes en orden
        console.log('🔧 Inicializando gestores de la aplicación...');
        authManager.init();
        uiManager.init();
        productManager.init();
        salesManager.init();
        transactionManager.init();
        userManager.init();
        
        // 🆕 PASO 4: Configurar navegación mejorada
        setupNavigationSync();
        
        // 🆕 PASO 5: Configurar sistema de heartbeat
        setupHeartbeat();
        
        // Verificar sesión existente
        authManager.checkSession();
        
        console.log('✅ Aplicación inicializada correctamente');
        
        // Log de estado inicial para debugging
        setTimeout(() => {
            console.log('📋 Estado inicial del sistema:');
            window.debugSync();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error durante inicialización:', error);
        uiManager.showAlert('Error al inicializar la aplicación', 'danger');
    }
});

// 🆕 NUEVO: Configurar listeners globales del sistema
function setupGlobalEventListeners() {
    console.log('🔧 Configurando listeners globales...');
    
    // Listener para errores de sincronización
    eventManager.on('sync:error', (error) => {
        console.error('💥 Error de sincronización:', error);
        uiManager.showAlert('Error de sincronización: ' + error.message, 'danger');
    });
    
    // Listener para estado de conexión
    eventManager.on('connection:lost', () => {
        uiManager.showAlert('Conexión perdida. Reintentando...', 'warning');
    });
    
    eventManager.on('connection:restored', () => {
        uiManager.showAlert('Conexión restaurada', 'success');
        // Refrescar todos los datos
        dataSync.refreshAllData();
    });
    
    // Listener para cambios de autenticación
    eventManager.on('auth:logout', () => {
        console.log('🚪 Usuario cerró sesión, limpiando caché...');
        dataSync.destroy();
        dataSync.init(); // Reinicializar limpio
    });
    
    // Listener para operaciones batch (múltiples cambios)
    eventManager.on('data:batch:updated', (updates) => {
        console.log('📦 Actualización batch recibida:', updates.length, 'elementos');
        updates.forEach(update => {
            if (update.type === 'product') {
                eventManager.emit('data:product:updated', update.data);
            }
        });
    });
}

// 🆕 NUEVO: Configurar sincronización en navegación
function setupNavigationSync() {
    console.log('🔧 Configurando sincronización de navegación...');
    
    // Escuchar cambios de vista
    eventManager.on('view:changed', (viewName) => {
        console.log(`👁️ Vista cambiada a: ${viewName}`);
        
        // Refrescar datos cuando se cambia a una vista crítica
        switch (viewName) {
            case 'products':
                // Los productos se mantienen sincronizados automáticamente
                console.log('📦 Vista de productos activa');
                break;
            case 'sales':
                // Verificar que los datos estén actualizados
                console.log('🛒 Vista de ventas activa');
                break;
            case 'transactions':
                // Refrescar datos de transacciones si es necesario
                console.log('📊 Vista de transacciones activa');
                break;
        }
    });
    
    // Detectar cambios de visibilidad de la ventana
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('👁️ Ventana visible nuevamente, verificando datos...');
            // Opcional: refrescar datos cuando la ventana vuelve a ser visible
            // dataSync.refreshAllData();
        }
    });
}

// 🆕 NUEVO: Sistema de heartbeat para mantener conexión activa
function setupHeartbeat() {
    console.log('💓 Configurando sistema de heartbeat...');
    
    let heartbeatInterval;
    let isConnected = true;
    
    const startHeartbeat = () => {
        heartbeatInterval = setInterval(async () => {
            try {
                // Verificar conexión con el backend
                const health = await window.api.health?.();
                
                if (!isConnected) {
                    console.log('💓 Conexión restaurada');
                    isConnected = true;
                    eventManager.emit('connection:restored');
                }
                
            } catch (error) {
                if (isConnected) {
                    console.log('💔 Conexión perdida');
                    isConnected = false;
                    eventManager.emit('connection:lost');
                }
            }
        }, 30000); // Verificar cada 30 segundos
    };
    
    const stopHeartbeat = () => {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    };
    
    // Iniciar heartbeat
    startHeartbeat();
    
    // Limpiar al cerrar
    window.addEventListener('beforeunload', stopHeartbeat);
}

// 🆕 NUEVO: Función de limpieza global mejorada
window.addEventListener('beforeunload', () => {
    console.log('🧹 Limpiando recursos de la aplicación...');
    
    try {
        // Destruir gestores que tengan método destroy
        Object.values(window.appManagers).forEach(manager => {
            if (typeof manager.destroy === 'function') {
                try {
                    manager.destroy();
                } catch (error) {
                    console.error('Error destruyendo gestor:', error);
                }
            }
        });
        
        // Limpiar sistemas centrales
        if (eventManager) {
            eventManager.clear();
        }
        
        if (dataSync) {
            dataSync.destroy();
        }
        
        console.log('✅ Limpieza completada');
        
    } catch (error) {
        console.error('❌ Error durante limpieza:', error);
    }
});

// 🆕 NUEVO: Funciones utilitarias globales para debugging y control
window.syncUtils = {
    // Forzar actualización de todos los datos
    refreshAll: () => {
        console.log('🔄 Forzando actualización de todos los datos...');
        return dataSync.refreshAllData();
    },
    
    // Limpiar caché específico
    clearCache: (dataType) => {
        console.log(`🗑️ Limpiando caché de: ${dataType}`);
        dataSync.invalidateCache(dataType);
    },
    
    // Simular evento para testing
    triggerEvent: (eventName, data) => {
        console.log(`🎯 Simulando evento: ${eventName}`);
        eventManager.emit(eventName, data);
    },
    
    // Ver estado completo
    getState: () => {
        return {
            cache: dataSync.getCacheStats(),
            subscribers: dataSync.getSubscriberStats(),
            events: eventManager.getStats()
        };
    },
    
    // Habilitar/deshabilitar debug
    setDebug: (enabled) => {
        eventManager.setDebug(enabled);
        console.log(`🔧 Debug mode: ${enabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
    }
};

// 🆕 NUEVO: Manejo avanzado de errores
window.addEventListener('error', (event) => {
    console.error('💥 Error global capturado:', event.error);
    
    // Si es un error de sincronización, intentar recuperación
    if (event.error.message.includes('sync') || event.error.message.includes('data')) {
        console.log('🔄 Intentando recuperación automática...');
        setTimeout(() => {
            dataSync.refreshAllData().catch(err => {
                console.error('❌ Falló la recuperación automática:', err);
                uiManager.showAlert('Error del sistema. Por favor, recargue la aplicación.', 'danger');
            });
        }, 1000);
    }
});

// 🆕 NUEVO: Configuración de teclas rápidas para debugging (solo en desarrollo)
document.addEventListener('keydown', (event) => {
    // Ctrl + Shift + D = Debug info
    if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        console.log('🔍 INFORMACIÓN DE DEBUG SOLICITADA');
        window.debugSync();
        event.preventDefault();
    }
    
    // Ctrl + Shift + R = Refresh all data
    if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        console.log('🔄 RECARGA MANUAL DE DATOS SOLICITADA');
        window.syncUtils.refreshAll().then(() => {
            uiManager.showAlert('Datos actualizados', 'success');
        });
        event.preventDefault();
    }
    
    // Ctrl + Shift + C = Clear cache
    if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        console.log('🗑️ LIMPIEZA DE CACHÉ SOLICITADA');
        dataSync.cache.clear();
        uiManager.showAlert('Caché limpiado', 'info');
        event.preventDefault();
    }
});