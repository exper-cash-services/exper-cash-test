// أضف هذا في app.js
app.get('/admin', (req, res) => {
  res.send(`
    <h1>🛠️ لوحة الإدارة - EXPER CASH SERVICES</h1>
    <a href="/">← العودة للرئيسية</a>
  `);
});

app.get('/entry', (req, res) => {
  res.send(`
    <h1>📝 إدخال البيانات - EXPER CASH SERVICES</h1>
    <a href="/">← العودة للرئيسية</a>
  `);
});
