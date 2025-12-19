// Финансовый трекер - Улучшенная система базы данных с облачной синхронизацией
class FinanceDatabase {
    constructor() {
        this.dbName = 'FinanceTrackerDB';
        this.cloudName = 'FinanceCloudStorage';
        this.version = '2.1.0';
        this.isConnected = false;
        this.lastBackup = null;
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        this.init();
    }

    // Инициализация базы данных
    init() {
        console.log('Initializing Enhanced Finance Database...');
        this.createDatabase();
        this.initializeCloudStorage();
        this.createTables();
        this.createIndexes();
        this.setupDataIntegrity();
        this.setupNetworkListeners();
        this.isConnected = true;
        console.log('Enhanced Database initialized successfully');
    }

    // Инициализация облачного хранилища (эмуляция сервера)
    initializeCloudStorage() {
        const cloudStructure = {
            metadata: {
                name: this.cloudName,
                version: this.version,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                totalUsers: 0,
                totalTransactions: 0
            },
            users: {},
            transactions: {},
            sessions: {},
            devices: {},
            categories: {},
            syncLog: [],
            conflicts: []
        };

        if (!localStorage.getItem(this.cloudName)) {
            localStorage.setItem(this.cloudName, JSON.stringify(cloudStructure));
            console.log('Cloud storage initialized');
        }

        // Создаем глобальный API для облачного хранилища
        window.FINANCE_CLOUD = {
            // Получение данных из облака
            getData: () => {
                try {
                    const data = JSON.parse(localStorage.getItem(this.cloudName) || '{}');
                    return data;
                } catch (e) {
                    console.error('Error reading cloud data:', e);
                    return { users: {}, transactions: {}, sessions: {}, devices: {}, categories: {} };
                }
            },
            
            // Сохранение данных в облако
            saveData: (data) => {
                try {
                    data.metadata.lastModified = new Date().toISOString();
                    localStorage.setItem(this.cloudName, JSON.stringify(data));
                    console.log('Cloud data updated');
                    return true;
                } catch (e) {
                    console.error('Error saving cloud data:', e);
                    return false;
                }
            },

            // Регистрация пользователя в облаке
            registerUser: (userData) => {
                const data = this.getData();
                data.users[userData.username] = userData;
                data.transactions[userData.username] = [];
                data.devices[userData.username] = [];
                data.categories[userData.username] = this.getDefaultCategories();
                return this.saveData(data);
            },

            // Аутентификация пользователя
            authenticateUser: (username, password) => {
                const data = this.getData();
                const user = data.users[username];
                
                if (!user) return null;
                
                // Проверяем пароль
                const hash = this.hashPassword(password, user.salt);
                if (hash !== user.password_hash) return null;
                
                // Обновляем время последнего входа
                user.last_login = new Date().toISOString();
                this.saveData(data);
                
                return user;
            },

            // Получение транзакций пользователя
            getUserTransactions: (username) => {
                const data = this.getData();
                return data.transactions[username] || [];
            },

            // Добавление транзакции
            addTransaction: (username, transaction) => {
                const data = this.getData();
                if (!data.transactions[username]) {
                    data.transactions[username] = [];
                }
                
                // Проверяем на дубликаты
                const exists = data.transactions[username].some(t => t.id === transaction.id);
                if (!exists) {
                    data.transactions[username].push(transaction);
                    this.saveData(data);
                    return true;
                }
                return false;
            },

            // Удаление транзакции
            removeTransaction: (username, transactionId) => {
                const data = this.getData();
                if (data.transactions[username]) {
                    data.transactions[username] = data.transactions[username].filter(t => t.id !== transactionId);
                    this.saveData(data);
                    return true;
                }
                return false;
            },

            // Регистрация устройства
            registerDevice: (username, deviceData) => {
                const data = this.getData();
                if (!data.devices[username]) {
                    data.devices[username] = [];
                }
                
                const existingDevice = data.devices[username].find(d => d.device_id === deviceData.device_id);
                if (existingDevice) {
                    existingDevice.last_sync = new Date().toISOString();
                    existingDevice.is_active = true;
                } else {
                    data.devices[username].push(deviceData);
                }
                
                return this.saveData(data);
            },

            // Получение устройств пользователя
            getUserDevices: (username) => {
                const data = this.getData();
                return data.devices[username] || [];
            },

            // Хеширование пароля
            hashPassword: (password, salt) => {
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
            },

            // Получение категорий по умолчанию
            getDefaultCategories: () => {
                return [
                    // Доходы
                    { name: 'Зарплата', type: 'income', color: '#10b981', icon: '💼', is_default: true },
                    { name: 'Подработка', type: 'income', color: '#3b82f6', icon: '💰', is_default: true },
                    { name: 'Инвестиции', type: 'income', color: '#8b5cf6', icon: '📈', is_default: true },
                    { name: 'Подарки', type: 'income', color: '#ec4899', icon: '🎁', is_default: true },
                    { name: 'Другое', type: 'income', color: '#6b7280', icon: '📌', is_default: true },
                    
                    // Расходы
                    { name: 'Продукты', type: 'expense', color: '#ef4444', icon: '🛒', is_default: true },
                    { name: 'Транспорт', type: 'expense', color: '#f59e0b', icon: '🚗', is_default: true },
                    { name: 'Жилье', type: 'expense', color: '#84cc16', icon: '🏠', is_default: true },
                    { name: 'Развлечения', type: 'expense', color: '#06b6d4', icon: '🎮', is_default: true },
                    { name: 'Здоровье', type: 'expense', color: '#f97316', icon: '🏥', is_default: true },
                    { name: 'Одежда', type: 'expense', color: '#a855f7', icon: '👕', is_default: true },
                    { name: 'Образование', type: 'expense', color: '#0ea5e9', icon: '📚', is_default: true },
                    { name: 'Другое', type: 'expense', color: '#6b7280', icon: '📌', is_default: true }
                ];
            }
        };
    }

