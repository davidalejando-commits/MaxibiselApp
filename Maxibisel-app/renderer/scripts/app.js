//Script principal de la aplicación - VERSIÓN SINCRONIZADA CORREGIDA
import { authManager } from './auth.js';
import { dataSync } from './dataSync.js';
import { eventManager } from './eventManager.js';
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
    events: eventManager,
    sync: dataSync
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

// ✅ FUNCIÓN DE INICIALIZACIÓN MEJORADA
async function initializeApp() {
    console.log('🚀 Iniciando aplicación con sistema de sincronización...');
    
    try {
        // ✅ PASO 1: Verificar dependencias críticas
        if (!eventManager) {
            throw new Error('eventManager no está disponible');
        }
        
        // ✅ PASO 2: Inicializar sistemas centrales PRIMERO
        console.log('🔄 Inicializando sistemas centrales...');
        
        // Verificar que eventManager tenga los métodos necesarios
        if (typeof eventManager.init === 'function') {
            eventManager.init();
        }
        
        dataSync.init();
        
        // ✅ PASO 3: Configurar listeners globales
        await setupGlobalEventListeners();
        
        // ✅ PASO 4: Inicializar gestores en orden de dependencias
        console.log('🔧 Inicializando gestores de la aplicación...');
        
        // Primero UI y Auth (no dependen de datos)
        if (authManager && typeof authManager.init === 'function') {
            authManager.init();
        }
        
        if (uiManager && typeof uiManager.init === 'function') {
            uiManager.init();
        }
        
        // Luego gestores que pueden depender de datos
        const managers = [productManager, salesManager, transactionManager, userManager];
        
        for (const manager of managers) {
            if (manager && typeof manager.init === 'function') {
                try {
                    await manager.init();
                } catch (error) {
                    console.error(`❌ Error inicializando gestor:`, error);
                    // Continuar con otros gestores
                }
            }
        }
        
        // ✅ PASO 5: Configurar sistemas adicionales
        setupNavigationSync();
        setupHeartbeat();
        
        // ✅ PASO 6: Verificar sesión existente (con manejo de errores)
        if (authManager && typeof authManager.checkSession === 'function') {
            try {
                await authManager.checkSession();
            } catch (error) {
                console.error('❌ Error verificando sesión:', error);
                // No es crítico, continuar
            }
        }
        
        console.log('✅ Aplicación inicializada correctamente');
        
        // Log de estado inicial para debugging (con delay)
        setTimeout(() => {
            console.log('📋 Estado inicial del sistema:');
            if (typeof window.debugSync === 'function') {
                window.debugSync();
            }
        }, 2000);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error crítico durante inicialización:', error);
        
        // Mostrar error al usuario de forma segura
        if (uiManager && typeof uiManager.showAlert === 'function') {
            uiManager.showAlert('Error crítico al inicializar la aplicación. Recarga la página.', 'danger');
        } else {
            // Fallback si uiManager no está disponible
            alert('Error crítico al inicializar la aplicación. Por favor recarga la página.');
        }
        
        return false;
    }
}

