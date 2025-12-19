import React, { useState, useEffect } from 'react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Trash2, User, LogOut, TrendingUp, TrendingDown, Wallet, Calendar, Plus } from 'lucide-react';

interface User {
  username: string;
  email: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
}

const incomeCategories = ['Зарплата', 'Подработка', 'Инвестиции', 'Подарки', 'Другое'];
const expenseCategories = ['Продукты', 'Транспорт', 'Жилье', 'Развлечения', 'Здоровье', 'Одежда', 'Образование', 'Другое'];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPeriod, setCurrentPeriod] = useState<'month' | 'year' | 'all'>('month');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [showSyncNotification, setShowSyncNotification] = useState(false);

  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ 
    username: '', 
    email: '', 
    password: '', 
    confirmPassword: '' 
  });
  const [transactionForm, setTransactionForm] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    category: '',
    description: ''
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadUserTransactions();
    }
  }, [currentUser, currentPeriod]);

  const checkAuthStatus = () => {
    const authData = localStorage.getItem('financeAuth');
    if (authData) {
      try {
        const { user } = JSON.parse(authData);
        if (user) {
          setCurrentUser(user);
        }
      } catch (e) {
        console.error('Invalid auth data');
      }
    }
  };

  const loadUserTransactions = () => {
    if (!currentUser) return;
    
    const storedTransactions = localStorage.getItem(`transactions_${currentUser.username}`);
    if (storedTransactions) {
      const allTransactions = JSON.parse(storedTransactions);
      const filteredTransactions = filterTransactionsByPeriod(allTransactions, currentPeriod);
      setTransactions(filteredTransactions);
    }
  };

  const filterTransactionsByPeriod = (allTransactions: Transaction[], period: string) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return allTransactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      
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
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('financeUsers') || '{}');
      
      if (users[loginForm.username] && users[loginForm.username].password === loginForm.password) {
        const user = {
          username: users[loginForm.username].username,
          email: users[loginForm.username].email,
          createdAt: users[loginForm.username].createdAt
        };
        
        const token = Date.now().toString() + Math.random().toString(36);
        localStorage.setItem('financeAuth', JSON.stringify({ user, token }));
        
        setCurrentUser(user);
        setSuccess('Вход выполнен успешно!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Неверный логин или пароль');
      }
      
      setLoading(false);
    }, 1000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    
    if (registerForm.password.length < 6 || !/[A-Z]/.test(registerForm.password) || !/\d/.test(registerForm.password)) {
      setError('Пароль должен содержать минимум 6 символов, одну заглавную букву и одну цифру');
      return;
    }
    
    setLoading(true);
    
    setTimeout(() => {
      const users = JSON.parse(localStorage.getItem('financeUsers') || '{}');
      
      if (users[registerForm.username]) {
        setError('Пользователь с таким логином уже существует');
        setLoading(false);
        return;
      }
      
      const newUser = {
        username: registerForm.username,
        email: registerForm.email,
        password: registerForm.password,
        createdAt: new Date().toISOString()
      };
      
      users[registerForm.username] = newUser;
      localStorage.setItem('financeUsers', JSON.stringify(users));
      localStorage.setItem(`transactions_${registerForm.username}`, JSON.stringify([]));
      
      setSuccess('Аккаунт успешно создан! Теперь вы можете войти.');
      setTimeout(() => {
        setIsLogin(true);
        setRegisterForm({ username: '', email: '', password: '', confirmPassword: '' });
      }, 2000);
      
      setLoading(false);
    }, 1000);
  };

  const handleLogout = () => {
    localStorage.removeItem('financeAuth');
    setCurrentUser(null);
    setTransactions([]);
    setLoginForm({ username: '', password: '' });
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: transactionForm.type,
      amount: parseFloat(transactionForm.amount),
      category: transactionForm.category,
      description: transactionForm.description,
      date: new Date().toISOString()
    };
    
    const storedTransactions = localStorage.getItem(`transactions_${currentUser.username}`);
    const allTransactions = storedTransactions ? JSON.parse(storedTransactions) : [];
    allTransactions.push(newTransaction);
    localStorage.setItem(`transactions_${currentUser.username}`, JSON.stringify(allTransactions));
    
    loadUserTransactions();
    setTransactionForm({ type: 'expense', amount: '', category: '', description: '' });
    
    setShowSyncNotification(true);
    setTimeout(() => setShowSyncNotification(false), 3000);
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!currentUser || !transactionToDelete) return;
    
    const storedTransactions = localStorage.getItem(`transactions_${currentUser.username}`);
    if (storedTransactions) {
      const allTransactions = JSON.parse(storedTransactions);
      const updatedTransactions = allTransactions.filter((t: Transaction) => t.id !== transactionToDelete.id);
      localStorage.setItem(`transactions_${currentUser.username}`, JSON.stringify(updatedTransactions));
      loadUserTransactions();
    }
    
    setShowDeleteModal(false);
    setTransactionToDelete(null);
  };

  const calculateStats = () => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = income - expense;
    
    return { income, expense, balance };
  };

  const getTopCategories = () => {
    const categoryTotals: { [key: string]: number } = {};
    
    transactions.forEach(transaction => {
      if (!categoryTotals[transaction.category]) {
        categoryTotals[transaction.category] = 0;
      }
      categoryTotals[transaction.category] += transaction.amount;
    });
    
    return Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([category, amount]) => ({ category, amount }));
  };

  const { income, expense, balance } = calculateStats();
  const topCategories = getTopCategories();

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="text-5xl mb-4">💰</div>
            <CardTitle className="text-2xl font-bold">Финансовый трекер</CardTitle>
            <CardDescription>Управляйте финансами вместе</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-6">
              <Button
                variant={isLogin ? "default" : "outline"}
                className="flex-1"
                onClick={() => setIsLogin(true)}
              >
                Вход
              </Button>
              <Button
                variant={!isLogin ? "default" : "outline"}
                className="flex-1"
                onClick={() => setIsLogin(false)}
              >
                Регистрация
              </Button>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                {success}
              </div>
            )}
            
            {isLogin ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-username">Логин</Label>
                  <Input
                    id="login-username"
                    type="text"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                    placeholder="Введите логин"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">Пароль</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    placeholder="Введите пароль"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Вход...' : 'Войти в аккаунт'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="register-username">Логин</Label>
                  <Input
                    id="register-username"
                    type="text"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                    placeholder="Придумайте логин"
                    required
                    minLength={3}
                  />
                </div>
                <div>
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                    placeholder="Введите email"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="register-password">Пароль</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                    placeholder="Придумайте пароль"
                    required
                    minLength={6}
                  />
                  <div className="text-xs text-gray-500 mt-2">
                    <div className={registerForm.password.length >= 6 ? 'text-green-600' : ''}>
                      {registerForm.password.length >= 6 ? '✓' : '○'} Минимум 6 символов
                    </div>
                    <div className={/[A-Z]/.test(registerForm.password) ? 'text-green-600' : ''}>
                      {/[A-Z]/.test(registerForm.password) ? '✓' : '○'} Одна заглавная буква
                    </div>
                    <div className={/\d/.test(registerForm.password) ? 'text-green-600' : ''}>
                      {/\d/.test(registerForm.password) ? '✓' : '○'} Одна цифра
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirm-password">Подтвердите пароль</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})}
                    placeholder="Повторите пароль"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Создание...' : 'Создать аккаунт'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600">
      {/* Header */}
      <header className="text-white p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-3xl">💰</div>
            <div>
              <h1 className="text-3xl font-bold">Финансовый трекер</h1>
              <p className="text-white/80">Управляйте своими финансами умно</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="font-semibold">{currentUser.username}</span>
            </div>
            <Button variant="secondary" onClick={handleLogout} className="bg-white/20 hover:bg-white/30">
              <LogOut className="w-4 h-4 mr-2" />
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Period Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Период просмотра
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              <Button
                variant={currentPeriod === 'month' ? 'default' : 'outline'}
                onClick={() => setCurrentPeriod('month')}
              >
                📆 Этот месяц
              </Button>
              <Button
                variant={currentPeriod === 'year' ? 'default' : 'outline'}
                onClick={() => setCurrentPeriod('year')}
              >
                📊 Этот год
              </Button>
              <Button
                variant={currentPeriod === 'all' ? 'default' : 'outline'}
                onClick={() => setCurrentPeriod('all')}
              >
                📈 Все время
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-3">
              ℹ️ Показаны данные за {currentPeriod === 'month' ? 'текущий месяц' : currentPeriod === 'year' ? 'текущий год' : 'все время'}
            </p>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm">Баланс</p>
                  <p className="text-3xl font-bold">₽{balance.toFixed(2)}</p>
                  <p className="text-white/60 text-xs">за {currentPeriod === 'month' ? 'этот месяц' : currentPeriod === 'year' ? 'этот год' : 'все время'}</p>
                </div>
                <Wallet className="w-8 h-8 text-white/60" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-600 to-emerald-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm">Доходы</p>
                  <p className="text-3xl font-bold">₽{income.toFixed(2)}</p>
                  <p className="text-white/60 text-xs">за {currentPeriod === 'month' ? 'этот месяц' : currentPeriod === 'year' ? 'этот год' : 'все время'}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-white/60" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-600 to-pink-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm">Расходы</p>
                  <p className="text-3xl font-bold">₽{expense.toFixed(2)}</p>
                  <p className="text-white/60 text-xs">за {currentPeriod === 'month' ? 'этот месяц' : currentPeriod === 'year' ? 'этот год' : 'все время'}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-white/60" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Add Transaction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Добавить транзакцию
              </CardTitle>
              <CardDescription>Запишите свой доход или расход</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Тип</Label>
                    <Select value={transactionForm.type} onValueChange={(value: 'income' | 'expense') => 
                      setTransactionForm({...transactionForm, type: value, category: ''})
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Расход</SelectItem>
                        <SelectItem value="income">Доход</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount">Сумма (₽)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={transactionForm.amount}
                      onChange={(e) => setTransactionForm({...transactionForm, amount: e.target.value})}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="category">Категория</Label>
                  <Select value={transactionForm.category} onValueChange={(value) => 
                    setTransactionForm({...transactionForm, category: value})
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      {(transactionForm.type === 'income' ? incomeCategories : expenseCategories).map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Описание</Label>
                  <Input
                    id="description"
                    value={transactionForm.description}
                    onChange={(e) => setTransactionForm({...transactionForm, description: e.target.value})}
                    placeholder="Введите описание"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Добавить транзакцию
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📊 Последние транзакции
              </CardTitle>
              <CardDescription>Ваша финансовая история за {currentPeriod === 'month' ? 'этот месяц' : currentPeriod === 'year' ? 'этот год' : 'все время'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📈</div>
                    <p>Нет транзакций</p>
                    <p className="text-sm">Добавьте первую транзакцию</p>
                  </div>
                ) : (
                  transactions.slice().reverse().map(transaction => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex-1">
                        <p className="font-semibold">{transaction.description}</p>
                        <p className="text-sm text-gray-600">{transaction.category} • {new Date(transaction.date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.type === 'income' ? '+' : '-'}₽{transaction.amount.toFixed(2)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTransaction(transaction)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Categories */}
        {topCategories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🏆 Топ категорий
              </CardTitle>
              <CardDescription>Самые крупные статьи доходов и расходов за {currentPeriod === 'month' ? 'этот месяц' : currentPeriod === 'year' ? 'этот год' : 'все время'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {topCategories.map(({ category, amount }) => (
                  <div key={category} className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="text-2xl mb-2">
                      {category === 'Продукты' ? '🛒' : 
                       category === 'Транспорт' ? '🚗' :
                       category === 'Жилье' ? '🏠' :
                       category === 'Развлечения' ? '🎮' :
                       category === 'Здоровье' ? '🏥' :
                       category === 'Одежда' ? '👕' :
                       category === 'Образование' ? '📚' :
                       category === 'Зарплата' ? '💼' :
                       category === 'Подработка' ? '💰' :
                       category === 'Инвестиции' ? '📈' :
                       category === 'Подарки' ? '🎁' : '📌'}
                    </div>
                    <p className="font-semibold text-sm">{category}</p>
                    <p className="text-purple-600 font-bold">₽{amount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && transactionToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <CardTitle>Удалить транзакцию?</CardTitle>
              <CardDescription>Это действие нельзя будет отменить</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="font-semibold">{transactionToDelete.description}</p>
                <p className="text-sm text-gray-600">{transactionToDelete.category} • {new Date(transactionToDelete.date).toLocaleDateString()}</p>
                <p className={`font-bold mt-2 ${transactionToDelete.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {transactionToDelete.type === 'income' ? '+' : '-'}₽{transactionToDelete.amount.toFixed(2)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                  Отмена
                </Button>
                <Button variant="destructive" onClick={confirmDelete}>
                  Удалить
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sync Notification */}
      {showSyncNotification && (
        <div className="fixed bottom-6 right-6 bg-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2 z-40">
          <div className="animate-spin">🔄</div>
          <span className="font-semibold text-green-600">Данные синхронизированы</span>
        </div>
      )}
    </div>
  );
}