    // Создание локальной базы данных
    createDatabase() {
        const dbStructure = {
            metadata: {
                name: this.dbName,
                version: this.version,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                lastSync: null,
                deviceId: this.generateDeviceId()
            },
            tables: {
                users: {
                    columns: {
                        id: 'PRIMARY_KEY',
                        username: 'VARCHAR(50) UNIQUE NOT NULL',
                        email: 'VARCHAR(100) UNIQUE NOT NULL',
                        password_hash: 'VARCHAR(255) NOT NULL',
                        salt: 'VARCHAR(32) NOT NULL',
                        created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                        updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                        last_login: 'TIMESTAMP',
                        last_sync: 'TIMESTAMP',
                        is_active: 'BOOLEAN DEFAULT TRUE',
                        preferences: 'JSON',
                        settings: 'JSON'
                    },
                    data: [],
                    indexes: ['username', 'email', 'created_at']
                },
                transactions: {
                    columns: {
                        id: 'PRIMARY_KEY',
                        user_id: 'INTEGER FOREIGN KEY REFERENCES users(id)',
                        type: 'ENUM("income", "expense") NOT NULL',
                        amount: 'DECIMAL(15,2) NOT NULL',
                        category: 'VARCHAR(50) NOT NULL',
                        description: 'TEXT',
                        date: 'TIMESTAMP NOT NULL',
                        created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                        updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                        device_id: 'VARCHAR(50)',
                        is_deleted: 'BOOLEAN DEFAULT FALSE',
                        sync_status: 'ENUM("synced", "pending", "conflict") DEFAULT "pending"',
                        cloud_id: 'VARCHAR(100)'
                    },
                    data: [],
                    indexes: ['user_id', 'type', 'category', 'date', 'sync_status']
                },
                sync_queue: {
                    columns: {
                        id: 'PRIMARY_KEY',
                        operation: 'ENUM("create", "update", "delete") NOT NULL',
                        table_name: 'VARCHAR(50) NOT NULL',
                        record_id: 'VARCHAR(100) NOT NULL',
                        data: 'JSON',
                        created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                        retry_count: 'INTEGER DEFAULT 0',
                        status: 'ENUM("pending", "completed", "failed") DEFAULT "pending"'
                    },
                    data: []
                }
            },
            sequences: {
                users: 1,
                transactions: 1,
                sync_queue: 1
            }
        };

        if (!localStorage.getItem(this.dbName)) {
            localStorage.setItem(this.dbName, JSON.stringify(dbStructure));
            console.log('Local database created');
        }
    }