// ✅ FUNCIÓN CORREGIDA: setupGlobalEventListeners con verificaciones
async function setupGlobalEventListeners() {
    console.log('🔧 Configurando listeners globales...');
    
    try {
        // Verificar que eventManager esté disponible
        if (!eventManager || typeof eventManager.on !== 'function') {
            console.error('❌ eventManager no está disponible para listeners');
            return;
        }

        // Listener para errores de sincronización
        eventManager.on('sync:error', (error) => {
            console.error('💥 Error de sincronización:', error);
            if (uiManager && typeof uiManager.showAlert === 'function') {
                uiManager.showAlert('Error de sincronización: ' + (error.message || 'Error desconocido'), 'danger');
            }
        });
        
        // Listener para estado de conexión
        eventManager.on('connection:lost', () => {
            if (uiManager && typeof uiManager.showAlert === 'function') {
                uiManager.showAlert('Conexión perdida. Reintentando...', 'warning');
            }
        });
        
        eventManager.on('connection:restored', () => {
            if (uiManager && typeof uiManager.showAlert === 'function') {
                uiManager.showAlert('Conexión restaurada', 'success');
            }
            // Refrescar todos los datos
            if (dataSync && typeof dataSync.refreshAllData === 'function') {
                dataSync.refreshAllData().catch(err => {
                    console.error('❌ Error refrescando datos tras reconexión:', err);
                });
            }
        });
        
        // Listener para cambios de autenticación
        eventManager.on('auth:logout', () => {
            console.log('🚪 Usuario cerró sesión, limpiando caché...');
            if (dataSync && typeof dataSync.destroy === 'function') {
                dataSync.destroy();
            }
            if (dataSync && typeof dataSync.init === 'function') {
                dataSync.init(); // Reinicializar limpio
            }
        });
        
        // Listener para operaciones batch (múltiples cambios)
        eventManager.on('data:batch:updated', (updates) => {
            console.log('📦 Actualización batch recibida:', updates?.length || 0, 'elementos');
            if (Array.isArray(updates)) {
                updates.forEach(update => {
                    try {
                        if (update?.type === 'product') {
                            eventManager.emit('data:product:updated', update.data);
                        }
                    } catch (error) {
                        console.error('❌ Error procesando actualización batch:', error);
                    }
                });
            }
        });

        console.log('✅ Listeners globales configurados');
        
    } catch (error) {
        console.error('❌ Error configurando listeners globales:', error);
    }
}

// ✅ FUNCIÓN CORREGIDA: setupNavigationSync con verificaciones
function setupNavigationSync() {
    console.log('🔧 Configurando sincronización de navegación...');
    
    try {
        if (!eventManager || typeof eventManager.on !== 'function') {
            console.warn('⚠️ eventManager no disponible para navegación');
            return;
        }

        // Escuchar cambios de vista
        eventManager.on('view:changed', (viewName) => {
            console.log(`👁️ Vista cambiada a: ${viewName}`);
            
            // Refrescar datos cuando se cambia a una vista crítica
            try {
                switch (viewName) {
                    case 'products':
                        console.log('📦 Vista de productos activa');
                        break;
                    case 'sales':
                        console.log('🛒 Vista de ventas activa');
                        break;
                    case 'transactions':
                        console.log('📊 Vista de transacciones activa');
                        break;
                }
            } catch (error) {
                console.error('❌ Error en cambio de vista:', error);
            }
        });
        
        // Detectar cambios de visibilidad de la ventana
        document.addEventListener('visibilitychange', () => {
            try {
                if (!document.hidden) {
                    console.log('👁️ Ventana visible nuevamente, verificando datos...');
                    // Opcional: refrescar datos cuando la ventana vuelve a ser visible
                    // if (dataSync && typeof dataSync.refreshAllData === 'function') {
                    //     dataSync.refreshAllData();
                    // }
                }
            } catch (error) {
                console.error('❌ Error en visibilitychange:', error);
            }
        });

        console.log('✅ Sincronización de navegación configurada');
        
    } catch (error) {
        console.error('❌ Error configurando sincronización de navegación:', error);
    }
}

