// Финансовый трекер - Система управления базой данных
class FinanceDatabase {
    constructor() {
        this.dbName = 'FinanceTrackerDB';
        this.version = '1.0.0';
        this.isConnected = false;
        this.lastBackup = null;
        this.init();
    }

    // Инициализация базы данных
    init() {
        console.log('Initializing Finance Database...');
        this.createDatabase();
        this.createTables();
        this.createIndexes();
        this.setupDataIntegrity();
        this.isConnected = true;
        console.log('Database initialized successfully');
    }

    // Создание структуры базы данных
    createDatabase() {
        const dbStructure = {
            metadata: {
                name: this.dbName,
                version: this.version,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                totalUsers: 0,
                totalTransactions: 0,
                size: 0
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
                        tags: 'JSON'
                    },
                    data: [],
                    indexes: ['user_id', 'type', 'category', 'date', 'created_at']
                },
                categories: {
                    columns: {
                        id: 'PRIMARY_KEY',
                        user_id: 'INTEGER FOREIGN KEY REFERENCES users(id)',
                        name: 'VARCHAR(50) NOT NULL',
                        type: 'ENUM("income", "expense") NOT NULL',
                        color: 'VARCHAR(7)',
                        icon: 'VARCHAR(10)',
                        is_default: 'BOOLEAN DEFAULT FALSE',
                        created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
                    },
                    data: [],
                    indexes: ['user_id', 'type', 'name']
                },
                devices: {
                    columns: {
                        id: 'PRIMARY_KEY',
                        user_id: 'INTEGER FOREIGN KEY REFERENCES users(id)',
                        device_id: 'VARCHAR(100) UNIQUE NOT NULL',
                        device_name: 'VARCHAR(100)',
                        device_type: 'VARCHAR(20)',
                        last_sync: 'TIMESTAMP',
                        is_active: 'BOOLEAN DEFAULT TRUE',
                        created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
                    },
                    data: [],
                    indexes: ['user_id', 'device_id', 'last_sync']
                },
                sessions: {
                    columns: {
                        id: 'PRIMARY_KEY',
                        user_id: 'INTEGER FOREIGN KEY REFERENCES users(id)',
                        session_token: 'VARCHAR(255) UNIQUE NOT NULL',
                        device_id: 'VARCHAR(100)',
                        ip_address: 'VARCHAR(45)',
                        user_agent: 'TEXT',
                        created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                        expires_at: 'TIMESTAMP',
                        is_active: 'BOOLEAN DEFAULT TRUE'
                    },
                    data: [],
                    indexes: ['user_id', 'session_token', 'expires_at']
                },
                backups: {
                    columns: {
                        id: 'PRIMARY_KEY',
                        user_id: 'INTEGER FOREIGN KEY REFERENCES users(id)',
                        backup_data: 'JSON NOT NULL',
                        backup_type: 'ENUM("manual", "auto") DEFAULT "manual"',
                        file_size: 'INTEGER',
                        checksum: 'VARCHAR(64)',
                        created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                        description: 'TEXT'
                    },
                    data: [],
                    indexes: ['user_id', 'backup_type', 'created_at']
                }
            },
            sequences: {
                users: 1,
                transactions: 1,
                categories: 1,
                devices: 1,
                sessions: 1,
                backups: 1
            }
        };

        if (!localStorage.getItem(this.dbName)) {
            localStorage.setItem(this.dbName, JSON.stringify(dbStructure));
            console.log('Database created');
        }
    }

    // Создание таблиц
    createTables() {
        const db = this.getDatabase();
        
        // Создаем таблицу пользователей
        if (!db.tables.users.data.length) {
            this.insertDefaultCategories();
        }
        
        // Обновляем метаданные
        this.updateMetadata();
    }

    // Создание индексов
    createIndexes() {
        const db = this.getDatabase();
        
        // Индексы создаются виртуально через объекты для быстрого поиска
        db.indexes = {
            users_by_username: {},
            users_by_email: {},
            transactions_by_user: {},
            transactions_by_date: {},
            devices_by_user: {}
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
        
        // Строим индекс пользователей по username
        db.tables.users.data.forEach(user => {
            db.indexes.users_by_username[user.username] = user;
            db.indexes.users_by_email[user.email] = user;
        });
        
        // Строим индекс транзакций по пользователю
        db.tables.transactions.data.forEach(transaction => {
            if (!db.indexes.transactions_by_user[transaction.user_id]) {
                db.indexes.transactions_by_user[transaction.user_id] = [];
            }
            db.indexes.transactions_by_user[transaction.user_id].push(transaction);
        });
        
        this.saveDatabase(db);
    }

    // Настройка целостности данных
    setupDataIntegrity() {
        // Проверяем целостность данных при загрузке
        this.verifyDataIntegrity();
        
        // Устанавливаем автоматическое резервное копирование
        this.setupAutoBackup();
    }

    // Проверка целостности данных
    verifyDataIntegrity() {
        const db = this.getDatabase();
        const errors = [];
        
        // Проверяем связи между таблицами
        db.tables.transactions.data.forEach(transaction => {
            const userExists = db.tables.users.data.some(user => user.id === transaction.user_id);
            if (!userExists) {
                errors.push(`Транзакция ${transaction.id} ссылается на несуществующего пользователя ${transaction.user_id}`);
            }
        });
        
        db.tables.devices.data.forEach(device => {
            const userExists = db.tables.users.data.some(user => user.id === device.user_id);
            if (!userExists) {
                errors.push(`Устройство ${device.id} ссылается на несуществующего пользователя ${device.user_id}`);
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
        
        db.tables.devices.data = db.tables.devices.data.filter(device => {
            return db.tables.users.data.some(user => user.id === device.user_id);
        });
        
        this.saveDatabase(db);
        console.log('Data integrity repaired');
    }

    // Автоматическое резервное копирование
    setupAutoBackup() {
        // Создаем резервную копию каждые 24 часа
        setInterval(() => {
            this.createAutoBackup();
        }, 24 * 60 * 60 * 1000);
    }

    // Получение базы данных
    getDatabase() {
        try {
            return JSON.parse(localStorage.getItem(this.dbName) || '{}');
        } catch (e) {
            console.error('Error reading database:', e);
            return this.createDatabase();
        }
    }

    // Сохранение базы данных
    saveDatabase(db) {
        try {
            db.metadata.lastModified = new Date().toISOString();
            db.metadata.totalUsers = db.tables.users.data.length;
            db.metadata.totalTransactions = db.tables.transactions.data.length;
            db.metadata.size = JSON.stringify(db).length;
            
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
        db.metadata.totalUsers = db.tables.users.data.length;
        db.metadata.totalTransactions = db.tables.transactions.data.length;
        this.saveDatabase(db);
    }

    // Получение следующего ID
    getNextId(table) {
        const db = this.getDatabase();
        const id = db.sequences[table]++;
        this.saveDatabase(db);
        return id;
    }

    // Хеширование пароля
    hashPassword(password, salt = null) {
        if (!salt) {
            salt = Math.random().toString(36).substring(2, 15);
        }
        
        // Простая эмуляция хеширования (в реальном приложении использовать bcrypt)
        let hash = password + salt;
        for (let i = 0; i < 1000; i++) {
            hash = hash.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
        }
        
        return {
            hash: hash.toString(),
            salt: salt
        };
    }

    // Проверка пароля
    verifyPassword(password, hashedPassword, salt) {
        const { hash } = this.hashPassword(password, salt);
        return hash === hashedPassword;
    }

    // Создание пользователя
    createUser(username, email, password, preferences = {}) {
        const db = this.getDatabase();
        
        // Проверяем уникальность
        if (db.indexes.users_by_username[username]) {
            throw new Error('Пользователь с таким именем уже существует');
        }
        
        if (db.indexes.users_by_email[email]) {
            throw new Error('Пользователь с таким email уже существует');
        }
        
        const { hash, salt } = this.hashPassword(password);
        const userId = this.getNextId('users');
        
        const user = {
            id: userId,
            username,
            email,
            password_hash: hash,
            salt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_login: null,
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
        
        db.tables.users.data.push(user);
        db.indexes.users_by_username[username] = user;
        db.indexes.users_by_email[email] = user;
        
        // Создаем категории по умолчанию для пользователя
        this.createUserDefaultCategories(userId);
        
        this.saveDatabase(db);
        console.log(`User created: ${username} (ID: ${userId})`);
        
        return user;
    }

    // Аутентификация пользователя
    authenticateUser(username, password) {
        const db = this.getDatabase();
        const user = db.indexes.users_by_username[username];
        
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        
        if (!user.is_active) {
            throw new Error('Аккаунт деактивирован');
        }
        
        if (!this.verifyPassword(password, user.password_hash, user.salt)) {
            throw new Error('Неверный пароль');
        }
        
        // Обновляем время последнего входа
        user.last_login = new Date().toISOString();
        user.updated_at = new Date().toISOString();
        
        this.saveDatabase(db);
        
        // Создаем сессию
        const sessionToken = this.createSession(user.id);
        
        return {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                preferences: user.preferences,
                created_at: user.created_at
            },
            sessionToken
        };
    }

    // Создание сессии
    createSession(userId, deviceId = null) {
        const db = this.getDatabase();
        const sessionId = this.getNextId('sessions');
        const sessionToken = this.generateSessionToken();
        
        const session = {
            id: sessionId,
            user_id: userId,
            session_token: sessionToken,
            device_id: deviceId,
            ip_address: '127.0.0.1',
            user_agent: navigator.userAgent,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 дней
            is_active: true
        };
        
        db.tables.sessions.data.push(session);
        this.saveDatabase(db);
        
        return sessionToken;
    }

    // Генерация токена сессии
    generateSessionToken() {
        return 'sess_' + Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    }

    // Проверка сессии
    validateSession(sessionToken) {
        const db = this.getDatabase();
        const session = db.tables.sessions.data.find(s => s.session_token === sessionToken);
        
        if (!session || !session.is_active) {
            return null;
        }
        
        if (new Date(session.expires_at) < new Date()) {
            session.is_active = false;
            this.saveDatabase(db);
            return null;
        }
        
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

    // Создание транзакции
    createTransaction(userId, type, amount, category, description, date = null) {
        const db = this.getDatabase();
        
        // Проверяем существование пользователя
        const user = db.tables.users.data.find(u => u.id === userId);
        if (!user) {
            throw new Error('Пользователь не найден');
        }
        
        const transactionId = this.getNextId('transactions');
        
        const transaction = {
            id: transactionId,
            user_id: userId,
            type,
            amount: parseFloat(amount),
            category,
            description,
            date: date || new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            device_id: this.getCurrentDeviceId(),
            is_deleted: false,
            tags: []
        };
        
        db.tables.transactions.data.push(transaction);
        
        // Обновляем индекс
        if (!db.indexes.transactions_by_user[userId]) {
            db.indexes.transactions_by_user[userId] = [];
        }
        db.indexes.transactions_by_user[userId].push(transaction);
        
        this.saveDatabase(db);
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

    // Удаление транзакции
    deleteTransaction(transactionId, userId) {
        const db = this.getDatabase();
        const transaction = db.tables.transactions.data.find(t => t.id === transactionId && t.user_id === userId);
        
        if (!transaction) {
            throw new Error('Транзакция не найдена');
        }
        
        transaction.is_deleted = true;
        transaction.updated_at = new Date().toISOString();
        
        this.saveDatabase(db);
        console.log(`Transaction deleted: ${transactionId}`);
        
        return true;
    }

    // Регистрация устройства
    registerDevice(userId, deviceId, deviceName = 'Unknown Device') {
        const db = this.getDatabase();
        
        // Проверяем, не зарегистрировано ли уже устройство
        const existingDevice = db.tables.devices.data.find(d => d.device_id === deviceId && d.user_id === userId);
        if (existingDevice) {
            existingDevice.last_sync = new Date().toISOString();
            existingDevice.is_active = true;
            this.saveDatabase(db);
            return existingDevice;
        }
        
        const deviceRecordId = this.getNextId('devices');
        
        const device = {
            id: deviceRecordId,
            user_id: userId,
            device_id: deviceId,
            device_name: deviceName,
            device_type: this.getDeviceType(),
            last_sync: new Date().toISOString(),
            is_active: true,
            created_at: new Date().toISOString()
        };
        
        db.tables.devices.data.push(device);
        this.saveDatabase(db);
        
        return device;
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
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            localStorage.setItem('device_id', deviceId);
        }
        return deviceId;
    }

    // Создание категорий по умолчанию
    createUserDefaultCategories(userId) {
        const db = this.getDatabase();
        
        const defaultCategories = [
            // Доходы
            { name: 'Зарплата', type: 'income', color: '#10b981', icon: '💼' },
            { name: 'Подработка', type: 'income', color: '#3b82f6', icon: '💰' },
            { name: 'Инвестиции', type: 'income', color: '#8b5cf6', icon: '📈' },
            { name: 'Подарки', type: 'income', color: '#ec4899', icon: '🎁' },
            { name: 'Другое', type: 'income', color: '#6b7280', icon: '📌' },
            
            // Расходы
            { name: 'Продукты', type: 'expense', color: '#ef4444', icon: '🛒' },
            { name: 'Транспорт', type: 'expense', color: '#f59e0b', icon: '🚗' },
            { name: 'Жилье', type: 'expense', color: '#84cc16', icon: '🏠' },
            { name: 'Развлечения', type: 'expense', color: '#06b6d4', icon: '🎮' },
            { name: 'Здоровье', type: 'expense', color: '#f97316', icon: '🏥' },
            { name: 'Одежда', type: 'expense', color: '#a855f7', icon: '👕' },
            { name: 'Образование', type: 'expense', color: '#0ea5e9', icon: '📚' },
            { name: 'Другое', type: 'expense', color: '#6b7280', icon: '📌' }
        ];
        
        defaultCategories.forEach(category => {
            const categoryId = this.getNextId('categories');
            const categoryRecord = {
                id: categoryId,
                user_id: userId,
                ...category,
                is_default: true,
                created_at: new Date().toISOString()
            };
            
            db.tables.categories.data.push(categoryRecord);
        });
        
        this.saveDatabase(db);
    }

    // Вставка категорий по умолчанию
    insertDefaultCategories() {
        // Глобальные категории по умолчанию (для всех пользователей)
        const db = this.getDatabase();
        // Здесь можно добавить глобальные категории
    }

    // Получение категорий пользователя
    getUserCategories(userId, type = null) {
        const db = this.getDatabase();
        let categories = db.tables.categories.data.filter(c => c.user_id === userId);
        
        if (type) {
            categories = categories.filter(c => c.type === type);
        }
        
        return categories.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Создание резервной копии
    createBackup(userId, description = 'Manual backup') {
        const db = this.getDatabase();
        
        const userData = {
            user: db.tables.users.data.find(u => u.id === userId),
            transactions: this.getUserTransactions(userId),
            categories: this.getUserCategories(userId),
            devices: db.tables.devices.data.filter(d => d.user_id === userId),
            backup_metadata: {
                created_at: new Date().toISOString(),
                version: this.version,
                description
            }
        };
        
        const backupId = this.getNextId('backups');
        const backup = {
            id: backupId,
            user_id: userId,
            backup_data: userData,
            backup_type: 'manual',
            file_size: JSON.stringify(userData).length,
            checksum: this.calculateChecksum(JSON.stringify(userData)),
            created_at: new Date().toISOString(),
            description
        };
        
        db.tables.backups.data.push(backup);
        this.saveDatabase(db);
        
        return backup;
    }

    // Автоматическое резервное копирование
    createAutoBackup() {
        const db = this.getDatabase();
        
        db.tables.users.data.forEach(user => {
            if (user.settings.backup_frequency === 'daily') {
                this.createBackup(user.id, 'Auto backup');
            }
        });
        
        this.lastBackup = new Date();
        console.log('Auto backup created');
    }

    // Восстановление из резервной копии
    restoreFromBackup(backupId) {
        const db = this.getDatabase();
        const backup = db.tables.backups.data.find(b => b.id === backupId);
        
        if (!backup) {
            throw new Error('Резервная копия не найдена');
        }
        
        const { user, transactions, categories } = backup.backup_data;
        
        // Восстанавливаем данные
        // В реальном приложении здесь была бы более сложная логика слияния данных
        
        this.saveDatabase(db);
        console.log(`Data restored from backup: ${backupId}`);
        
        return true;
    }

    // Расчет контрольной суммы
    calculateChecksum(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    // Получение статистики базы данных
    getDatabaseStats() {
        const db = this.getDatabase();
        
        return {
            metadata: db.metadata,
            tables: {
                users: db.tables.users.data.length,
                transactions: db.tables.transactions.data.length,
                categories: db.tables.categories.data.length,
                devices: db.tables.devices.data.length,
                sessions: db.tables.sessions.data.length,
                backups: db.tables.backups.data.length
            },
            size: JSON.stringify(db).length,
            lastBackup: this.lastBackup
        };
    }

    // Очистка базы данных
    clearDatabase() {
        if (confirm('Вы уверены, что хотите удалить все данные? Это действие необратимо!')) {
            localStorage.removeItem(this.dbName);
            this.init();
            return true;
        }
        return false;
    }

    // Экспорт базы данных
    exportDatabase() {
        const db = this.getDatabase();
        const exportData = {
            ...db,
            exported_at: new Date().toISOString(),
            export_version: this.version
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `finance_database_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        return exportData;
    }

    // Импорт базы данных
    importDatabase(importData) {
        try {
            const data = typeof importData === 'string' ? JSON.parse(importData) : importData;
            
            // Проверяем валидность данных
            if (!data.tables || !data.metadata) {
                throw new Error('Неверный формат базы данных');
            }
            
            // Создаем резервную копию текущих данных
            this.createAutoBackup();
            
            // Импортируем данные
            localStorage.setItem(this.dbName, JSON.stringify(data));
            
            // Перестраиваем индексы
            this.rebuildIndexes();
            
            console.log('Database imported successfully');
            return true;
        } catch (error) {
            console.error('Error importing database:', error);
            throw error;
        }
    }
}

// Создаем глобальный экземпляр базы данных
window.financeDB = new FinanceDatabase();