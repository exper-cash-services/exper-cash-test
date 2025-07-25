const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات الأمان والضغط
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "data:"]
        }
    }
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// خدمة الملفات الثابتة
app.use(express.static(path.join(__dirname, '.')));

// قاعدة بيانات مؤقتة في الذاكرة (ستحتاج لقاعدة بيانات حقيقية لاحقاً)
let users = [
    {
        id: 1,
        username: 'admin',
        password: '$2a$10$XVl1.T3Xe7CJhX3KGh0.0uK3V1QX1QX1QX1QX1QX1QX1QX1QX1QX1Q', // admin123
        name: 'المدير الرئيسي',
        role: 'admin',
        active: true
    },
    {
        id: 2,
        username: 'user1',
        password: '$2a$10$XVl1.T3Xe7CJhX3KGh0.0uK3V1QX1QX1QX1QX1QX1QX1QX1QX1QX1Q', // user123
        name: 'مستخدم تجريبي',
        role: 'user',
        active: true
    }
];

let operations = [];
let systemSettings = {
    companyName: 'EXPER CASH SERVICES SARL',
    companyId: 'DEMO-5447',
    currency: 'MAD',
    timezone: 'Africa/Casablanca'
};

// JWT Secret (في البيئة الحقيقية، ضعه في متغيرات البيئة)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware للتحقق من الهوية
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

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

// API Routes

// تسجيل الدخول
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // البحث عن المستخدم
        const user = users.find(u => u.username === username && u.active);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
            });
        }

        // تحقق من كلمة المرور (مؤقت - سيتم استبداله بـ bcrypt)
        const validPassword = password === 'admin123' || password === 'user123';
        
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
            });
        }

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

// حفظ العمليات
app.post('/api/operations', authenticateToken, (req, res) => {
    try {
        const operation = {
            id: Date.now(),
            userId: req.user.id,
            ...req.body,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // فحص تكرار التاريخ للمستخدم نفسه
        const existingIndex = operations.findIndex(
            op => op.date === operation.date && op.userId === req.user.id
        );

        if (existingIndex !== -1) {
            operations[existingIndex] = { ...operations[existingIndex], ...operation };
        } else {
            operations.push(operation);
        }

        res.json({
            success: true,
            data: operation,
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
app.get('/api/operations', authenticateToken, (req, res) => {
    try {
        const userOperations = operations.filter(op => op.userId === req.user.id);
        
        res.json({
            success: true,
            data: userOperations
        });

    } catch (error) {
        console.error('Get operations error:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في جلب البيانات'
        });
    }
});

// إدارة المستخدمين (للمدير فقط)
app.get('/api/admin/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'غير مخول للوصول'
        });
    }

    const safeUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        active: user.active
    }));

    res.json({
        success: true,
        data: safeUsers
    });
});

// إعدادات النظام
app.get('/api/settings', authenticateToken, (req, res) => {
    res.json({
        success: true,
        data: systemSettings
    });
});

app.post('/api/settings', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'غير مخول للوصول'
        });
    }

    systemSettings = { ...systemSettings, ...req.body };

    res.json({
        success: true,
        data: systemSettings,
        message: 'تم حفظ الإعدادات بنجاح'
    });
});

// معلومات صحة النظام
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime()
    });
});

// معالجة الأخطاء العامة
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'خطأ في الخادم'
    });
});

// معالجة الطرق غير الموجودة
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'الصفحة غير موجودة'
    });
});

// بدء الخادم
app.listen(PORT, () => {
    console.log(`
🚀 EXPER CASH SERVICES Server Started Successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Local:    http://localhost:${PORT}
🌐 Network:  http://0.0.0.0:${PORT}
📊 Environment: ${process.env.NODE_ENV || 'development'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
});
