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
                message: 'اسم ال
