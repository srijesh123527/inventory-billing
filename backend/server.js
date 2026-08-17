// ============================================================================
// server.js — Local Server Entry Point
// ============================================================================

require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`⚡ InvFlow Inventory & Billing Management System`);
    console.log(`🚀 Server running locally at: http://localhost:${PORT}`);
    console.log(`🔐 Default Credentials: admin / admin123`);
    console.log('====================================================');
});

module.exports = server;
