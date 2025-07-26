const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// إعداد اتصال قاعدة البيانات
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// اختبار الاتصال
pool.on('connect', () => {
    console.log('🔗 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Database connection error:', err);
});

// إنشاء الجداول والبيانات الأولية
async function initializeDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('🏗️ Initializing database...');

        // إنشاء جدول المستخدمين
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(100) NOT NULL,
                role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user', 'viewer')),
                active BOOLEAN DEFAULT true,
                last_login TIMESTAMP,
                login_attempts INTEGER DEFAULT 0,
                locked_until TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // إنشاء فهرس للمستخدمين
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
        `);

        // إنشاء جدول العمليات المالية
        await client.query(`
            CREATE TABLE IF NOT EXISTS operations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                operation_date DATE NOT NULL,
                balances JSONB NOT NULL DEFAULT '{}',
                operations_data JSONB NOT NULL DEFAULT '{}',
                totals JSONB NOT NULL DEFAULT '{}',
                metadata JSONB DEFAULT '{}',
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, operation_date)
            )
        `);

        // إنشاء فهارس للعمليات
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_operations_user_date ON operations(user_id, operation_date);
            CREATE INDEX IF NOT EXISTS idx_operations_date ON operations(operation_date);
            CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
        `);

        // إنشاء جدول إعدادات النظام
        await client.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id SERIAL PRIMARY KEY,
                key VARCHAR(100) UNIQUE NOT NULL,
                value JSONB NOT NULL,
                description TEXT,
                updated_by INTEGER REFERENCES users(id),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // إنشاء جدول الأقسام (للإدارة)
        await client.query(`
            CREATE TABLE IF NOT EXISTS sections (
                id SERIAL PRIMARY KEY,
                section_key VARCHAR(50) NOT NULL,
                name_ar VARCHAR(100) NOT NULL,
                name_fr VARCHAR(100) NOT NULL,
                operation_type VARCHAR(10) CHECK (operation_type IN ('credit', 'debit')),
                icon VARCHAR(50),
                notes TEXT,
                active BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // إنشاء جدول سجل النظام (Audit Log)
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                action VARCHAR(100) NOT NULL,
                table_name VARCHAR(50),
                record_id INTEGER,
                old_values JSONB,
                new_values JSONB,
                ip_address INET,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // إنشاء فهرس لسجل النظام
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_log_date ON audit_log(created_at);
            CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
        `);

        // إدراج البيانات الأولية
        await insertDefaultUsers(client);
        await insertDefaultSettings(client);
        await insertDefaultSections(client);

        console.log('✅ Database initialization completed successfully');

    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    } finally {
        client.release();
    }
}

// إدراج المستخدمين الافتراضيين
async function insertDefaultUsers(client) {
    try {
        const users = [
            {
                username: 'admin',
                password: await bcrypt.hash('admin123', 12),
                name: 'المدير الرئيسي',
                role: 'admin'
            },
            {
                username: 'user1',
                password: await bcrypt.hash('user123', 12),
                name: 'مستخدم تجريبي',
                role: 'user'
            },
            {
                username: 'manager1',
                password: await bcrypt.hash('manager123', 12),
                name: 'مدير الفرع',
                role: 'manager'
            }
        ];

        for (const user of users) {
            await client.query(`
                INSERT INTO users (username, password, name, role)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (username) DO NOTHING
            `, [user.username, user.password, user.name, user.role]);
        }

        console.log('✅ Default users inserted');
    } catch (error) {
        console.error('❌ Error inserting default users:', error);
    }
}

// إدراج الإعدادات الافتراضية
async function insertDefaultSettings(client) {
    try {
        const settings = [
            {
                key: 'company_name',
                value: JSON.stringify('EXPER CASH SERVICES SARL'),
                description: 'اسم الشركة'
            },
            {
                key: 'company_id',
                value: JSON.stringify('DEMO-5447'),
                description: 'معرف الشركة'
            },
            {
                key: 'currency',
                value: JSON.stringify('MAD'),
                description: 'العملة الافتراضية'
            },
            {
                key: 'timezone',
                value: JSON.stringify('Africa/Casablanca'),
                description: 'المنطقة الزمنية'
            },
            {
                key: 'max_login_attempts',
                value: JSON.stringify(5),
                description: 'عدد محاولات تسجيل الدخول المسموحة'
            },
            {
                key: 'session_timeout',
                value: JSON.stringify(24),
                description: 'مدة انتهاء الجلسة بالساعات'
            }
        ];

        for (const setting of settings) {
            await client.query(`
                INSERT INTO system_settings (key, value, description)
                VALUES ($1, $2, $3)
                ON CONFLICT (key) DO NOTHING
            `, [setting.key, setting.value, setting.description]);
        }

        console.log('✅ Default settings inserted');
    } catch (error) {
        console.error('❌ Error inserting default settings:', error);
    }
}

