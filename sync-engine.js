// Финансовый трекер - Реальный движок синхронизации
class SyncEngine {
    constructor() {
        this.cloudStorage = 'FinanceCloudSync';
        this.deviceId = this.generateDeviceId();
        this.username = null;
        this.lastSyncTimestamp = null;
        this.syncInProgress = false;
        this.pendingOperations = [];
        this.conflictResolver = new ConflictResolver();
        this.init();
    }

    // Инициализация движка синхронизации
    init() {
        console.log('Initializing Sync Engine with device ID:', this.deviceId);
        this.initializeCloudStorage();
        this.setupStorageListeners();
        this.setupPeriodicSync();
        this.cleanupOldData();
    }

    // Генерация уникального ID устройства
    generateDeviceId() {
        let deviceId = sessionStorage.getItem('sync_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            sessionStorage.setItem('sync_device_id', deviceId);
        }
        return deviceId;
    }

    // Инициализация облачного хранилища
    initializeCloudStorage() {
        if (!localStorage.getItem(this.cloudStorage)) {
            const cloudData = {
                version: '3.0.0',
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                users: {},
                transactions: {},
                devices: {},
                syncLog: [],
                locks: {}
            };
            localStorage.setItem(this.cloudStorage, JSON.stringify(cloudData));
            console.log('Cloud storage initialized');
        }
    }