// ✅ FUNCIÓN CORREGIDA: Sistema de heartbeat con mejor manejo de errores
function setupHeartbeat() {
    console.log('💓 Configurando sistema de heartbeat...');
    
    try {
        let heartbeatInterval;
        let isConnected = true;
        
        const startHeartbeat = () => {
            heartbeatInterval = setInterval(async () => {
                try {
                    // Verificar conexión con el backend (si la API está disponible)
                    if (window.api && typeof window.api.health === 'function') {
                        const health = await window.api.health();
                        
                        if (!isConnected) {
                            console.log('💓 Conexión restaurada');
                            isConnected = true;
                            if (eventManager && typeof eventManager.emit === 'function') {
                                eventManager.emit('connection:restored');
                            }
                        }
                    }
                    
                } catch (error) {
                    if (isConnected) {
                        console.log('💔 Conexión perdida');
                        isConnected = false;
                        if (eventManager && typeof eventManager.emit === 'function') {
                            eventManager.emit('connection:lost');
                        }
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
        
        // Iniciar heartbeat solo si tenemos API disponible
        if (window.api) {
            startHeartbeat();
            
            // Limpiar al cerrar
            window.addEventListener('beforeunload', stopHeartbeat);
            console.log('✅ Sistema de heartbeat configurado');
        } else {
            console.warn('⚠️ API no disponible, saltando configuración de heartbeat');
        }
        
    } catch (error) {
        console.error('❌ Error configurando heartbeat:', error);
    }
}

// ✅ INICIALIZACIÓN SEGURA CON MÚLTIPLES ESTRATEGIAS
function safeInitialize() {
    // Estrategia 1: DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    }
    // Estrategia 2: Si el DOM ya está listo
    else if (document.readyState === 'interactive' || document.readyState === 'complete') {
        // Pequeño delay para asegurar que todos los módulos estén cargados
        setTimeout(initializeApp, 100);
    }
    // Estrategia 3: Fallback con load event
    else {
        window.addEventListener('load', initializeApp);
    }
}

// Ejecutar inicialización segura
safeInitialize();

// ✅ FUNCIÓN DE LIMPIEZA GLOBAL MEJORADA
window.addEventListener('beforeunload', () => {
    console.log('🧹 Limpiando recursos de la aplicación...');
    
    try {
        // Destruir gestores que tengan método destroy
        if (window.appManagers) {
            Object.entries(window.appManagers).forEach(([name, manager]) => {
                if (manager && typeof manager.destroy === 'function') {
                    try {
                        manager.destroy();
                        console.log(`✅ ${name} destruido`);
                    } catch (error) {
                        console.error(`❌ Error destruyendo ${name}:`, error);
                    }
                }
            });
        }
        
        // Limpiar sistemas centrales
        if (eventManager && typeof eventManager.clear === 'function') {
            eventManager.clear();
        }
        
        if (dataSync && typeof dataSync.destroy === 'function') {
            dataSync.destroy();
        }
        
        console.log('✅ Limpieza completada');
        
    } catch (error) {
        console.error('❌ Error durante limpieza:', error);
    }
});

// ✅ FUNCIONES UTILITARIAS GLOBALES MEJORADAS
window.syncUtils = {
    // Forzar actualización de todos los datos
    refreshAll: async () => {
        console.log('🔄 Forzando actualización de todos los datos...');
        try {
            if (dataSync && typeof dataSync.refreshAllData === 'function') {
                return await dataSync.refreshAllData();
            } else {
                console.error('❌ dataSync.refreshAllData no está disponible');
                return null;
            }
        } catch (error) {
            console.error('❌ Error en refreshAll:', error);
            throw error;
        }
    },
    
    // Limpiar caché específico
    clearCache: (dataType) => {
        console.log(`🗑️ Limpiando caché de: ${dataType}`);
        try {
            if (dataSync && typeof dataSync.invalidateCache === 'function') {
                dataSync.invalidateCache(dataType);
            } else {
                console.error('❌ dataSync.invalidateCache no está disponible');
            }
        } catch (error) {
            console.error('❌ Error limpiando cache:', error);
        }
    },
    
    // Simular evento para testing
    triggerEvent: (eventName, data) => {
        console.log(`🎯 Simulando evento: ${eventName}`);
        try {
            if (eventManager && typeof eventManager.emit === 'function') {
                eventManager.emit(eventName, data);
            } else {
                console.error('❌ eventManager.emit no está disponible');
            }
        } catch (error) {
            console.error('❌ Error disparando evento:', error);
        }
    },
    
    // Ver estado completo
    getState: () => {
        try {
            return {
                cache: dataSync?.getCacheStats ? dataSync.getCacheStats() : 'N/A',
                subscribers: dataSync?.getSubscriberStats ? dataSync.getSubscriberStats() : 'N/A',
                events: eventManager?.getStats ? eventManager.getStats() : 'N/A'
            };
        } catch (error) {
            console.error('❌ Error obteniendo estado:', error);
            return { error: error.message };
        }
    },
    
    // Habilitar/deshabilitar debug
    setDebug: (enabled) => {
        try {
            if (eventManager && typeof eventManager.setDebug === 'function') {
                eventManager.setDebug(enabled);
                console.log(`🔧 Debug mode: ${enabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
            } else {
                console.error('❌ eventManager.setDebug no está disponible');
            }
        } catch (error) {
            console.error('❌ Error configurando debug:', error);
        }
    }
};

// ✅ MANEJO AVANZADO DE ERRORES MEJORADO
window.addEventListener('error', (event) => {
    console.error('💥 Error global capturado:', event.error);
    
    try {
        // Si es un error de sincronización, intentar recuperación
        if (event.error?.message?.includes('sync') || event.error?.message?.includes('data')) {
            console.log('🔄 Intentando recuperación automática...');
            setTimeout(() => {
                if (dataSync && typeof dataSync.refreshAllData === 'function') {
                    dataSync.refreshAllData().catch(err => {
                        console.error('❌ Falló la recuperación automática:', err);
                        if (uiManager && typeof uiManager.showAlert === 'function') {
                            uiManager.showAlert('Error del sistema. Por favor, recargue la aplicación.', 'danger');
                        }
                    });
                }
            }, 1000);
        }
    } catch (recoveryError) {
        console.error('❌ Error en recuperación automática:', recoveryError);
    }
});

// ✅ CONFIGURACIÓN DE TECLAS RÁPIDAS MEJORADA (solo en desarrollo)
document.addEventListener('keydown', (event) => {
    try {
        // Ctrl + Shift + D = Debug info
        if (event.ctrlKey && event.shiftKey && event.key === 'D') {
            console.log('🔍 INFORMACIÓN DE DEBUG SOLICITADA');
            if (typeof window.debugSync === 'function') {
                window.debugSync();
            } else {
                console.log('🔍 Estado básico:', window.syncUtils.getState());
            }
            event.preventDefault();
        }
        
        // Ctrl + Shift + R = Refresh all data
        if (event.ctrlKey && event.shiftKey && event.key === 'R') {
            console.log('🔄 RECARGA MANUAL DE DATOS SOLICITADA');
            window.syncUtils.refreshAll().then(() => {
                if (uiManager && typeof uiManager.showAlert === 'function') {
                    uiManager.showAlert('Datos actualizados', 'success');
                }
            }).catch(error => {
                console.error('❌ Error en recarga manual:', error);
                if (uiManager && typeof uiManager.showAlert === 'function') {
                    uiManager.showAlert('Error actualizando datos', 'danger');
                }
            });
            event.preventDefault();
        }
        
        // Ctrl + Shift + C = Clear cache
        if (event.ctrlKey && event.shiftKey && event.key === 'C') {
            console.log('🗑️ LIMPIEZA DE CACHÉ SOLICITADA');
            if (dataSync && dataSync.cache && typeof dataSync.cache.clear === 'function') {
                dataSync.cache.clear();
                if (uiManager && typeof uiManager.showAlert === 'function') {
                    uiManager.showAlert('Caché limpiado', 'info');
                }
            } else {
                console.error('❌ No se puede limpiar el caché');
            }
            event.preventDefault();
        }
        
    } catch (error) {
        console.error('❌ Error en manejo de teclas rápidas:', error);
    }
});