// إدراج الأقسام الافتراضية
async function insertDefaultSections(client) {
    try {
        const sections = [
            // أقسام الصندوق
            { section_key: 'caisse', name_ar: 'النقد المضاف للصندوق', name_fr: 'Espèces Ajoutées', operation_type: 'credit', icon: '💰', sort_order: 1 },
            { section_key: 'caisse', name_ar: 'البنك', name_fr: 'Banque', operation_type: 'credit', icon: '🏦', sort_order: 2 },
            { section_key: 'caisse', name_ar: 'النقد المسحوب', name_fr: 'Espèces Retirées', operation_type: 'debit', icon: '💸', sort_order: 3 },
            
            // أقسام فنديكس
            { section_key: 'fundex', name_ar: 'استقبال ويسترن يونيون', name_fr: 'Western Union Réception', operation_type: 'credit', icon: 'WU', sort_order: 1 },
            { section_key: 'fundex', name_ar: 'موني جرام', name_fr: 'MoneyGram', operation_type: 'credit', icon: 'MG', sort_order: 2 },
            { section_key: 'fundex', name_ar: 'إرسال ويسترن يونيون', name_fr: 'Western Union Envois', operation_type: 'debit', icon: 'WU', sort_order: 3 },
            
            // أقسام ضمان باي
            { section_key: 'damane', name_ar: 'سحب عميل', name_fr: 'Retrait Client', operation_type: 'credit', icon: '👤', sort_order: 1 },
            { section_key: 'damane', name_ar: 'ريا', name_fr: 'RIA', operation_type: 'credit', icon: 'RIA', sort_order: 2 },
            { section_key: 'damane', name_ar: 'جميع الفواتير', name_fr: 'Toutes Factures', operation_type: 'debit', icon: '🧾', sort_order: 3 }
        ];

        for (const section of sections) {
            await client.query(`
                INSERT INTO sections (section_key, name_ar, name_fr, operation_type, icon, sort_order)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT DO NOTHING
            `, [section.section_key, section.name_ar, section.name_fr, section.operation_type, section.icon, section.sort_order]);
        }

        console.log('✅ Default sections inserted');
    } catch (error) {
        console.error('❌ Error inserting default sections:', error);
    }
}

// دوال المساعدة لقاعدة البيانات

