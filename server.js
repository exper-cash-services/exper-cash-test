const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// استيراد دوال قاعدة البيانات
const {
    initializeDatabase,
    getUserByUsername,
    saveOperation,
    getUserOperations,
    getSystemSettings,
    updateSystemSetting,
    getSections,
    addSection,
    deleteSection,
    getAllUsers,
    addUser,
    updateUserStatus,
    updateLastLogin,
    incrementLoginAttempts,
    isUserLocked,
    logAction,
    getAuditLog,
    getSystemStats,
    exportData,
    healthCheck,
    pool
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'exper-cash-super-secret-key-2024-morocco-system';

// إعدادات الأمان والحدود
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 دقيقة
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // حد أقصى 100 طلب
    message: {
        success: false,
        message: 'تم تجاوز الحد المسموح من الطلبات، يرجى المحاولة لاحقاً'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 5, // 5 محاولات تسجيل دخول فقط
    message: {
        success: false,
        message: 'تم تجاوز عدد محاولات تسجيل الدخول المسموحة'
    }
});

// إعدادات الأمان
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "data:"],
            connectSrc: ["'self'"]
        }
    }
}));

app.use(compression());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] 
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// تطبيق Rate Limiting
app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// خدمة الملفات الثابتة
app.use(express.static(path.join(__dirname, '.')));

// Middleware للتحقق من الهوية
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access token required' 
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid or expired token' 
            });
        }
        req.user = user;
        next();
    });
};

// Middleware للتحقق من صلاحيات المدير
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'صلاحيات المدير مطلوبة'
        });
    }
    next();
};

// Middleware لتسجيل الطلبات
const logRequest = (req, res, next) => {
    const userAgent = req.get('User-Agent');
    const ip = req.ip || req.connection.remoteAddress;
    req.clientInfo = { ip, userAgent };
    next();
};

app.use(logRequest);

// === ROUTES ===

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// صفحات النظام
app.get('/admin-panel.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_panel.html'));
});

app.get('/data-entry.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'data_entry_system.html'));
});

app.get('/enhanced-system.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'enhanced_financial_system.html'));
});

app.get('/website-preview.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'website_preview.html'));
});

// === API ROUTES ===

// تسجيل الدخول
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'اسم المستخدم وكلمة المرور مطلوبان'
            });
        }

        // التحقق من قفل المستخدم
        if (await isUserLocked(username)) {
            return res.status(423).json({
                success: false,
                message: 'الحساب مقفل مؤقتاً بسبب محاولات دخول فاشلة متكررة'
            });
        }

        // البحث عن المستخدم
        const user = await getUserByUsername(username);
        
        if (!user) {
            await incrementLoginAttempts(username);
            return res.status(401).json({
                success: false,
                message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
            });
        }

        // التحقق من كلمة المرور
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            await incrementLoginAttempts(username);
            return res.status(401).json({
                success: false,
                message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
            });
        }

        // تحديث آخر تسجيل دخول
        await updateLastLogin(user.id);

        // إنشاء JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // تسجيل عملية تسجيل الدخول
        await logAction(
            pool,
            user.id,
            'LOGIN',
            'users',
            user.id,
            null,
            { ip: req.clientInfo.ip },
            req.clientInfo.ip,
            req.clientInfo.userAgent
        );

        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في الخادم'
        });
    }
});

// تسجيل الخروج
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        // تسجيل عملية تسجيل الخروج
        await logAction(
            pool,
            req.user.id,
            'LOGOUT',
            'users',
            req.user.id,
            null,
            { ip: req.clientInfo.ip },
            req.clientInfo.ip,
            req.clientInfo.userAgent
        );

        res.json({
            success: true,
            message: 'تم تسجيل الخروج بنجاح'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تسجيل الخروج'
        });
    }
});

// حفظ العمليات
app.post('/api/operations', authenticateToken, async (req, res) => {
    try {
        const operationData = {
            date: req.body.date,
            balances: req.body.balances,
            operations: req.body.operations,
            totals: req.body.totals,
            metadata: {
                ...req.body.metadata,
                ip: req.clientInfo.ip,
                userAgent: req.clientInfo.userAgent
            }
        };

        const result = await saveOperation(req.user.id, operationData);

        res.json({
            success: true,
            data: result,
            message: 'تم حفظ البيانات بنجاح'
        });

    } catch (error) {
        console.error('Save operation error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في حفظ البيانات'
        });
    }
});