    // Генерация ID устройства
    generateDeviceId() {
        let deviceId = localStorage.getItem('finance_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            localStorage.setItem('finance_device_id', deviceId);
        }
        return deviceId;
    }

    // Настройка слушателей сетевых событий
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Device is online');
            this.processSyncQueue();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Device is offline');
        });
    }

    // Создание таблиц
    createTables() {
        const db = this.getDatabase();
        // Дополнительная инициализация таблиц
        this.updateMetadata();
    }

    // Создание индексов
    createIndexes() {
        const db = this.getDatabase();
        
        db.indexes = {
            users_by_username: {},
            users_by_email: {},
            transactions_by_user: {},
            transactions_by_sync_status: {}
        };
        
        this.rebuildIndexes();
    }

    // Перестроение индексов
    rebuildIndexes() {
        const db = this.getDatabase();
        
        // Очищаем индексы
        Object.keys(db.indexes).forEach(key => {
            db.indexes[key] = {};
        });
        
        // Строим индекс пользователей
        db.tables.users.data.forEach(user => {
            db.indexes.users_by_username[user.username] = user;
            db.indexes.users_by_email[user.email] = user;
        });
        
        // Строим индекс транзакций
        db.tables.transactions.data.forEach(transaction => {
            if (!db.indexes.transactions_by_user[transaction.user_id]) {
                db.indexes.transactions_by_user[transaction.user_id] = [];
            }
            db.indexes.transactions_by_user[transaction.user_id].push(transaction);
            
            if (!db.indexes.transactions_by_sync_status[transaction.sync_status]) {
                db.indexes.transactions_by_sync_status[transaction.sync_status] = [];
            }
            db.indexes.transactions_by_sync_status[transaction.sync_status].push(transaction);
        });
        
        this.saveDatabase(db);
    }

    // Настройка целостности данных
    setupDataIntegrity() {
        this.verifyDataIntegrity();
        this.setupAutoBackup();
    }

    // Проверка целостности данных
    verifyDataIntegrity() {
        const db = this.getDatabase();
        const errors = [];
        
        // Проверка целостности локальных данных
        db.tables.transactions.data.forEach(transaction => {
            const userExists = db.tables.users.data.some(user => user.id === transaction.user_id);
            if (!userExists) {
                errors.push(`Транзакция ${transaction.id} ссылается на несуществующего пользователя ${transaction.user_id}`);
            }
        });
        
        if (errors.length > 0) {
            console.warn('Data integrity issues found:', errors);
            this.repairDataIntegrity(errors);
        }
    }

    // Восстановление целостности данных
    repairDataIntegrity(errors) {
        const db = this.getDatabase();
        
        // Удаляем осиротевшие записи
        db.tables.transactions.data = db.tables.transactions.data.filter(transaction => {
            return db.tables.users.data.some(user => user.id === transaction.user_id);
        });
        
        this.saveDatabase(db);
        console.log('Data integrity repaired');
    }

    // Автоматическое резервное копирование
    setupAutoBackup() {
        setInterval(() => {
            this.createAutoBackup();
        }, 24 * 60 * 60 * 1000);
    }

    // Получение локальной базы данных
    getDatabase() {
        try {
            return JSON.parse(localStorage.getItem(this.dbName) || '{}');
        } catch (e) {
            console.error('Error reading database:', e);
            return this.createDatabase();
        }
    }

    // Сохранение локальной базы данных
    saveDatabase(db) {
        try {
            db.metadata.lastModified = new Date().toISOString();
            localStorage.setItem(this.dbName, JSON.stringify(db));
            return true;
        } catch (e) {
            console.error('Error saving database:', e);
            return false;
        }
    }

    // Обновление метаданных
    updateMetadata() {
        const db = this.getDatabase();
        db.metadata.lastModified = new Date().toISOString();
        this.saveDatabase(db);
    }

    // Получение следующего ID
    getNextId(table) {
        const db = this.getDatabase();
        const id = db.sequences[table]++;
        this.saveDatabase(db);
        return id;
    }

    // Регистрация пользователя (с синхронизацией с облаком)
    async registerUser(username, email, password, preferences = {}) {
        const db = this.getDatabase();
        
        // Проверяем локально
        if (db.indexes.users_by_username[username]) {
            throw new Error('Пользователь с таким именем уже существует');
        }
        
        if (db.indexes.users_by_email[email]) {
            throw new Error('Пользователь с таким email уже существует');
        }
        
        // Проверяем в облаке
        const cloudData = window.FINANCE_CLOUD.getData();
        if (cloudData.users[username]) {
            throw new Error('Пользователь с таким именем уже существует в системе');
        }
        
        // Создаем хеш пароля
        const salt = Math.random().toString(36).substring(2, 15);
        const password_hash = window.FINANCE_CLOUD.hashPassword(password, salt);
        
        const userId = this.getNextId('users');
        
        const userData = {
            id: userId,
            username,
            email,
            password_hash,
            salt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_login: null,
            last_sync: null,
            is_active: true,
            preferences: {
                theme: 'light',
                currency: 'RUB',
                language: 'ru',
                notifications: true,
                ...preferences
            },
            settings: {
                auto_sync: true,
                backup_frequency: 'daily',
                categories_custom: []
            }
        };
        
        // Сохраняем локально
        db.tables.users.data.push(userData);
        db.indexes.users_by_username[username] = userData;
        db.indexes.users_by_email[email] = userData;
        
        // Регистрируем в облаке
        const cloudSuccess = window.FINANCE_CLOUD.registerUser(userData);
        
        if (!cloudSuccess) {
            throw new Error('Ошибка регистрации в облачном хранилище');
        }
        
        this.saveDatabase(db);
        console.log(`User registered: ${username} (ID: ${userId})`);
        
        return userData;
    }

    // Аутентификация пользователя (с проверкой в облаке)
    async authenticateUser(username, password) {
        // Сначала пробуем аутентифицировать в облаке
        const cloudUser = window.FINANCE_CLOUD.authenticateUser(username, password);
        
        if (!cloudUser) {
            throw new Error('Неверный логин или пароль');
        }
        
        // Проверяем локально
        const db = this.getDatabase();
        let localUser = db.indexes.users_by_username[username];
        
        if (!localUser) {
            // Если пользователя нет локально, создаем его
            const userId = this.getNextId('users');
            localUser = {
                ...cloudUser,
                id: userId,
                last_sync: new Date().toISOString()
            };
            
            db.tables.users.data.push(localUser);
            db.indexes.users_by_username[username] = localUser;
            db.indexes.users_by_email[cloudUser.email] = localUser;
        } else {
            // Обновляем локальные данные
            localUser.last_login = cloudUser.last_login;
            localUser.last_sync = new Date().toISOString();
        }
        
        this.saveDatabase(db);
        
        // Синхронизируем данные пользователя
        await this.syncUserData(username);
        
        // Создаем сессию
        const sessionToken = this.createSession(localUser.id);
        
        return {
            user: {
                id: localUser.id,
                username: localUser.username,
                email: localUser.email,
                preferences: localUser.preferences,
                created_at: localUser.created_at
            },
            sessionToken
        };
    }

    // Синхронизация данных пользователя
    async syncUserData(username) {
        if (!this.isOnline) {
            console.log('Offline - skipping sync');
            return;
        }
        
        try {
            const db = this.getDatabase();
            const localUser = db.indexes.users_by_username[username];
            
            if (!localUser) return;
            
            // Получаем данные из облака
            const cloudTransactions = window.FINANCE_CLOUD.getUserTransactions(username);
            const localTransactions = db.indexes.transactions_by_user[localUser.id] || [];
            
            // Синхронизируем транзакции
            const syncedTransactions = await this.mergeTransactions(localTransactions, cloudTransactions);
            
            // Обновляем локальные данные
            db.tables.transactions.data = db.tables.transactions.data.filter(t => t.user_id !== localUser.id);
            syncedTransactions.forEach(transaction => {
                db.tables.transactions.data.push(transaction);
            });
            
            // Обновляем время синхронизации
            localUser.last_sync = new Date().toISOString();
            
            this.saveDatabase(db);
            this.rebuildIndexes();
            
            console.log(`User data synced: ${username}`);
        } catch (error) {
            console.error('Error syncing user data:', error);
        }
    }

    // Слияние транзакций (разрешение конфликтов)
    async mergeTransactions(localTransactions, cloudTransactions) {
        const merged = [];
        const seenIds = new Set();
        
        // Добавляем облачные транзакции
        cloudTransactions.forEach(transaction => {
            merged.push({
                ...transaction,
                sync_status: 'synced',
                cloud_id: transaction.id
            });
            seenIds.add(transaction.id);
        });
        
        // Добавляем локальные транзакции, которых нет в облаке
        localTransactions.forEach(transaction => {
            if (!seenIds.has(transaction.cloud_id) && transaction.sync_status !== 'synced') {
                merged.push(transaction);
                
                // Добавляем в очередь синхронизации
                if (transaction.sync_status === 'pending') {
                    this.addToSyncQueue('create', 'transactions', transaction.id, transaction);
                }
            }
        });
        
        // Сортируем по дате
        merged.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return merged;
    }

    // Добавление операции в очередь синхронизации
    addToSyncQueue(operation, tableName, recordId, data) {
        const db = this.getDatabase();
        const queueId = this.getNextId('sync_queue');
        
        const queueItem = {
            id: queueId,
            operation,
            table_name: tableName,
            record_id: recordId,
            data,
            created_at: new Date().toISOString(),
            retry_count: 0,
            status: 'pending'
        };
        
        db.tables.sync_queue.data.push(queueItem);
        this.saveDatabase(db);
        
        // Пробуем синхронизировать сразу
        if (this.isOnline) {
            this.processSyncQueue();
        }
    }

    // Обработка очереди синхронизации
    async processSyncQueue() {
        if (!this.isOnline) return;
        
        const db = this.getDatabase();
        const pendingItems = db.tables.sync_queue.data.filter(item => item.status === 'pending');
        
        for (const item of pendingItems) {
            try {
                let success = false;
                
                if (item.table_name === 'transactions' && item.operation === 'create') {
                    const transaction = item.data;
                    
                    // Получаем username по user_id
                    const user = db.tables.users.data.find(u => u.id === transaction.user_id);
                    if (user) {
                        success = window.FINANCE_CLOUD.addTransaction(user.username, {
                            id: transaction.id,
                            type: transaction.type,
                            amount: transaction.amount,
                            category: transaction.category,
                            description: transaction.description,
                            date: transaction.date,
                            device_id: transaction.device_id
                        });
                    }
                }
                
                if (success) {
                    // Обновляем статус транзакции
                    const transaction = db.tables.transactions.data.find(t => t.id === item.record_id);
                    if (transaction) {
                        transaction.sync_status = 'synced';
                    }
                    
                    // Удаляем из очереди
                    item.status = 'completed';
                } else {
                    item.retry_count++;
                    if (item.retry_count > 3) {
                        item.status = 'failed';
                    }
                }
            } catch (error) {
                console.error('Error processing sync queue item:', error);
                item.retry_count++;
                if (item.retry_count > 3) {
                    item.status = 'failed';
                }
            }
        }
        
        this.saveDatabase(db);
    }

    // Создание сессии
    createSession(userId) {
        const db = this.getDatabase();
        const sessionToken = this.generateSessionToken();
        
        const session = {
            id: this.getNextId('sessions'),
            user_id: userId,
            session_token: sessionToken,
            device_id: this.generateDeviceId(),
            ip_address: '127.0.0.1',
            user_agent: navigator.userAgent,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            is_active: true
        };
        
        // Сохраняем сессию в облаке
        const cloudData = window.FINANCE_CLOUD.getData();
        cloudData.sessions[sessionToken] = session;
        window.FINANCE_CLOUD.saveData(cloudData);
        
        return sessionToken;
    }

    // Генерация токена сессии
    generateSessionToken() {
        return 'sess_' + Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    }

    // Проверка сессии
    validateSession(sessionToken) {
        // Проверяем в облаке
        const cloudData = window.FINANCE_CLOUD.getData();
        const session = cloudData.sessions[sessionToken];
        
        if (!session || !session.is_active) {
            return null;
        }
        
        if (new Date(session.expires_at) < new Date()) {
            session.is_active = false;
            window.FINANCE_CLOUD.saveData(cloudData);
            return null;
        }
        
        // Получаем данные пользователя
        const db = this.getDatabase();
        const user = db.tables.users.data.find(u => u.id === session.user_id);
        
        if (!user || !user.is_active) {
            return null;
        }
        
        return {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                preferences: user.preferences
            },
            session
        };
    }

    // Создание транзакции (с синхронизацией)
    async createTransaction(userId, type, amount, category, description, date = null) {
        const db = this.getDatabase();
        
        // Проверяем существование пользователя
        const user = db.tables.users.data.find(u => u.id === userId);
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        
        const transactionId = this.getNextId('transactions');
        const cloudId = 'cloud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        
        const transaction = {
            id: transactionId,
            cloud_id: cloudId,
            user_id: userId,
            type,
            amount: parseFloat(amount),
            category,
            description,
            date: date || new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            device_id: this.generateDeviceId(),
            is_deleted: false,
            sync_status: this.isOnline ? 'synced' : 'pending'
        };
        
        // Сохраняем локально
        db.tables.transactions.data.push(transaction);
        
        // Обновляем индексы
        if (!db.indexes.transactions_by_user[userId]) {
            db.indexes.transactions_by_user[userId] = [];
        }
        db.indexes.transactions_by_user[userId].push(transaction);
        
        if (!db.indexes.transactions_by_sync_status[transaction.sync_status]) {
            db.indexes.transactions_by_sync_status[transaction.sync_status] = [];
        }
        db.indexes.transactions_by_sync_status[transaction.sync_status].push(transaction);
        
        this.saveDatabase(db);
        
        // Если онлайн, синхронизируем сразу
        if (this.isOnline) {
            try {
                const success = window.FINANCE_CLOUD.addTransaction(user.username, {
                    id: cloudId,
                    type,
                    amount,
                    category,
                    description,
                    date: transaction.date,
                    device_id: transaction.device_id
                });
                
                if (success) {
                    transaction.sync_status = 'synced';
                    this.saveDatabase(db);
                }
            } catch (error) {
                console.error('Error syncing transaction:', error);
                this.addToSyncQueue('create', 'transactions', transactionId, transaction);
            }
        } else {
            // Добавляем в очередь синхронизации
            this.addToSyncQueue('create', 'transactions', transactionId, transaction);
        }
        
        console.log(`Transaction created: ${type} ${amount} for user ${userId}`);
        return transaction;
    }

    // Получение транзакций пользователя
    getUserTransactions(userId, filters = {}) {
        const db = this.getDatabase();
        let transactions = db.indexes.transactions_by_user[userId] || [];
        
        // Фильтрация
        if (filters.type) {
            transactions = transactions.filter(t => t.type === filters.type);
        }
        
        if (filters.category) {
            transactions = transactions.filter(t => t.category === filters.category);
        }
        
        if (filters.startDate) {
            transactions = transactions.filter(t => new Date(t.date) >= new Date(filters.startDate));
        }
        
        if (filters.endDate) {
            transactions = transactions.filter(t => new Date(t.date) <= new Date(filters.endDate));
        }
        
        if (filters.limit) {
            transactions = transactions.slice(0, filters.limit);
        }
        
        // Сортировка
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return transactions;
    }

    // Удаление транзакции (с синхронизацией)
    async deleteTransaction(transactionId, userId) {
        const db = this.getDatabase();
        const transaction = db.tables.transactions.data.find(t => t.id === transactionId && t.user_id === userId);
        
        if (!transaction) {
            throw new Error('Транзакция не найдена');
        }
        
        const user = db.tables.users.data.find(u => u.id === userId);
        
        // Помечаем как удаленную локально
        transaction.is_deleted = true;
        transaction.updated_at = new Date().toISOString();
        
        this.saveDatabase(db);
        
        // Если онлайн, удаляем из облака
        if (this.isOnline && user) {
            try {
                window.FINANCE_CLOUD.removeTransaction(user.username, transaction.cloud_id);
                transaction.sync_status = 'synced';
            } catch (error) {
                console.error('Error deleting transaction from cloud:', error);
                this.addToSyncQueue('delete', 'transactions', transactionId, { cloud_id: transaction.cloud_id });
            }
        } else {
            this.addToSyncQueue('delete', 'transactions', transactionId, { cloud_id: transaction.cloud_id });
        }
        
        console.log(`Transaction deleted: ${transactionId}`);
        return true;
    }

    // Регистрация устройства
    async registerDevice(userId, deviceId, deviceName = 'Unknown Device') {
        const db = this.getDatabase();
        const user = db.tables.users.data.find(u => u.id === userId);
        
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        
        const deviceData = {
            device_id: deviceId,
            device_name: deviceName,
            device_type: this.getDeviceType(),
            last_sync: new Date().toISOString(),
            is_active: true,
            created_at: new Date().toISOString()
        };
        
        // Регистрируем в облаке
        if (user.username) {
            window.FINANCE_CLOUD.registerDevice(user.username, deviceData);
        }
        
        return deviceData;
    }

    // Получение типа устройства
    getDeviceType() {
        const ua = navigator.userAgent;
        if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
        if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) return 'mobile';
        return 'desktop';
    }

    // Получение ID текущего устройства
    getCurrentDeviceId() {
        return this.generateDeviceId();
    }

    // Создание резервной копии
    createBackup(userId, description = 'Manual backup') {
        const db = this.getDatabase();
        
        const user = db.tables.users.data.find(u => u.id === userId);
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        
        const userData = {
            user: user,
            transactions: this.getUserTransactions(userId),
            backup_metadata: {
                created_at: new Date().toISOString(),
                version: this.version,
                description,
                device_id: this.getCurrentDeviceId()
            }
        };
        
        // Сохраняем в облаке
        const cloudData = window.FINANCE_CLOUD.getData();
        const backupId = 'backup_' + Date.now();
        
        if (!cloudData.backups) {
            cloudData.backups = {};
        }
        
        cloudData.backups[backupId] = userData;
        window.FINANCE_CLOUD.saveData(cloudData);
        
        return { id: backupId, ...userData };
    }

    // Автоматическое резервное копирование
    createAutoBackup() {
        const db = this.getDatabase();
        
        db.tables.users.data.forEach(user => {
            if (user.is_active && user.settings.backup_frequency === 'daily') {
                this.createBackup(user.id, 'Auto backup');
            }
        });
        
        this.lastBackup = new Date();
        console.log('Auto backup created');
    }

    // Получение статистики базы данных
    getDatabaseStats() {
        const db = this.getDatabase();
        const cloudData = window.FINANCE_CLOUD.getData();
        
        return {
            local: {
                metadata: db.metadata,
                tables: {
                    users: db.tables.users.data.length,
                    transactions: db.tables.transactions.data.length,
                    sync_queue: db.tables.sync_queue.data.filter(item => item.status === 'pending').length
                },
                size: JSON.stringify(db).length
            },
            cloud: {
                metadata: cloudData.metadata,
                users: Object.keys(cloudData.users).length,
                transactions: Object.values(cloudData.transactions).reduce((sum, transactions) => sum + transactions.length, 0),
                devices: Object.values(cloudData.devices).reduce((sum, devices) => sum + devices.length, 0)
            },
            lastBackup: this.lastBackup,
            isOnline: this.isOnline
        };
    }

    // Очистка базы данных
    clearDatabase() {
        if (confirm('Вы уверены, что хотите удалить все данные? Это действие необратимо!')) {
            localStorage.removeItem(this.dbName);
            localStorage.removeItem(this.cloudName);
            this.init();
            return true;
        }
        return false;
    }

    // Экспорт базы данных
    exportDatabase() {
        const stats = this.getDatabaseStats();
        const exportData = {
            local: this.getDatabase(),
            cloud: window.FINANCE_CLOUD.getData(),
            stats,
            exported_at: new Date().toISOString(),
            export_version: this.version
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `finance_database_export_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        return exportData;
    }
}

// Создаем глобальный экземпляр базы данных
window.financeDB = new FinanceDatabase();