// جلب مستخدم بواسطة اسم المستخدم
async function getUserByUsername(username) {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND active = true',
            [username]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

// حفظ عملية مالية
async function saveOperation(userId, operationData) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { date, balances, operations, totals, metadata } = operationData;

        // فحص وجود عملية بنفس التاريخ
        const existingOperation = await client.query(
            'SELECT id FROM operations WHERE user_id = $1 AND operation_date = $2',
            [userId, date]
        );

        let result;
        if (existingOperation.rows.length > 0) {
            // تحديث العملية الموجودة
            result = await client.query(`
                UPDATE operations 
                SET balances = $1, operations_data = $2, totals = $3, 
                    metadata = $4, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $5 AND operation_date = $6
                RETURNING id
            `, [
                JSON.stringify(balances),
                JSON.stringify(operations),
                JSON.stringify(totals),
                JSON.stringify(metadata),
                userId,
                date
            ]);
        } else {
            // إدراج عملية جديدة
            result = await client.query(`
                INSERT INTO operations 
                (user_id, operation_date, balances, operations_data, totals, metadata)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
            `, [
                userId,
                date,
                JSON.stringify(balances),
                JSON.stringify(operations),
                JSON.stringify(totals),
                JSON.stringify(metadata)
            ]);
        }

        // تسجيل في سجل النظام
        await logAction(client, userId, 'SAVE_OPERATION', 'operations', result.rows[0].id, null, operationData);

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// جلب عمليات المستخدم
async function getUserOperations(userId, limit = 100, offset = 0) {
    try {
        const result = await pool.query(`
            SELECT id, operation_date, balances, operations_data, totals, metadata, created_at, updated_at
            FROM operations 
            WHERE user_id = $1 AND status = 'active'
            ORDER BY operation_date DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        return result.rows;
    } catch (error) {
        console.error('Error getting user operations:', error);
        return [];
    }
}

// جلب إعدادات النظام
async function getSystemSettings() {
    try {
        const result = await pool.query('SELECT key, value FROM system_settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = JSON.parse(row.value);
        });
        return settings;
    } catch (error) {
        console.error('Error getting system settings:', error);
        return {};
    }
}

// تحديث إعدادات النظام
async function updateSystemSetting(key, value, userId = null) {
    try {
        await pool.query(`
            INSERT INTO system_settings (key, value, updated_by, updated_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (key) 
            DO UPDATE SET value = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
        `, [key, JSON.stringify(value), userId]);

        return true;
    } catch (error) {
        console.error('Error updating system setting:', error);
        return false;
    }
}

// جلب الأقسام
async function getSections() {
    try {
        const result = await pool.query(`
            SELECT * FROM sections 
            WHERE active = true 
            ORDER BY section_key, sort_order
        `);

        const sections = {};
        result.rows.forEach(row => {
            if (!sections[row.section_key]) {
                sections[row.section_key] = [];
            }
            sections[row.section_key].push({
                id: row.id,
                nameAr: row.name_ar,
                nameFr: row.name_fr,
                type: row.operation_type,
                icon: row.icon,
                notes: row.notes
            });
        });

        return sections;
    } catch (error) {
        console.error('Error getting sections:', error);
        return {};
    }
}

// إضافة قسم جديد
async function addSection(sectionData, userId = null) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(`
            INSERT INTO sections (section_key, name_ar, name_fr, operation_type, icon, notes, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, 
                    (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM sections WHERE section_key = $1))
            RETURNING id
        `, [
            sectionData.sectionKey,
            sectionData.nameAr,
            sectionData.nameFr,
            sectionData.type,
            sectionData.icon || '📋',
            sectionData.notes || ''
        ]);

        // تسجيل في سجل النظام
        await logAction(client, userId, 'ADD_SECTION', 'sections', result.rows[0].id, null, sectionData);

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// حذف قسم
async function deleteSection(sectionId, userId = null) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // جلب بيانات القسم قبل الحذف للسجل
        const sectionData = await client.query('SELECT * FROM sections WHERE id = $1', [sectionId]);

        // حذف منطقي (تعطيل)
        await client.query('UPDATE sections SET active = false WHERE id = $1', [sectionId]);

        // تسجيل في سجل النظام
        await logAction(client, userId, 'DELETE_SECTION', 'sections', sectionId, sectionData.rows[0], null);

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// جلب جميع المستخدمين (للمدير)
async function getAllUsers() {
    try {
        const result = await pool.query(`
            SELECT id, username, name, role, active, last_login, created_at
            FROM users 
            ORDER BY created_at DESC
        `);
        return result.rows;
    } catch (error) {
        console.error('Error getting all users:', error);
        return [];
    }
}

// إضافة مستخدم جديد
async function addUser(userData, createdBy = null) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const hashedPassword = await bcrypt.hash(userData.password, 12);

        const result = await client.query(`
            INSERT INTO users (username, password, name, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, name, role
        `, [userData.username, hashedPassword, userData.name, userData.role]);

        // تسجيل في سجل النظام
        await logAction(client, createdBy, 'ADD_USER', 'users', result.rows[0].id, null, {
            username: userData.username,
            name: userData.name,
            role: userData.role
        });

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// تحديث حالة المستخدم
async function updateUserStatus(userId, active, updatedBy = null) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const oldData = await client.query('SELECT active FROM users WHERE id = $1', [userId]);
        
        await client.query('UPDATE users SET active = $1 WHERE id = $2', [active, userId]);

        // تسجيل في سجل النظام
        await logAction(client, updatedBy, 'UPDATE_USER_STATUS', 'users', userId, 
            { active: oldData.rows[0].active }, 
            { active: active }
        );

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// تحديث آخر تسجيل دخول
async function updateLastLogin(userId) {
    try {
        await pool.query(`
            UPDATE users 
            SET last_login = CURRENT_TIMESTAMP, login_attempts = 0, locked_until = NULL
            WHERE id = $1
        `, [userId]);
        return true;
    } catch (error) {
        console.error('Error updating last login:', error);
        return false;
    }
}

// زيادة محاولات تسجيل الدخول الفاشلة
async function incrementLoginAttempts(username) {
    try {
        const result = await pool.query(`
            UPDATE users 
            SET login_attempts = login_attempts + 1,
                locked_until = CASE 
                    WHEN login_attempts >= 4 THEN CURRENT_TIMESTAMP + INTERVAL '30 minutes'
                    ELSE locked_until
                END
            WHERE username = $1
            RETURNING login_attempts, locked_until
        `, [username]);
        
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error incrementing login attempts:', error);
        return null;
    }
}

// التحقق من قفل المستخدم
async function isUserLocked(username) {
    try {
        const result = await pool.query(`
            SELECT locked_until FROM users 
            WHERE username = $1 AND locked_until > CURRENT_TIMESTAMP
        `, [username]);
        
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking user lock:', error);
        return false;
    }
}

// تسجيل الأحداث في سجل النظام
async function logAction(client, userId, action, tableName, recordId, oldValues, newValues, ipAddress = null, userAgent = null) {
    try {
        await client.query(`
            INSERT INTO audit_log 
            (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            userId,
            action,
            tableName,
            recordId,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            ipAddress,
            userAgent
        ]);
    } catch (error) {
        console.error('Error logging action:', error);
        // لا نرمي خطأ هنا لتجنب فشل العملية الأساسية
    }
}

// جلب سجل النظام (للمدير)
async function getAuditLog(limit = 100, offset = 0, userId = null) {
    try {
        let query = `
            SELECT al.*, u.username, u.name 
            FROM audit_log al
            LEFT JOIN users u ON al.user_id = u.id
        `;
        let params = [];

        if (userId) {
            query += ' WHERE al.user_id = $1';
            params.push(userId);
        }

        query += ' ORDER BY al.created_at DESC LIMIT  + (params.length + 1) + ' OFFSET  + (params.length + 2);
        params.push(limit, offset);

        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Error getting audit log:', error);
        return [];
    }
}

// إحصائيات النظام
async function getSystemStats() {
    try {
        const stats = {};

        // عدد المستخدمين
        const usersResult = await pool.query('SELECT COUNT(*) as total, role FROM users WHERE active = true GROUP BY role');
        stats.users = {};
        usersResult.rows.forEach(row => {
            stats.users[row.role] = parseInt(row.total);
        });
        stats.users.total = Object.values(stats.users).reduce((sum, count) => sum + count, 0);

        // عدد العمليات
        const operationsResult = await pool.query(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN operation_date >= CURRENT_DATE THEN 1 END) as today,
                   COUNT(CASE WHEN operation_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week,
                   COUNT(CASE WHEN operation_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as month
            FROM operations WHERE status = 'active'
        `);
        stats.operations = operationsResult.rows[0];

        // إحصائيات قاعدة البيانات
        const dbResult = await pool.query('SELECT version() as version');
        stats.database = {
            version: dbResult.rows[0].version,
            connected: true
        };

        return stats;
    } catch (error) {
        console.error('Error getting system stats:', error);
        return {
            users: { total: 0 },
            operations: { total: 0, today: 0, week: 0, month: 0 },
            database: { connected: false }
        };
    }
}

// تنظيف قاعدة البيانات (مهمة دورية)
async function cleanupDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // حذف سجلات النظام القديمة (أكثر من سنة)
        await client.query(`
            DELETE FROM audit_log 
            WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 year'
        `);

        // أرشفة العمليات القديمة (أكثر من سنتين)
        await client.query(`
            UPDATE operations 
            SET status = 'archived' 
            WHERE operation_date < CURRENT_DATE - INTERVAL '2 years' 
            AND status = 'active'
        `);

        await client.query('COMMIT');
        console.log('✅ Database cleanup completed');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Database cleanup failed:', error);
    } finally {
        client.release();
    }
}

// تصدير البيانات
async function exportData(userId, dateFrom, dateTo) {
    try {
        const operations = await pool.query(`
            SELECT o.*, u.username, u.name as user_name
            FROM operations o
            JOIN users u ON o.user_id = u.id
            WHERE ($1::INTEGER IS NULL OR o.user_id = $1)
            AND ($2::DATE IS NULL OR o.operation_date >= $2)
            AND ($3::DATE IS NULL OR o.operation_date <= $3)
            AND o.status = 'active'
            ORDER BY o.operation_date DESC
        `, [userId, dateFrom, dateTo]);

        return operations.rows;
    } catch (error) {
        console.error('Error exporting data:', error);
        return [];
    }
}

// إغلاق اتصال قاعدة البيانات
async function closeDatabase() {
    try {
        await pool.end();
        console.log('🔒 Database connection closed');
    } catch (error) {
        console.error('❌ Error closing database:', error);
    }
}

// صحة قاعدة البيانات
async function healthCheck() {
    try {
        const result = await pool.query('SELECT NOW() as current_time');
        return {
            status: 'healthy',
            timestamp: result.rows[0].current_time,
            connected: true
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            connected: false
        };
    }
}

// تصدير جميع الدوال
module.exports = {
    pool,
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
    cleanupDatabase,
    exportData,
    closeDatabase,
    healthCheck
};