// جلب العمليات
app.get('/api/operations', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        const operations = await getUserOperations(req.user.id, limit, offset);
        
        res.json({
            success: true,
            data: operations,
            pagination: {
                limit,
                offset,
                total: operations.length
            }
        });

    } catch (error) {
        console.error('Get operations error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب البيانات'
        });
    }
});

// جلب الأقسام
app.get('/api/sections', authenticateToken, async (req, res) => {
    try {
        const sections = await getSections();
        
        res.json({
            success: true,
            data: sections
        });

    } catch (error) {
        console.error('Get sections error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب الأقسام'
        });
    }
});

// === ADMIN ROUTES ===

// إدارة المستخدمين
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await getAllUsers();
        
        res.json({
            success: true,
            data: users
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب المستخدمين'
        });
    }
});

// إضافة مستخدم جديد
app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userData = {
            username: req.body.username,
            password: req.body.password,
            name: req.body.name,
            role: req.body.role || 'user'
        };

        const newUser = await addUser(userData, req.user.id);

        res.json({
            success: true,
            data: newUser,
            message: 'تم إضافة المستخدم بنجاح'
        });

    } catch (error) {
        console.error('Add user error:', error);
        
        if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({
                success: false,
                message: 'اسم المستخدم موجود مسبقاً'
            });
        }

        res.status(500).json({
            success: false,
            message: 'خطأ في إضافة المستخدم'
        });
    }
});

// تحديث حالة المستخدم
app.patch('/api/admin/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { active } = req.body;

        // منع تعطيل آخر مدير نشط
        if (!active) {
            const users = await getAllUsers();
            const activeAdmins = users.filter(u => u.role === 'admin' && u.active && u.id !== userId);
            
            if (activeAdmins.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'لا يمكن تعطيل آخر مدير نشط في النظام'
                });
            }
        }

        await updateUserStatus(userId, active, req.user.id);

        res.json({
            success: true,
            message: `تم ${active ? 'تفعيل' : 'تعطيل'} المستخدم بنجاح`
        });

    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تحديث حالة المستخدم'
        });
    }
});

// إضافة قسم جديد
app.post('/api/admin/sections', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const sectionData = {
            sectionKey: req.body.sectionKey,
            nameAr: req.body.nameAr,
            nameFr: req.body.nameFr,
            type: req.body.type,
            icon: req.body.icon,
            notes: req.body.notes
        };

        const newSection = await addSection(sectionData, req.user.id);

        res.json({
            success: true,
            data: newSection,
            message: 'تم إضافة القسم بنجاح'
        });

    } catch (error) {
        console.error('Add section error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في إضافة القسم'
        });
    }
});

// حذف قسم
app.delete('/api/admin/sections/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const sectionId = parseInt(req.params.id);
        await deleteSection(sectionId, req.user.id);

        res.json({
            success: true,
            message: 'تم حذف القسم بنجاح'
        });

    } catch (error) {
        console.error('Delete section error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في حذف القسم'
        });
    }
});

// إعدادات النظام
app.get('/api/settings', authenticateToken, async (req, res) => {
    try {
        const settings = await getSystemSettings();
        
        res.json({
            success: true,
            data: settings
        });

    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب الإعدادات'
        });
    }
});

// تحديث إعدادات النظام
app.post('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const settings = req.body;

        // تحديث كل إعداد على حدة
        for (const [key, value] of Object.entries(settings)) {
            await updateSystemSetting(key, value, req.user.id);
        }

        res.json({
            success: true,
            message: 'تم حفظ الإعدادات بنجاح'
        });

    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في حفظ الإعدادات'
        });
    }
});

// سجل النظام
app.get('/api/admin/audit-log', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const userId = req.query.userId ? parseInt(req.query.userId) : null;

        const auditLog = await getAuditLog(limit, offset, userId);
        
        res.json({
            success: true,
            data: auditLog,
            pagination: {
                limit,
                offset,
                total: auditLog.length
            }
        });

    } catch (error) {
        console.error('Get audit log error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب سجل النظام'
        });
    }
});

