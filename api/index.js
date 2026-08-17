// ============================================================================
// api/index.js — Vercel Serverless Handler
// ============================================================================

const app = require('../backend/app');

// Export Express app for Vercel Serverless Function runtime
module.exports = app;
