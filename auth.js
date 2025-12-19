// Финансовый трекер - Модуль аутентификации с системой экспорта/импорта
class FinanceAuth {
    constructor() {
        this.currentUser = null;
        this.transactions = [];
        this.currentPeriod = 'month';
        this.transactionToDelete = null;
        this.incomeCategories = ['Зарплата', 'Подработка', 'Инвестиции', 'Подарки', 'Другое'];
        this.expenseCategories = ['Продукты', 'Транспорт', 'Жилье', 'Развлечения', 'Здоровье', 'Одежда', 'Образование', 'Другое'];
        this.lastSyncTime = null;
        this.syncInterval = null;
        this.dataVersion = 1;
        this.init();
    }

    // Инициализация
    init() {
        console.log('FinanceAuth initializing...');
        this.initializeGlobalStorage();
        this.checkAuthStatus();
        this.setupEventListeners();
        setTimeout(() => this.updateCategories(), 100);
        this.createTestUser();
    }

    // Инициализация глобального хранилища
    initializeGlobalStorage() {
        // Создаем глобальное хранилище в localStorage с уникальным ключом
        const globalKey = 'finance_tracker_global_data';
        
        if (!localStorage.getItem(globalKey)) {
            const globalData = {
                users: {},
                transactions: {},
                version: this.dataVersion,
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem(globalKey, JSON.stringify(globalData));
        }
        
        // Проверяем версию данных
        const globalData = JSON.parse(localStorage.getItem(globalKey));
        if (globalData.version !== this.dataVersion) {
            // Миграция данных при необходимости
            globalData.version = this.dataVersion;
            globalData.lastUpdated = new Date().toISOString();
            localStorage.setItem(globalKey, JSON.stringify(globalData));
        }
    }

    // Получение глобальных данных
    getGlobalData() {
        try {
            return JSON.parse(localStorage.getItem('finance_tracker_global_data') || '{}');
        } catch (e) {
            console.error('Error reading global data:', e);
            return { users: {}, transactions: {}, version: this.dataVersion };
        }
    }

    // Сохранение глобальных данных
    saveGlobalData(data) {
        try {
            data.lastUpdated = new Date().toISOString();
            localStorage.setItem('finance_tracker_global_data', JSON.stringify(data));
            console.log('Global data saved');
            return true;
        } catch (e) {
            console.error('Error saving global data:', e);
            return false;
        }
    }

    // Создание тестового пользователя
    createTestUser() {
        const globalData = this.getGlobalData();
        
        if (!globalData.users['test']) {
            globalData.users['test'] = {
                username: 'test',
                email: 'test@example.com',
                password: 'Test123',
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                deviceId: this.generateDeviceId()
            };
            
            globalData.transactions['test'] = [];
            this.saveGlobalData(globalData);
            console.log('Test user created in global storage');
        }
    }

    // Генерация ID устройства
    generateDeviceId() {
        let deviceId = localStorage.getItem('finance_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('finance_device_id', deviceId);
        }
        return deviceId;
    }

    // Проверка статуса аутентификации
    checkAuthStatus() {
        console.log('Checking auth status...');
        const authData = localStorage.getItem('financeAuth');
        if (authData) {
            try {
                const { user, token } = JSON.parse(authData);
                if (user && token) {
                    console.log('User found:', user.username);
                    this.currentUser = user;
                    this.loadUserTransactions();
                    this.showMainApp();
                    this.startAutoSync();
                    return;
                }
            } catch (e) {
                console.error('Invalid auth data:', e);
                localStorage.removeItem('financeAuth');
            }
        }
        this.showAuth();
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Табы аутентификации
        const loginTab = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');
        
        if (loginTab) loginTab.onclick = () => this.switchAuthTab('login');
        if (registerTab) registerTab.onclick = () => this.switchAuthTab('register');
        
        // Формы
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.onsubmit = (e) => this.handleLogin(e);

        const registerForm = document.getElementById('registerForm');
        if (registerForm) registerForm.onsubmit = (e) => this.handleRegister(e);

        const registerPassword = document.getElementById('registerPassword');
        if (registerPassword) registerPassword.oninput = () => this.checkPasswordRequirements();

        const transactionForm = document.getElementById('transactionForm');
        if (transactionForm) transactionForm.onsubmit = (e) => this.handleAddTransaction(e);

        const typeSelect = document.getElementById('type');
        if (typeSelect) typeSelect.onchange = () => this.updateCategories();
        
        // Кнопки периода
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.onclick = () => this.changePeriod(btn.dataset.period);
        });
        