// إحصائيات النظام
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = await getSystemStats();
        
        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب الإحصائيات'
        });
    }
});

// تصدير البيانات
app.get('/api/admin/export', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.query.userId ? parseInt(req.query.userId) : null;
        const dateFrom = req.query.dateFrom || null;
        const dateTo = req.query.dateTo || null;

        const data = await exportData(userId, dateFrom, dateTo);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=exper-cash-export.json');
        
        res.json({
            success: true,
            exportDate: new Date().toISOString(),
            filters: { userId, dateFrom, dateTo },
            data: data
        });

    } catch (error) {
        console.error('Export data error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تصدير البيانات'
        });
    }
});

// معلومات صحة النظام
app.get('/api/health', async (req, res) => {
    try {
        const dbHealth = await healthCheck();
        const stats = await getSystemStats();

        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            uptime: process.uptime(),
            database: dbHealth,
            stats: {
                users: stats.users.total,
                operations: stats.operations.total
            },
            environment: process.env.NODE_ENV || 'development'
        });

    } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: error.message
        });
    }
});

// === ERROR HANDLING ===

// معالجة الأخطاء العامة
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    
    // أخطاء JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'رمز الجلسة غير صحيح'
        });
    }
    
    // أخطاء انتهاء الجلسة
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى'
        });
    }

    // أخطاء قاعدة البيانات
    if (err.code === '23505') {
        return res.status(400).json({
            success: false,
            message: 'البيانات موجودة مسبقاً'
        });
    }

    if (err.code === '23503') {
        return res.status(400).json({
            success: false,
            message: 'مرجع غير صحيح'
        });
    }

    // خطأ عام
    res.status(500).json({
        success: false,
        message: 'خطأ في الخادم'
    });
});

// معالجة الطرق غير الموجودة
app.use('*', (req, res) => {
    // إذا كان طلب API
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint غير موجود'
        });
    }
    
    // إذا كان طلب صفحة
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

// === SERVER STARTUP ===

// معالجة إيقاف الخادم بسلاسة
process.on('SIGTERM', async () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    
    try {
        // إغلاق قاعدة البيانات
        const { closeDatabase } = require('./database');
        await closeDatabase();
        
        console.log('✅ Database connections closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    console.log('🔄 SIGINT received, shutting down gracefully...');
    
    try {
        const { closeDatabase } = require('./database');
        await closeDatabase();
        
        console.log('✅ Database connections closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// بدء الخادم
async function startServer() {
    try {
        // تهيئة قاعدة البيانات
        console.log('🔄 Initializing database...');
        await initializeDatabase();
        
        // بدء الخادم
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`
╔═══════════════════════════════════════════════════════════╗
║              🏛️ EXPER CASH SERVICES SARL                  ║
║                 Financial Management System               ║
╠═══════════════════════════════════════════════════════════╣
║ 🚀 Server Status: RUNNING                                ║
║ 📍 Port: ${PORT.toString().padEnd(47)}║
║ 🌐 Environment: ${(process.env.NODE_ENV || 'development').padEnd(39)}║
║ 🔗 Local URL: http://localhost:${PORT.toString().padEnd(31)}║
║ 🔗 Network URL: http://0.0.0.0:${PORT.toString().padEnd(31)}║
║ 📊 Database: PostgreSQL Connected                        ║
║ 🔒 Security: JWT + bcrypt + Rate Limiting               ║
║ 🌍 Languages: Arabic + French                            ║
╠═══════════════════════════════════════════════════════════╣
║ 👨‍💼 Admin Login: admin / admin123                        ║
║ 👤 User Login: user1 / user123                          ║
╚═══════════════════════════════════════════════════════════╝
            `);

            // في بيئة الإنتاج، اطبع المعلومات المفيدة
            if (process.env.NODE_ENV === 'production') {
                console.log(`
🌐 Production URLs:
   Main: https://your-app.railway.app
   Health: https://your-app.railway.app/api/health
   Admin: https://your-app.railway.app/admin-panel.html
                `);
            }
        });

        // معالجة أخطاء الخادم
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use`);
                process.exit(1);
            } else {
                console.error('❌ Server error:', error);
                process.exit(1);
            }
        });

        return server;

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// تشغيل الخادم
if (require.main === module) {
    startServer();
}

module.exports = app;