    // Настройка слушателей событий storage
    setupStorageListeners() {
        window.addEventListener('storage', (e) => {
            if (e.key === this.cloudStorage && e.newValue) {
                this.handleStorageChange(e);
            }
        });

        // Слушаем события фокуса для синхронизации
        window.addEventListener('focus', () => {
            if (this.username && !this.syncInProgress) {
                this.performSync();
            }
        });

        // Слушаем события видимости
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.username && !this.syncInProgress) {
                this.performSync();
            }
        });
    }

    // Обработка изменений в storage
    handleStorageChange(event) {
        if (!this.username || this.syncInProgress) return;

        try {
            const newData = JSON.parse(event.newValue);
            const oldData = JSON.parse(event.oldValue || '{}');
            
            // Проверяем, есть ли изменения для нашего пользователя
            if (this.hasUserChanges(newData, oldData, this.username)) {
                console.log('Detected remote changes for user:', this.username);
                setTimeout(() => this.performSync(), 100);
            }
        } catch (error) {
            console.error('Error handling storage change:', error);
        }
    }

    // Проверка изменений для пользователя
    hasUserChanges(newData, oldData, username) {
        const newUserTransactions = newData.transactions[username] || [];
        const oldUserTransactions = oldData.transactions[username] || [];
        
        // Сравниваем количество транзакций
        if (newUserTransactions.length !== oldUserTransactions.length) {
            return true;
        }
        
        // Сравниваем временные метки последних изменений
        const newLastModified = newUserTransactions.length > 0 ? 
            newUserTransactions[newUserTransactions.length - 1].created_at : null;
        const oldLastModified = oldUserTransactions.length > 0 ? 
            oldUserTransactions[oldUserTransactions.length - 1].created_at : null;
        
        return newLastModified !== oldLastModified;
    }

    // Настройка периодической синхронизации
    setupPeriodicSync() {
        // Синхронизация каждые 3 секунды
        setInterval(() => {
            if (this.username && !this.syncInProgress && document.visibilityState === 'visible') {
                this.performSync();
            }
        }, 3000);
    }

    // Очистка старых данных
    cleanupOldData() {
        const cloudData = this.getCloudData();
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        // Очищаем старые логи синхронизации
        cloudData.syncLog = cloudData.syncLog.filter(log => 
            new Date(log.timestamp) > oneWeekAgo
        );
        
        // Очищаем старые блокировки
        Object.keys(cloudData.locks).forEach(key => {
            if (new Date(cloudData.locks[key].expiresAt) < now) {
                delete cloudData.locks[key];
            }
        });
        
        this.saveCloudData(cloudData);
    }

    // Получение данных из облака
    getCloudData() {
        try {
            return JSON.parse(localStorage.getItem(this.cloudStorage) || '{}');
        } catch (error) {
            console.error('Error reading cloud data:', error);
            return { users: {}, transactions: {}, devices: {}, syncLog: [], locks: {} };
        }
    }

    // Сохранение данных в облаке
    saveCloudData(data) {
        try {
            data.lastModified = new Date().toISOString();
            localStorage.setItem(this.cloudStorage, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving cloud data:', error);
            return false;
        }
    }

    // Регистрация пользователя
    registerUser(userData) {
        const cloudData = this.getCloudData();
        
        if (cloudData.users[userData.username]) {
            throw new Error('Пользователь уже существует');
        }
        
        cloudData.users[userData.username] = {
            ...userData,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
        
        cloudData.transactions[userData.username] = [];
        cloudData.devices[userData.username] = [];
        
        this.saveCloudData(cloudData);
        this.logSyncEvent('user_registered', userData.username);
        
        return true;
    }

    // Аутентификация пользователя
    authenticateUser(username, password) {
        const cloudData = this.getCloudData();
        const user = cloudData.users[username];
        
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        
        // Проверяем пароль
        const hash = this.hashPassword(password, user.salt);
        if (hash !== user.password_hash) {
            throw new Error('Неверный пароль');
        }
        
        // Обновляем время последнего входа
        user.lastLogin = new Date().toISOString();
        this.saveCloudData(cloudData);
        
        this.username = username;
        this.registerDevice();
        
        return user;
    }

    // Регистрация устройства
    registerDevice() {
        if (!this.username) return;
        
        const cloudData = this.getCloudData();
        const deviceInfo = {
            deviceId: this.deviceId,
            deviceName: this.getDeviceName(),
            deviceType: this.getDeviceType(),
            lastSeen: new Date().toISOString(),
            isActive: true,
            userAgent: navigator.userAgent
        };
        
        if (!cloudData.devices[this.username]) {
            cloudData.devices[this.username] = [];
        }
        
        // Удаляем старую запись устройства если есть
        cloudData.devices[this.username] = cloudData.devices[this.username].filter(
            device => device.deviceId !== this.deviceId
        );
        
        cloudData.devices[this.username].push(deviceInfo);
        this.saveCloudData(cloudData);
        
        console.log('Device registered:', deviceInfo);
    }

    // Получение имени устройства
    getDeviceName() {
        const ua = navigator.userAgent;
        if (ua.includes('iPhone')) return 'iPhone';
        if (ua.includes('iPad')) return 'iPad';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('Windows')) return 'Windows PC';
        if (ua.includes('Mac')) return 'Mac';
        if (ua.includes('Linux')) return 'Linux';
        return 'Unknown Device';
    }

    // Получение типа устройства
    getDeviceType() {
        const ua = navigator.userAgent;
        if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
        if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) return 'mobile';
        return 'desktop';
    }

    // Хеширование пароля
    hashPassword(password, salt) {
        if (!salt) {
            salt = Math.random().toString(36).substring(2, 15);
        }
        
        let hash = password + salt;
        for (let i = 0; i < 1000; i++) {
            hash = hash.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
        }
        
        return hash.toString();
    }

    // Выполнение синхронизации
    async performSync() {
        if (!this.username || this.syncInProgress) return;
        
        this.syncInProgress = true;
        this.updateSyncStatus('syncing');
        
        try {
            console.log('Starting sync for user:', this.username);
            
            // Получаем облачные данные
            const cloudData = this.getCloudData();
            const cloudTransactions = cloudData.transactions[this.username] || [];
            
            // Получаем локальные данные
            const localTransactions = this.getLocalTransactions();
            
            // Синхронизируем транзакции
            const syncedTransactions = await this.syncTransactions(localTransactions, cloudTransactions);
            
            // Обновляем локальные данные
            this.saveLocalTransactions(syncedTransactions);
            
            // Обновляем облачные данные если есть изменения
            if (this.hasLocalChanges(localTransactions, cloudTransactions)) {
                cloudData.transactions[this.username] = syncedTransactions;
                this.saveCloudData(cloudData);
            }
            
            this.lastSyncTimestamp = new Date();
            this.updateSyncStatus('synced');
            this.logSyncEvent('sync_completed', this.username);
            
            // Уведомляем приложение об изменениях
            this.notifyDataChanged();
            
        } catch (error) {
            console.error('Sync error:', error);
            this.updateSyncStatus('error');
            this.logSyncEvent('sync_error', this.username, error.message);
        } finally {
            this.syncInProgress = false;
        }
    }

    // Синхронизация транзакций
    async syncTransactions(localTransactions, cloudTransactions) {
        const merged = [];
        const seenIds = new Set();
        
        // Добавляем облачные транзакции
        cloudTransactions.forEach(transaction => {
            merged.push({
                ...transaction,
                syncStatus: 'synced',
                source: 'cloud'
            });
            seenIds.add(transaction.id);
        });
        
        // Добавляем локальные транзакции, которых нет в облаке
        localTransactions.forEach(transaction => {
            if (!seenIds.has(transaction.id)) {
                const cloudVersion = cloudTransactions.find(t => t.id === transaction.id);
                
                if (!cloudVersion) {
                    // Новой транзакции нет в облаке - добавляем
                    merged.push({
                        ...transaction,
                        syncStatus: 'pending',
                        source: 'local'
                    });
                } else {
                    // Есть конфликт - разрешаем
                    const resolved = this.conflictResolver.resolve(transaction, cloudVersion);
                    merged.push(resolved);
                }
            }
        });
        
        // Сортируем по дате
        merged.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return merged;
    }

    // Проверка локальных изменений
    hasLocalChanges(localTransactions, cloudTransactions) {
        if (localTransactions.length !== cloudTransactions.length) {
            return true;
        }
        
        // Ищем локальные транзакции со статусом pending
        return localTransactions.some(t => t.syncStatus === 'pending');
    }

    // Получение локальных транзакций
    getLocalTransactions() {
        try {
            const data = localStorage.getItem(`transactions_${this.username}`);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error reading local transactions:', error);
            return [];
        }
    }

    // Сохранение локальных транзакций
    saveLocalTransactions(transactions) {
        try {
            localStorage.setItem(`transactions_${this.username}`, JSON.stringify(transactions));
            return true;
        } catch (error) {
            console.error('Error saving local transactions:', error);
            return false;
        }
    }

    // Добавление транзакции
    async addTransaction(transactionData) {
        if (!this.username) throw new Error('Пользователь не аутентифицирован');
        
        const transaction = {
            id: this.generateTransactionId(),
            ...transactionData,
            createdAt: new Date().toISOString(),
            deviceId: this.deviceId,
            syncStatus: 'pending'
        };
        
        // Сохраняем локально
        const localTransactions = this.getLocalTransactions();
        localTransactions.push(transaction);
        this.saveLocalTransactions(localTransactions);
        
        // Синхронизируем
        await this.performSync();
        
        return transaction;
    }

    // Удаление транзакции
    async deleteTransaction(transactionId) {
        if (!this.username) throw new Error('Пользователь не аутентифицирован');
        
        // Получаем облачные данные
        const cloudData = this.getCloudData();
        
        // Удаляем из облака
        if (cloudData.transactions[this.username]) {
            cloudData.transactions[this.username] = cloudData.transactions[this.username].filter(
                t => t.id !== transactionId
            );
            this.saveCloudData(cloudData);
        }
        
        // Удаляем локально
        const localTransactions = this.getLocalTransactions();
        const filteredTransactions = localTransactions.filter(t => t.id !== transactionId);
        this.saveLocalTransactions(filteredTransactions);
        
        // Синхронизируем
        await this.performSync();
        
        return true;
    }

    // Генерация ID транзакции
    generateTransactionId() {
        return 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    }

    // Получение транзакций
    getTransactions() {
        if (!this.username) return [];
        return this.getLocalTransactions();
    }

    // Обновление статуса синхронизации
    updateSyncStatus(status) {
        const statusElement = document.getElementById('syncStatus');
        if (statusElement) {
            const statusConfig = {
                'syncing': { text: '🔄 Синхронизация...', class: 'syncing' },
                'synced': { text: `✅ Синхронизировано ${this.getTimeAgo()}`, class: 'synced' },
                'error': { text: '❌ Ошибка синхронизации', class: 'error' },
                'offline': { text: '🔴 Офлайн', class: 'offline' }
            };
            
            const config = statusConfig[status] || statusConfig['offline'];
            statusElement.textContent = config.text;
            statusElement.className = `sync-status ${config.class}`;
        }
    }

    // Получение времени последней синхронизации
    getTimeAgo() {
        if (!this.lastSyncTimestamp) return '';
        
        const seconds = Math.floor((new Date() - this.lastSyncTimestamp) / 1000);
        
        if (seconds < 60) return 'только что';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} мин. назад`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч. назад`;
        return `${Math.floor(seconds / 86400)} д. назад`;
    }

    // Логирование событий синхронизации
    logSyncEvent(event, username, details = null) {
        const cloudData = this.getCloudData();
        
        cloudData.syncLog.push({
            event,
            username,
            deviceId: this.deviceId,
            timestamp: new Date().toISOString(),
            details
        });
        
        // Ограничиваем размер лога
        if (cloudData.syncLog.length > 1000) {
            cloudData.syncLog = cloudData.syncLog.slice(-500);
        }
        
        this.saveCloudData(cloudData);
    }

    // Уведомление об изменении данных
    notifyDataChanged() {
        // Создаем кастомное событие
        const event = new CustomEvent('dataChanged', {
            detail: {
                username: this.username,
                timestamp: new Date().toISOString()
            }
        });
        
        window.dispatchEvent(event);
    }

    // Получение статистики синхронизации
    getSyncStats() {
        const cloudData = this.getCloudData();
        
        return {
            username: this.username,
            deviceId: this.deviceId,
            lastSync: this.lastSyncTimestamp,
            isOnline: navigator.onLine,
            syncInProgress: this.syncInProgress,
            devices: cloudData.devices[this.username] || [],
            recentLogs: cloudData.syncLog.filter(log => 
                log.username === this.username && 
                new Date(log.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
            )
        };
    }

    // Принудительная синхронизация
    async forceSync() {
        if (!this.username) {
            throw new Error('Пользователь не аутентифицирован');
        }
        
        console.log('Force sync initiated');
        await this.performSync();
        return this.getSyncStats();
    }

    // Очистка данных пользователя
    clearUserData() {
        if (!this.username) return;
        
        const cloudData = this.getCloudData();
        
        // Удаляем данные пользователя из облака
        delete cloudData.transactions[this.username];
        delete cloudData.devices[this.username];
        
        this.saveCloudData(cloudData);
        
        // Удаляем локальные данные
        localStorage.removeItem(`transactions_${this.username}`);
        
        this.logSyncEvent('user_data_cleared', this.username);
    }
}

// Класс для разрешения конфликтов
class ConflictResolver {
    resolve(localTransaction, cloudTransaction) {
        // Простая стратегия: используем последнюю версию по времени создания
        const localDate = new Date(localTransaction.createdAt);
        const cloudDate = new Date(cloudTransaction.createdAt);
        
        if (localDate > cloudDate) {
            return {
                ...localTransaction,
                syncStatus: 'conflict_resolved',
                conflictResolution: 'local_wins',
                originalCloudVersion: cloudTransaction
            };
        } else {
            return {
                ...cloudTransaction,
                syncStatus: 'synced',
                conflictResolution: 'cloud_wins',
                originalLocalVersion: localTransaction
            };
        }
    }
}

// Создаем глобальный экземпляр движка синхронизации
window.syncEngine = new SyncEngine();