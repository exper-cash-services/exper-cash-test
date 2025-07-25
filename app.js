const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 EXPER CASH starting...');
console.log('Port:', PORT);

// الصفحة الرئيسية
app.get('/', (req, res) => {
  console.log('Homepage requested');
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>EXPER CASH SERVICES</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                text-align: center;
                padding: 20px;
                margin: 0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .container {
                background: rgba(255,255,255,0.1);
                padding: 50px;
                border-radius: 20px;
                max-width: 600px;
                width: 100%;
                backdrop-filter: blur(10px);
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            h1 { 
                font-size: 2.5em; 
                margin-bottom: 20px; 
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .success {
                background: rgba(40,167,69,0.3);
                padding: 20px;
                border-radius: 15px;
                margin: 20px 0;
                border: 2px solid rgba(40,167,69,0.5);
            }
            .buttons {
                margin-top: 30px;
                display: flex;
                gap: 15px;
                justify-content: center;
                flex-wrap: wrap;
            }
            .btn {
                display: inline-block;
                padding: 15px 25px;
                background: rgba(49,40,132,0.8);
                color: white;
                text-decoration: none;
                border-radius: 10px;
                transition: all 0.3s;
                font-weight: bold;
                border: 1px solid rgba(255,255,255,0.2);
            }
            .btn:hover {
                background: rgba(49,40,132,1);
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(0,0,0,0.3);
            }
            .btn.admin {
                background: rgba(255,193,7,0.8);
            }
            .btn.admin:hover {
                background: rgba(255,193,7,1);
            }
            .btn.entry {
                background: rgba(40,167,69,0.8);
            }
            .btn.entry:hover {
                background: rgba(40,167,69,1);
            }
            @media (max-width: 768px) {
                .container { padding: 30px 20px; }
                h1 { font-size: 2em; }
                .buttons { flex-direction: column; align-items: center; }
                .btn { width: 200px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🏦 EXPER CASH SERVICES</h1>
            <h2>نظام إدارة العمليات المالية المتقدم</h2>
            
            <div class="success">
                <h3>✅ يعمل بنجاح!</h3>
                <p>Port: ${PORT}</p>
                <p>Time: ${new Date().toLocaleString('ar-SA')}</p>
            </div>

            <div class="buttons">
                <a href="/admin" class="btn admin">🛠️ لوحة الإدارة</a>
                <a href="/entry" class="btn entry">📝 إدخال البيانات</a>
                <a href="/test" class="btn">🧪 اختبار النظام</a>
            </div>

            <p style="margin-top: 30px; opacity: 0.8; font-size: 0.9em;">
                EXPER CASH SERVICES SARL © 2024
            </p>
        </div>
    </body>
    </html>
  `);
});

// لوحة الإدارة
app.get('/admin', (req, res) => {
  console.log('Admin panel requested');
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>لوحة الإدارة - EXPER CASH SERVICES</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: 20px;
                margin: 0;
                min-height: 100vh;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
                background: rgba(255,255,255,0.1);
                padding: 40px;
                border-radius: 20px;
                backdrop-filter: blur(10px);
            }
            h1 {
                text-align: center;
                font-size: 2.5em;
                margin-bottom: 30px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .admin-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin: 30px 0;
            }
            .admin-card {
                background: rgba(255,255,255,0.1);
                padding: 25px;
                border-radius: 15px;
                text-align: center;
                border: 1px solid rgba(255,255,255,0.2);
                transition: transform 0.3s;
            }
            .admin-card:hover {
                transform: translateY(-5px);
            }
            .admin-icon {
                font-size: 3em;
                margin-bottom: 15px;
            }
            .btn {
                display: inline-block;
                padding: 12px 25px;
                background: rgba(49,40,132,0.8);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                margin: 10px;
                transition: all 0.3s;
            }
            .btn:hover {
                background: rgba(49,40,132,1);
                transform: translateY(-2px);
            }
            .btn.back {
                background: rgba(40,167,69,0.8);
            }
            .btn.back:hover {
                background: rgba(40,167,69,1);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🛠️ لوحة الإدارة</h1>
            <p style="text-align: center; font-size: 1.2em; opacity: 0.9;">
                مرحباً بك في لوحة إدارة نظام EXPER CASH SERVICES
            </p>

            <div class="admin-grid">
                <div class="admin-card">
                    <div class="admin-icon">👥</div>
                    <h3>إدارة المستخدمين</h3>
                    <p>إضافة وإدارة المستخدمين والصلاحيات</p>
                </div>

                <div class="admin-card">
                    <div class="admin-icon">📊</div>
                    <h3>التقارير</h3>
                    <p>عرض التقارير المالية والإحصائيات</p>
                </div>

                <div class="admin-card">
                    <div class="admin-icon">⚙️</div>
                    <h3>إعدادات النظام</h3>
                    <p>تكوين النظام والإعدادات العامة</p>
                </div>

                <div class="admin-card">
                    <div class="admin-icon">🔒</div>
                    <h3>الأمان</h3>
                    <p>إدارة الأمان وسجلات الدخول</p>
                </div>
            </div>

            <div style="text-align: center; margin-top: 40px;">
                <a href="/" class="btn back">← العودة للرئيسية</a>
                <a href="/entry" class="btn">📝 إدخال البيانات</a>
            </div>
        </div>
    </body>
    </html>
  `);
});

// صفحة إدخال البيانات
app.get('/entry', (req, res) => {
  console.log('Data entry page requested');
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>إدخال البيانات - EXPER CASH SERVICES</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: 20px;
                margin: 0;
                min-height: 100vh;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
                background: rgba(255,255,255,0.1);
                padding: 40px;
                border-radius: 20px;
                backdrop-filter: blur(10px);
            }
            h1 {
                text-align: center;
                font-size: 2.5em;
                margin-bottom: 30px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .entry-section {
                background: rgba(255,255,255,0.1);
                padding: 25px;
                border-radius: 15px;
                margin: 20px 0;
                border: 1px solid rgba(255,255,255,0.2);
            }
            .section-title {
                font-size: 1.5em;
                margin-bottom: 20px;
                color: #ffc107;
                text-align: center;
            }
            .info-text {
                text-align: center;
                margin: 20px 0;
                opacity: 0.9;
            }
            .btn {
                display: inline-block;
                padding: 12px 25px;
                background: rgba(49,40,132,0.8);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                margin: 10px;
                transition: all 0.3s;
            }
            .btn:hover {
                background: rgba(49,40,132,1);
                transform: translateY(-2px);
            }
            .btn.back {
                background: rgba(40,167,69,0.8);
            }
            .btn.back:hover {
                background: rgba(40,167,69,1);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📝 إدخال البيانات اليومية</h1>

            <div class="entry-section">
                <div class="section-title">💰 الصندوق (CAISSE)</div>
                <div class="info-text">إدارة عمليات الصندوق والنقد</div>
            </div>

            <div class="entry-section">
                <div class="section-title">🔄 فنديكس (FUNDEX)</div>
                <div class="info-text">عمليات ويسترن يونيون وموني جرام</div>
            </div>

            <div class="entry-section">
                <div class="section-title">💳 ضمان باي (DAMANE PAY)</div>
                <div class="info-text">خدمات الدفع الإلكتروني والفواتير</div>
            </div>

            <div style="text-align: center; margin-top: 40px;">
                <p style="opacity: 0.8; margin-bottom: 20px;">
                    🔧 النظام الكامل لإدخال البيانات قيد التطوير...
                </p>
                <a href="/" class="btn back">← العودة للرئيسية</a>
                <a href="/admin" class="btn">🛠️ لوحة الإدارة</a>
            </div>
        </div>
    </body>
    </html>
  `);
});

// صفحة اختبار النظام
app.get('/test', (req, res) => {
  res.json({
    message: 'EXPER CASH SERVICES يعمل بنجاح!',
    success: true,
    port: PORT,
    time: new Date().toISOString(),
    arabicTime: new Date().toLocaleString('ar-SA'),
    status: 'healthy',
    version: '1.0.0',
    features: {
      homepage: '✅ متوفرة',
      admin: '✅ متوفرة',
      dataEntry: '✅ متوفرة',
      api: '✅ متوفرة'
    }
  });
});

// بدء الخادم
app.listen(PORT, () => {
  console.log(`✅ EXPER CASH Server started on port ${PORT}`);
  console.log(`🌐 Ready to serve requests!`);
});