        // Кнопка выхода
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.onclick = () => this.logout();
        
        // Кнопки синхронизации
        const exportBtn = document.getElementById('exportBtn');
        const importBtn = document.getElementById('importBtn');
        const syncBtn = document.getElementById('syncBtn');
        
        if (exportBtn) exportBtn.onclick = () => this.exportData();
        if (importBtn) importBtn.onclick = () => this.importData();
        if (syncBtn) syncBtn.onclick = () => this.syncWithGlobal();
        
        // Модальное окно удаления
        const modalCancel = document.getElementById('modalCancel');
        const modalConfirm = document.getElementById('modalConfirm');
        
        if (modalCancel) modalCancel.onclick = () => this.closeDeleteModal();
        if (modalConfirm) modalConfirm.onclick = () => this.confirmDelete();
        
        const modalOverlay = document.getElementById('deleteModal');
        if (modalOverlay) {
            modalOverlay.onclick = (e) => {
                if (e.target === modalOverlay) {
                    this.closeDeleteModal();
                }
            };
        }
    }

    // Запуск автоматической синхронизации
    startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // Синхронизируем каждые 5 секунд
        this.syncInterval = setInterval(() => {
            if (this.currentUser) {
                this.syncWithGlobal();
            }
        }, 5000);
        
        // Синхронизируем при фокусе окна
        window.addEventListener('focus', () => {
            if (this.currentUser) {
                this.syncWithGlobal();
            }
        });
        
        // Синхронизируем при изменении видимости страницы
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentUser) {
                this.syncWithGlobal();
            }
        });
    }

    // Остановка автоматической синхронизации
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // Синхронизация с глобальным хранилищем
    syncWithGlobal() {
        if (!this.currentUser) return;
        
        try {
            console.log('Syncing with global storage for user:', this.currentUser.username);
            
            const globalData = this.getGlobalData();
            const userTransactions = globalData.transactions[this.currentUser.username] || [];
            const userLastModified = globalData.users[this.currentUser.username]?.lastModified;
            
            // Получаем локальные данные
            const localTransactions = JSON.parse(localStorage.getItem(`transactions_${this.currentUser.username}`) || '[]');
            const localLastModified = localStorage.getItem(`lastModified_${this.currentUser.username}`);
            
            // Анализируем, какие данные новее
            let shouldUpdate = false;
            let shouldUpload = false;
            
            if (!userLastModified && !localLastModified) {
                // Первая синхронизация
                shouldUpdate = true;
            } else if (!userLastModified) {
                // В глобальном хранилище нет данных
                shouldUpload = true;
            } else if (!localLastModified) {
                // Локально нет данных
                shouldUpdate = true;
            } else {
                // Сравниваем временные метки
                const globalTime = new Date(userLastModified).getTime();
                const localTime = new Date(localLastModified).getTime();
                
                if (globalTime > localTime) {
                    // Глобальные данные новее
                    shouldUpdate = true;
                } else if (localTime > globalTime) {
                    // Локальные данные новее
                    shouldUpload = true;
                }
            }
            
            if (shouldUpdate) {
                // Обновляем локальные данные
                localStorage.setItem(`transactions_${this.currentUser.username}`, JSON.stringify(userTransactions));
                if (userLastModified) {
                    localStorage.setItem(`lastModified_${this.currentUser.username}`, userLastModified);
                }
                
                // Перезагружаем транзакции
                this.loadUserTransactions();
                
                this.showSyncNotification('Данные обновлены');
            } else if (shouldUpload) {
                // Загружаем локальные данные в глобальное хранилище
                globalData.transactions[this.currentUser.username] = localTransactions;
                
                const now = new Date().toISOString();
                if (globalData.users[this.currentUser.username]) {
                    globalData.users[this.currentUser.username].lastModified = now;
                }
                
                this.saveGlobalData(globalData);
                localStorage.setItem(`lastModified_${this.currentUser.username}`, now);
                
                this.showSyncNotification('Данные сохранены');
            }
            
            this.lastSyncTime = new Date();
            this.updateSyncStatus();
            
        } catch (error) {
            console.error('Error syncing with global storage:', error);
            this.showError('Ошибка синхронизации');
        }
    }

    // Экспорт данных
    exportData() {
        if (!this.currentUser) {
            this.showError('Сначала войдите в систему');
            return;
        }
        
        try {
            const globalData = this.getGlobalData();
            const userData = {
                user: globalData.users[this.currentUser.username],
                transactions: globalData.transactions[this.currentUser.username] || [],
                exportDate: new Date().toISOString(),
                version: this.dataVersion
            };
            
            const dataStr = JSON.stringify(userData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `finance_data_${this.currentUser.username}_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            this.showSuccess('Данные экспортированы');
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Ошибка экспорта данных');
        }
    }

    // Импорт данных
    importData() {
        if (!this.currentUser) {
            this.showError('Сначала войдите в систему');
            return;
        }
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    
                    // Проверяем валидность данных
                    if (!importedData.user || !importedData.transactions) {
                        throw new Error('Неверный формат данных');
                    }
                    
                    if (importedData.user.username !== this.currentUser.username) {
                        throw new Error('Данные принадлежат другому пользователю');
                    }
                    
                    // Объединяем данные
                    const globalData = this.getGlobalData();
                    const existingTransactions = globalData.transactions[this.currentUser.username] || [];
                    
                    // Находим уникальные транзакции
                    const existingIds = new Set(existingTransactions.map(t => t.id));
                    const newTransactions = importedData.transactions.filter(t => !existingIds.has(t.id));
                    
                    // Объединяем транзакции
                    const mergedTransactions = [...existingTransactions, ...newTransactions];
                    
                    // Сохраняем в глобальное хранилище
                    globalData.transactions[this.currentUser.username] = mergedTransactions;
                    globalData.users[this.currentUser.username].lastModified = new Date().toISOString();
                    
                    this.saveGlobalData(globalData);
                    
                    // Синхронизируем
                    this.syncWithGlobal();
                    
                    this.showSuccess(`Импортировано ${newTransactions.length} новых транзакций`);
                    
                } catch (error) {
                    console.error('Import error:', error);
                    this.showError('Ошибка импорта: ' + error.message);
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }

    // Обновление статуса синхронизации
    updateSyncStatus() {
        const syncStatus = document.getElementById('syncStatus');
        
        if (!syncStatus) return;
        
        if (this.lastSyncTime) {
            const timeAgo = this.getTimeAgo(this.lastSyncTime);
            syncStatus.textContent = `🟢 Синхронизировано ${timeAgo}`;
            syncStatus.className = 'sync-status online';
        } else {
            syncStatus.textContent = '🟡 Не синхронизировано';
            syncStatus.className = 'sync-status pending';
        }
    }

    // Получение времени в формате "X минут назад"
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'только что';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} мин. назад`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч. назад`;
        return `${Math.floor(seconds / 86400)} д. назад`;
    }

    // Переключение вкладок аутентификации
    switchAuthTab(tab) {
        const tabs = document.querySelectorAll('.auth-tab');
        const forms = document.querySelectorAll('.auth-form');
        
        tabs.forEach(t => t.classList.remove('active'));
        forms.forEach(f => f.classList.remove('active'));
        
        if (tab === 'login') {
            tabs[0]?.classList.add('active');
            const loginForm = document.getElementById('loginForm');
            if (loginForm) loginForm.classList.add('active');
        } else {
            tabs[1]?.classList.add('active');
            const registerForm = document.getElementById('registerForm');
            if (registerForm) registerForm.classList.add('active');
        }
        
        this.hideMessages();
    }

    // Обработка входа
    async handleLogin(event) {
        event.preventDefault();
        
        const usernameInput = document.getElementById('loginUsername');
        const passwordInput = document.getElementById('loginPassword');
        
        if (!usernameInput || !passwordInput) {
            this.showError('Форма входа не найдена');
            return;
        }
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (!username || !password) {
            this.showError('Заполните все поля');
            return;
        }
        
        // Показываем состояние загрузки
        const loginBtn = document.getElementById('loginBtn');
        const loginBtnText = document.getElementById('loginBtnText');
        if (loginBtn) loginBtn.disabled = true;
        if (loginBtnText) loginBtnText.innerHTML = '<span class="loading-spinner"></span> Вход...';
        
        setTimeout(() => {
            try {
                const globalData = this.getGlobalData();
                const user = globalData.users[username];
                
                if (user && user.password === password) {
                    this.currentUser = {
                        username: user.username,
                        email: user.email,
                        createdAt: user.createdAt
                    };
                    
                    // Сохраняем сессию
                    const token = Date.now().toString() + Math.random().toString(36);
                    localStorage.setItem('financeAuth', JSON.stringify({ user: this.currentUser, token }));
                    
                    // Синхронизируем данные
                    this.syncWithGlobal();
                    
                    this.showMainApp();
                    this.hideMessages();
                    this.startAutoSync();
                    
                    const loginForm = document.getElementById('loginForm');
                    if (loginForm) loginForm.reset();
                    
                } else {
                    this.showError('Неверный логин или пароль');
                }
            } catch (error) {
                console.error('Login error:', error);
                this.showError('Ошибка при входе. Попробуйте еще раз.');
            }
            
            if (loginBtn) loginBtn.disabled = false;
            if (loginBtnText) loginBtnText.textContent = 'Войти в аккаунт';
        }, 1000);
    }

    // Обработка регистрации
    async handleRegister(event) {
        event.preventDefault();
        
        const usernameInput = document.getElementById('registerUsername');
        const emailInput = document.getElementById('registerEmail');
        const passwordInput = document.getElementById('registerPassword');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        
        if (!usernameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
            this.showError('Форма регистрации не найдена');
            return;
        }
        
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Валидация
        if (!username || !email || !password || !confirmPassword) {
            this.showError('Заполните все поля');
            return;
        }
        
        if (username.length < 3) {
            this.showError('Логин должен содержать минимум 3 символа');
            return;
        }
        
        if (!email.includes('@') || !email.includes('.')) {
            this.showError('Введите корректный email');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showError('Пароли не совпадают');
            return;
        }
        
        if (!this.validatePassword(password)) {
            this.showError('Пароль не соответствует требованиям');
            return;
        }
        
        // Показываем состояние загрузки
        const registerBtn = document.getElementById('registerBtn');
        const registerBtnText = document.getElementById('registerBtnText');
        if (registerBtn) registerBtn.disabled = true;
        if (registerBtnText) registerBtnText.innerHTML = '<span class="loading-spinner"></span> Создание...';
        
        setTimeout(() => {
            try {
                const globalData = this.getGlobalData();
                
                if (globalData.users[username]) {
                    this.showError('Пользователь с таким логином уже существует');
                    if (registerBtn) registerBtn.disabled = false;
                    if (registerBtnText) registerBtnText.textContent = 'Создать аккаунт';
                    return;
                }
                
                const newUser = {
                    username,
                    email,
                    password,
                    createdAt: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    deviceId: this.generateDeviceId()
                };
                
                // Сохраняем пользователя в глобальное хранилище
                globalData.users[username] = newUser;
                globalData.transactions[username] = [];
                
                this.saveGlobalData(globalData);
                
                // Автоматически входим после регистрации
                this.currentUser = {
                    username: newUser.username,
                    email: newUser.email,
                    createdAt: newUser.createdAt
                };
                
                const token = Date.now().toString() + Math.random().toString(36);
                localStorage.setItem('financeAuth', JSON.stringify({ user: this.currentUser, token }));
                
                this.showMainApp();
                this.showSuccess('Аккаунт успешно создан!');
                this.startAutoSync();
                
                const registerForm = document.getElementById('registerForm');
                if (registerForm) registerForm.reset();
                
            } catch (error) {
                console.error('Registration error:', error);
                this.showError('Ошибка при регистрации. Попробуйте еще раз.');
            }
            
            if (registerBtn) registerBtn.disabled = false;
            if (registerBtnText) registerBtnText.textContent = 'Создать аккаунт';
        }, 1000);
    }

    // Валидация пароля
    validatePassword(password) {
        return password.length >= 6 && /[A-Z]/.test(password) && /\d/.test(password);
    }

    // Проверка требований к паролю
    checkPasswordRequirements() {
        const passwordInput = document.getElementById('registerPassword');
        if (!passwordInput) return;
        
        const password = passwordInput.value;
        const reqLength = document.getElementById('reqLength');
        const reqUpper = document.getElementById('reqUpper');
        const reqNumber = document.getElementById('reqNumber');
        
        if (reqLength) {
            if (password.length >= 6) {
                reqLength.textContent = '✓ Минимум 6 символов';
                reqLength.classList.add('met');
            } else {
                reqLength.textContent = '○ Минимум 6 символов';
                reqLength.classList.remove('met');
            }
        }
        
        if (reqUpper) {
            if (/[A-Z]/.test(password)) {
                reqUpper.textContent = '✓ Одна заглавная буква';
                reqUpper.classList.add('met');
            } else {
                reqUpper.textContent = '○ Одна заглавная буква';
                reqUpper.classList.remove('met');
            }
        }
        
        if (reqNumber) {
            if (/\d/.test(password)) {
                reqNumber.textContent = '✓ Одна цифра';
                reqNumber.classList.add('met');
            } else {
                reqNumber.textContent = '○ Одна цифра';
                reqNumber.classList.remove('met');
            }
        }
    }

    // Выход из системы
    logout() {
        // Синхронизируем данные перед выходом
        if (this.currentUser) {
            this.syncWithGlobal();
        }
        
        localStorage.removeItem('financeAuth');
        this.currentUser = null;
        this.transactions = [];
        this.stopAutoSync();
        this.showAuth();
    }

    // Загрузка транзакций пользователя
    loadUserTransactions() {
        if (!this.currentUser) return;
        
        try {
            const storedTransactions = localStorage.getItem(`transactions_${this.currentUser.username}`);
            if (storedTransactions) {
                const allTransactions = JSON.parse(storedTransactions);
                const filteredTransactions = this.filterTransactionsByPeriod(allTransactions, this.currentPeriod);
                this.transactions = filteredTransactions;
            } else {
                this.transactions = [];
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
            this.transactions = [];
        }
        this.updateUI();
    }

    // Фильтрация транзакций по периоду
    filterTransactionsByPeriod(allTransactions, period) {
        if (!allTransactions || !Array.isArray(allTransactions)) return [];
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        return allTransactions.filter(transaction => {
            if (!transaction || !transaction.date) return false;
            
            const transactionDate = new Date(transaction.date);
            if (isNaN(transactionDate.getTime())) return false;
            
            switch (period) {
                case 'month':
                    return transactionDate.getMonth() === currentMonth && 
                           transactionDate.getFullYear() === currentYear;
                case 'year':
                    return transactionDate.getFullYear() === currentYear;
                case 'all':
                    return true;
                default:
                    return true;
            }
        });
    }

    // Обработка добавления транзакции
    handleAddTransaction(event) {
        event.preventDefault();
        
        if (!this.currentUser) {
            this.showError('Сначала войдите в систему');
            return;
        }
        
        const typeSelect = document.getElementById('type');
        const amountInput = document.getElementById('amount');
        const categorySelect = document.getElementById('category');
        const descriptionInput = document.getElementById('description');
        
        if (!typeSelect || !amountInput || !categorySelect || !descriptionInput) {
            this.showError('Форма транзакции не найдена');
            return;
        }
        
        const type = typeSelect.value;
        const amountStr = amountInput.value;
        const category = categorySelect.value;
        const description = descriptionInput.value.trim();
        
        // Валидация
        if (!type || !amountStr || !category || !description) {
            this.showError('Заполните все поля');
            return;
        }
        
        const amount = parseFloat(amountStr);
        
        if (isNaN(amount) || amount <= 0) {
            this.showError('Введите корректную сумму');
            return;
        }
        
        const newTransaction = {
            id: Date.now().toString() + Math.random().toString(36),
            type,
            amount,
            category,
            description,
            date: new Date().toISOString()
        };
        
        try {
            // Сохраняем транзакцию локально
            let allTransactions = [];
            const storedTransactions = localStorage.getItem(`transactions_${this.currentUser.username}`);
            if (storedTransactions) {
                try {
                    allTransactions = JSON.parse(storedTransactions);
                } catch (e) {
                    allTransactions = [];
                }
            }
            
            if (!Array.isArray(allTransactions)) {
                allTransactions = [];
            }
            
            allTransactions.push(newTransaction);
            localStorage.setItem(`transactions_${this.currentUser.username}`, JSON.stringify(allTransactions));
            
            // Обновляем временную метку
            const now = new Date().toISOString();
            localStorage.setItem(`lastModified_${this.currentUser.username}`, now);
            
            // Синхронизируем с глобальным хранилищем
            this.syncWithGlobal();
            
            // Обновляем интерфейс
            this.loadUserTransactions();
            
            // Очищаем форму
            const transactionForm = document.getElementById('transactionForm');
            if (transactionForm) transactionForm.reset();
            
            // Обновляем категории
            this.updateCategories();
            
            // Показываем уведомление об успехе
            this.showSuccess('Транзакция успешно добавлена!');
            
        } catch (error) {
            console.error('Error adding transaction:', error);
            this.showError('Ошибка при добавлении транзакции');
        }
    }

    // Удаление транзакции
    async deleteTransaction(transactionId) {
        if (!this.currentUser) return;
        
        try {
            const storedTransactions = localStorage.getItem(`transactions_${this.currentUser.username}`);
            if (storedTransactions) {
                let allTransactions = JSON.parse(storedTransactions);
                if (!Array.isArray(allTransactions)) {
                    allTransactions = [];
                }
                
                const updatedTransactions = allTransactions.filter(t => t.id !== transactionId);
                localStorage.setItem(`transactions_${this.currentUser.username}`, JSON.stringify(updatedTransactions));
                
                // Обновляем временную метку
                const now = new Date().toISOString();
                localStorage.setItem(`lastModified_${this.currentUser.username}`, now);
                
                // Синхронизируем с глобальным хранилищем
                this.syncWithGlobal();
                
                // Обновляем интерфейс
                this.loadUserTransactions();
                
                this.showSuccess('Транзакция удалена');
            }
        } catch (error) {
            console.error('Error deleting transaction:', error);
            this.showError('Ошибка при удалении транзакции');
        }
    }

    // Изменение периода
    changePeriod(period) {
        this.currentPeriod = period;
        
        // Обновляем активную кнопку
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.period === period) {
                btn.classList.add('active');
            }
        });
        
        // Обновляем информацию о периоде
        const periodInfo = document.getElementById('periodInfo');
        if (periodInfo) {
            const periodText = period === 'month' ? 'текущий месяц' : 
                              period === 'year' ? 'текущий год' : 'все время';
            periodInfo.innerHTML = `<span>ℹ️</span> Показаны данные за ${periodText}`;
        }
        
        // Перезагружаем транзакции с новым фильтром
        this.loadUserTransactions();
    }

    // Обновление категорий
    updateCategories() {
        const typeSelect = document.getElementById('type');
        const categorySelect = document.getElementById('category');
        
        if (!typeSelect || !categorySelect) {
            return;
        }
        
        const type = typeSelect.value;
        const categories = type === 'income' ? this.incomeCategories : this.expenseCategories;
        
        categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }

    // Расчет статистики
    calculateStats() {
        if (!this.transactions || !Array.isArray(this.transactions)) {
            return { income: 0, expense: 0, balance: 0 };
        }
        
        const income = this.transactions
            .filter(t => t && t.type === 'income')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        const expense = this.transactions
            .filter(t => t && t.type === 'expense')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        const balance = income - expense;
        
        return { income, expense, balance };
    }

    // Получение топ категорий
    getTopCategories() {
        if (!this.transactions || !Array.isArray(this.transactions)) {
            return [];
        }
        
        const categoryTotals = {};
        
        this.transactions.forEach(transaction => {
            if (transaction && transaction.category) {
                if (!categoryTotals[transaction.category]) {
                    categoryTotals[transaction.category] = 0;
                }
                categoryTotals[transaction.category] += transaction.amount || 0;
            }
        });
        
        return Object.entries(categoryTotals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([category, amount]) => ({ category, amount }));
    }

    // Обновление интерфейса
    updateUI() {
        if (!this.currentUser) return;
        
        const { income, expense, balance } = this.calculateStats();
        const topCategories = this.getTopCategories();
        
        // Обновляем статистику
        const balanceEl = document.getElementById('balance');
        const incomeEl = document.getElementById('income');
        const expenseEl = document.getElementById('expense');
        
        if (balanceEl) balanceEl.textContent = `₽${balance.toFixed(2)}`;
        if (incomeEl) incomeEl.textContent = `₽${income.toFixed(2)}`;
        if (expenseEl) expenseEl.textContent = `₽${expense.toFixed(2)}`;
        
        // Обновляем период в статистике
        const periodText = this.currentPeriod === 'month' ? 'этот месяц' : 
                          this.currentPeriod === 'year' ? 'этот год' : 'все время';
        
        const balancePeriodEl = document.getElementById('balancePeriod');
        const incomePeriodEl = document.getElementById('incomePeriod');
        const expensePeriodEl = document.getElementById('expensePeriod');
        
        if (balancePeriodEl) balancePeriodEl.textContent = `за ${periodText}`;
        if (incomePeriodEl) incomePeriodEl.textContent = `за ${periodText}`;
        if (expensePeriodEl) expensePeriodEl.textContent = `за ${periodText}`;
        
        // Обновляем список транзакций
        const transactionsList = document.getElementById('transactionsList');
        if (transactionsList) {
            if (!this.transactions || this.transactions.length === 0) {
                transactionsList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📈</div>
                        <p>Нет транзакций</p>
                        <p style="font-size: 0.9rem; margin-top: 8px;">Добавьте первую транзакцию</p>
                    </div>
                `;
            } else {
                transactionsList.innerHTML = this.transactions
                    .slice()
                    .reverse()
                    .map(transaction => `
                        <div class="transaction-item">
                            <div class="transaction-info">
                                <div class="transaction-description">${transaction.description || 'Без описания'}</div>
                                <div class="transaction-meta">${transaction.category || 'Без категории'} • ${transaction.date ? new Date(transaction.date).toLocaleDateString() : 'Без даты'}</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div class="transaction-amount ${transaction.type === 'income' ? 'amount-income' : 'amount-expense'}">
                                    ${transaction.type === 'income' ? '+' : '-'}₽${(transaction.amount || 0).toFixed(2)}
                                </div>
                                <button class="delete-btn" onclick="financeAuth.showDeleteModal('${transaction.id}')">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    `).join('');
            }
        }
        
        // Обновляем топ категорий
        const categoriesCard = document.getElementById('categoriesCard');
        const categoriesGrid = document.getElementById('categoriesGrid');
        
        if (topCategories.length > 0 && categoriesCard && categoriesGrid) {
            categoriesCard.style.display = 'block';
            categoriesGrid.innerHTML = topCategories.map(({ category, amount }) => {
                const icon = this.getCategoryIcon(category);
                return `
                    <div class="category-item">
                        <div class="category-icon">${icon}</div>
                        <div class="category-name">${category}</div>
                        <div class="category-amount">₽${amount.toFixed(2)}</div>
                    </div>
                `;
            }).join('');
        } else if (categoriesCard) {
            categoriesCard.style.display = 'none';
        }
        
        // Обновляем описания
        const transactionsDescription = document.getElementById('transactionsDescription');
        const categoriesDescription = document.getElementById('categoriesDescription');
        
        if (transactionsDescription) {
            transactionsDescription.textContent = `Ваша финансовая история за ${periodText}`;
        }
        if (categoriesDescription) {
            categoriesDescription.textContent = `Самые крупные статьи доходов и расходов за ${periodText}`;
        }
        
        // Обновляем статус синхронизации
        this.updateSyncStatus();
    }

    // Получение иконки категории
    getCategoryIcon(category) {
        const icons = {
            'Продукты': '🛒',
            'Транспорт': '🚗',
            'Жилье': '🏠',
            'Развлечения': '🎮',
            'Здоровье': '🏥',
            'Одежда': '👕',
            'Образование': '📚',
            'Зарплата': '💼',
            'Подработка': '💰',
            'Инвестиции': '📈',
            'Подарки': '🎁'
        };
        return icons[category] || '📌';
    }

    // Показать модальное окно удаления
    showDeleteModal(transactionId) {
        const transaction = this.transactions.find(t => t.id === transactionId);
        if (!transaction) return;
        
        this.transactionToDelete = transaction;
        
        const modalDesc = document.getElementById('modalTransactionDesc');
        const modalMeta = document.getElementById('modalTransactionMeta');
        const modalAmount = document.getElementById('modalTransactionAmount');
        
        if (modalDesc) modalDesc.textContent = transaction.description || 'Без описания';
        if (modalMeta) modalMeta.textContent = `${transaction.category || 'Без категории'} • ${transaction.date ? new Date(transaction.date).toLocaleDateString() : 'Без даты'}`;
        if (modalAmount) {
            modalAmount.textContent = `${transaction.type === 'income' ? '+' : '-'}₽${(transaction.amount || 0).toFixed(2)}`;
            modalAmount.className = `modal-transaction-amount ${transaction.type === 'income' ? 'amount-income' : 'amount-expense'}`;
        }
        
        const modal = document.getElementById('deleteModal');
        if (modal) modal.classList.add('active');
    }

    // Закрыть модальное окно удаления
    closeDeleteModal() {
        const modal = document.getElementById('deleteModal');
        if (modal) modal.classList.remove('active');
        this.transactionToDelete = null;
    }

    // Подтвердить удаление
    confirmDelete() {
        if (this.transactionToDelete) {
            this.deleteTransaction(this.transactionToDelete.id);
            this.closeDeleteModal();
        }
    }

    // Показать интерфейс аутентификации
    showAuth() {
        const authContainer = document.getElementById('authContainer');
        const mainApp = document.getElementById('mainApp');
        
        if (authContainer) authContainer.style.display = 'flex';
        if (mainApp) mainApp.classList.remove('active');
    }

    // Показать основное приложение
    showMainApp() {
        const authContainer = document.getElementById('authContainer');
        const mainApp = document.getElementById('mainApp');
        const currentUserDisplay = document.getElementById('currentUserDisplay');
        
        if (authContainer) authContainer.style.display = 'none';
        if (mainApp) mainApp.classList.add('active');
        if (currentUserDisplay && this.currentUser) currentUserDisplay.textContent = this.currentUser.username;
    }

    // Показать ошибку
    showError(message) {
        const errorEl = document.getElementById('errorMessage');
        const successEl = document.getElementById('successMessage');
        
        if (successEl) successEl.classList.remove('show');
        
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('show');
            setTimeout(() => {
                errorEl.classList.remove('show');
            }, 5000);
        }
    }

    // Показать успех
    showSuccess(message) {
        const errorEl = document.getElementById('errorMessage');
        const successEl = document.getElementById('successMessage');
        
        if (errorEl) errorEl.classList.remove('show');
        
        if (successEl) {
            successEl.textContent = message;
            successEl.classList.add('show');
            setTimeout(() => {
                successEl.classList.remove('show');
            }, 5000);
        }
    }

    // Скрыть сообщения
    hideMessages() {
        const errorEl = document.getElementById('errorMessage');
        const successEl = document.getElementById('successMessage');
        
        if (errorEl) errorEl.classList.remove('show');
        if (successEl) successEl.classList.remove('show');
    }

    // Показать уведомление о синхронизации
    showSyncNotification(message = 'Данные синхронизированы') {
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
            syncStatus.textContent = message;
            syncStatus.classList.add('show');
            setTimeout(() => {
                syncStatus.classList.remove('show');
            }, 3000);
        }
    }
}

// Делаем класс доступным глобально
window.FinanceAuth = FinanceAuth;