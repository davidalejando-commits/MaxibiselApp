export const eventManager = {
    listeners: new Map(),
    eventHistory: [],
    debug: true,
    maxHistorySize: 100,
    initialized: false,

    init() {
        if (this.initialized) {
            console.warn('EventManager ya estaba inicializado');
            return;
        }

        console.log('🎯 Inicializando EventManager...');
        this.setupGlobalErrorHandling();
        this.initialized = true;
        console.log('✅ EventManager inicializado correctamente');
    },

    setupGlobalErrorHandling() {
        this.originalEmit = this.emit.bind(this);
        this.emit = this.safeEmit.bind(this);
    },

    on(eventName, callback, options = {}) {
        if (typeof eventName !== 'string' || typeof callback !== 'function') {
            throw new Error('EventManager.on: eventName debe ser string y callback debe ser function');
        }

        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        const listenerInfo = {
            callback,
            once: options.once || false,
            priority: options.priority || 0,
            id: this.generateId()
        };

        this.listeners.get(eventName).push(listenerInfo);

        this.listeners.get(eventName).sort((a, b) => b.priority - a.priority);

        if (this.debug) {
            console.log(`📝 Listener registrado para "${eventName}" (ID: ${listenerInfo.id}, Prioridad: ${listenerInfo.priority})`);
        }

        return () => this.off(eventName, listenerInfo.id);
    },

    once(eventName, callback, options = {}) {
        return this.on(eventName, callback, { ...options, once: true });
    },

    off(eventName, callbackOrId) {
        if (!this.listeners.has(eventName)) {
            if (this.debug) {
                console.warn(`⚠️ Intento de desuscribir de evento inexistente: ${eventName}`);
            }
            return;
        }

        const callbacks = this.listeners.get(eventName);
        let removedCount = 0;

        if (typeof callbackOrId === 'string') {
            const index = callbacks.findIndex(item => item.id === callbackOrId);
            if (index > -1) {
                callbacks.splice(index, 1);
                removedCount = 1;
            }
        } else if (typeof callbackOrId === 'function') {
            const initialLength = callbacks.length;
            for (let i = callbacks.length - 1; i >= 0; i--) {
                if (callbacks[i].callback === callbackOrId) {
                    callbacks.splice(i, 1);
                }
            }
            removedCount = initialLength - callbacks.length;
        }

        if (callbacks.length === 0) {
            this.listeners.delete(eventName);
        }

        if (this.debug && removedCount > 0) {
            console.log(`🚫 ${removedCount} listener(s) removido(s) de "${eventName}"`);
        }
    },

    safeEmit(eventName, data, options = {}) {
        try {
            return this.originalEmit(eventName, data, options);
        } catch (error) {
            console.error(`💥 Error crítico al emitir evento "${eventName}":`, error);

            try {
                this.originalEmit('eventmanager:error', {
                    originalEvent: eventName,
                    error: error.message,
                    data: data
                });
            } catch (innerError) {
                console.error('💥💥 Error crítico en manejo de errores:', innerError);
            }
            
            return false;
        }
    },

    emit(eventName, data, options = {}) {
        const startTime = performance.now();
        
        if (this.debug) {
            console.log(`🚀 Emitiendo evento: "${eventName}"`, data);
        }

        this.addToHistory(eventName, data, 'emitted');

        if (!this.listeners.has(eventName)) {
            if (this.debug) {
                console.log(`⚠️ No hay listeners para evento: "${eventName}"`);
            }
            return true;
        }

        const callbacks = this.listeners.get(eventName);
        const originalCallbacks = [...callbacks]; // Copia para evitar modificaciones durante iteración
        let successCount = 0;
        let errorCount = 0;

        originalCallbacks.forEach((listenerInfo, index) => {
            try {
                if (options.timeout) {
                    const timeoutId = setTimeout(() => {
                        throw new Error(`Timeout ejecutando listener para "${eventName}"`);
                    }, options.timeout);

                    Promise.resolve(listenerInfo.callback(data))
                        .finally(() => clearTimeout(timeoutId));
                } else {
                    listenerInfo.callback(data);
                }

                successCount++;

                if (listenerInfo.once) {
                    this.off(eventName, listenerInfo.id);
                }

            } catch (error) {
                errorCount++;
                console.error(`❌ Error en listener ${index + 1} para "${eventName}":`, error);
                this.addToHistory(eventName, { error: error.message, data }, 'error');

                listenerInfo.errorCount = (listenerInfo.errorCount || 0) + 1;
                if (listenerInfo.errorCount >= 3) {
                    console.warn(`🚫 Removiendo listener problemático para "${eventName}" después de 3 errores`);
                    this.off(eventName, listenerInfo.id);
                }
            }
        });

        const duration = performance.now() - startTime;

        if (this.debug) {
            console.log(`📢 Evento "${eventName}" procesado: ${successCount} exitosos, ${errorCount} errores (${duration.toFixed(2)}ms)`);
        }

        if (options.emitStats !== false) {
            setTimeout(() => {
                this.emit('eventmanager:stats', {
                    eventName,
                    successCount,
                    errorCount,
                    duration,
                    listenerCount: originalCallbacks.length
                }, { emitStats: false });
            }, 0);
        }

        return errorCount === 0;
    },

    async emitAsync(eventName, data, options = {}) {
        const startTime = performance.now();
        
        if (this.debug) {
            console.log(`🚀 Emitiendo evento asíncrono: "${eventName}"`, data);
        }

        if (!this.listeners.has(eventName)) {
            return true;
        }

        const callbacks = this.listeners.get(eventName);
        const promises = [];

        callbacks.forEach((listenerInfo) => {
            const promise = new Promise(async (resolve) => {
                try {
                    await Promise.resolve(listenerInfo.callback(data));
                    if (listenerInfo.once) {
                        this.off(eventName, listenerInfo.id);
                    }
                    
                    resolve({ success: true });
                } catch (error) {
                    console.error(`❌ Error en listener asíncrono para "${eventName}":`, error);
                    resolve({ success: false, error: error.message });
                }
            });

            promises.push(promise);
        });

        const results = await Promise.all(promises);
        const successCount = results.filter(r => r.success).length;
        const errorCount = results.length - successCount;

        const duration = performance.now() - startTime;

        if (this.debug) {
            console.log(`📢 Evento asíncrono "${eventName}" procesado: ${successCount} exitosos, ${errorCount} errores (${duration.toFixed(2)}ms)`);
        }

        return errorCount === 0;
    },
    addToHistory(eventName, data, type) {
        const entry = {
            eventName,
            type,
            timestamp: new Date().toISOString(),
            data: this.debug ? data : null // Solo guardar datos en modo debug
        };

        this.eventHistory.unshift(entry);

        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(0, this.maxHistorySize);
        }
    },

    generateId() {
        return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    getStats() {
        const stats = {
            totalEvents: this.listeners.size,
            totalListeners: 0,
            events: {},
            recentEvents: this.eventHistory.slice(0, 10),
            memoryUsage: this.getMemoryEstimate()
        };

        this.listeners.forEach((callbacks, eventName) => {
            stats.totalListeners += callbacks.length;
            stats.events[eventName] = {
                listenerCount: callbacks.length,
                priorities: callbacks.map(c => c.priority),
                hasOnceListeners: callbacks.some(c => c.once)
            };
        });

        return stats;
    },

    getMemoryEstimate() {
        let size = 0;

        this.listeners.forEach((callbacks, eventName) => {
            size += eventName.length * 2; // UTF-16
            size += callbacks.length * 100; // Estimación por callback
        });

        size += this.eventHistory.length * 200; // Estimación por entrada

        return Math.round(size / 1024) + ' KB';
    },

    clearEvent(eventName) {
        if (this.listeners.has(eventName)) {
            this.listeners.delete(eventName);
            if (this.debug) {
                console.log(`🧹 Listeners limpiados para: "${eventName}"`);
            }
        }
    },

    clear() {
        if (this.debug) {
            console.log('🧹 Limpiando todos los listeners de EventManager');
        }
        this.listeners.clear();
        this.eventHistory = [];
    },

    clearHistory() {
        this.eventHistory = [];
        if (this.debug) {
            console.log('🧹 Historial de eventos limpiado');
        }
    },

    setDebug(enabled) {
        this.debug = enabled;
        console.log(`🔧 EventManager debug mode: ${enabled ? 'ON' : 'OFF'}`);
        
        if (!enabled) {
            this.eventHistory.forEach(entry => {
                entry.data = null;
            });
        }
    },

    setMaxHistorySize(size) {
        this.maxHistorySize = Math.max(10, Math.min(1000, size));
        
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(0, this.maxHistorySize);
        }
        
        console.log(`📏 Tamaño máximo del historial establecido en: ${this.maxHistorySize}`);
    },

    healthCheck() {
        const stats = this.getStats();
        const issues = [];

        if (stats.totalListeners > 100) {
            issues.push(`Muchos listeners activos: ${stats.totalListeners}`);
        }

        Object.entries(stats.events).forEach(([eventName, info]) => {
            if (info.listenerCount > 10) {
                issues.push(`Evento "${eventName}" tiene ${info.listenerCount} listeners`);
            }
        });

        const memoryKB = parseInt(stats.memoryUsage);
        if (memoryKB > 1024) { // > 1MB
            issues.push(`Uso de memoria alto: ${stats.memoryUsage}`);
        }

        return {
            healthy: issues.length === 0,
            issues,
            stats
        };
    },

    destroy() {
        console.log('🧹 Destruyendo EventManager...');
        this.clear();
        this.initialized = false;
    }
};