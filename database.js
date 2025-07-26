const { Pool } = require('pg');

// إعداد اتصال قاعدة البيانات
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// إنشاء الجداول
async function initializeDatabase() {
  try {
    // جدول المستخدمين
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // جدول العمليات المالية
    await pool.query(`
      CREATE TABLE IF NOT EXISTS operations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        operation_date DATE NOT NULL,
        balances JSONB,
        operations_data JSONB,
        totals JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // جدول إعدادات النظام
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // إدراج المستخدمين الافتراضيين
    await insertDefaultUsers();
    await insertDefaultSettings();

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// إدراج المستخدمين الافتراضيين
async function insertDefaultUsers() {
  const bcrypt = require('bcryptjs');
  
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
    }
  ];

  for (const user of users) {
    try {
      await pool.query(`
        INSERT INTO users (username, password, name, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username) DO NOTHING
      `, [user.username, user.password, user.name, user.role]);
    } catch (error) {
      console.log(`User ${user.username} already exists`);
    }
  }
}

// إدراج الإعدادات الافتراضية
async function insertDefaultSettings() {
  const settings = [
    { key: 'company_name', value: 'EXPER CASH SERVICES SARL' },
    { key: 'company_id', value: 'DEMO-5447' },
    { key: 'currency', value: 'MAD' },
    { key: 'timezone', value: 'Africa/Casablanca' }
  ];

  for (const setting of settings) {
    try {
      await pool.query(`
        INSERT INTO system_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO NOTHING
      `, [setting.key, JSON.stringify(setting.value)]);
    } catch (error) {
      console.log(`Setting ${setting.key} already exists`);
    }
  }
}

module.exports = {
  pool,
  initializeDatabase
};
