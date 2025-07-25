const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 EXPER CASH starting...');
console.log('Port:', PORT);

app.get('/', (req, res) => {
  console.log('Homepage requested');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>EXPER CASH SERVICES</title>
        <style>
            body {
                font-family: Arial;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                text-align: center;
                padding: 50px;
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
                max-width: 500px;
            }
            h1 { font-size: 2.5em; margin-bottom: 20px; }
            .success {
                background: rgba(40,167,69,0.3);
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🏦 EXPER CASH SERVICES</h1>
            <div class="success">
                <h2>✅ يعمل بنجاح!</h2>
                <p>Port: ${PORT}</p>
                <p>Time: ${new Date().toLocaleString('ar-SA')}</p>
            </div>
        </div>
    </body>
    </html>
  `);
});

app.get('/test', (req, res) => {
  res.json({
    message: 'EXPER CASH SERVICES يعمل!',
    success: true,
    port: PORT,
    time: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`✅ EXPER CASH Server started on port ${PORT}`);
  console.log(`🌐 Ready to serve requests!`);
});
