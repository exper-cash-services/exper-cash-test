const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <h1 style="text-align: center; color: green; padding: 100px;">
      🎉 EXPER CASH SERVICES يعمل! 
    </h1>
    <p style="text-align: center;">Port: ${port}</p>
  `);
});

app.listen(port, () => {
  console.log('Server running on port', port);
});
