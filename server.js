const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 5000;

// Set Cache-Control headers to prevent caching during development
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Serve config.js with environment variables injected
app.get('/config.js', (req, res) => {
    const config = `
// Configuration file for Cautio application
window.CAUTIO_CONFIG = {
    supabase: {
        url: '${process.env.SUPABASE_URL || 'https://jcmjazindwonrplvjwxl.supabase.co'}',
        key: '${process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWphemluZHdvbnJwbHZqd3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMDEyNjMsImV4cCI6MjA3Mjg3NzI2M30.1B6sKnzrzdNFhvQUXVnRzzQnItFMaIFL0Y9WK_Gie9g'}'
    },
    app: {
        name: 'Cautio',
        version: '1.0.0'
    }
};`;
    
    res.setHeader('Content-Type', 'application/javascript');
    res.send(config);
});

// Serve static files from the current directory
app.use(express.static('.'));

// Handle client-side routing for single page application
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Cautio server is running on http://0.0.0.0:${PORT}`);
    console.log(`📱 Dashboard available at: http://0.0.0.0:${PORT}`);
    console.log(`📦 Stock management at: http://0.0.0.0:${PORT}/stock.html`);
    console.log(`📋 Inventory management at: http://0.0.0.0:${PORT}/inventory.html`);
});
