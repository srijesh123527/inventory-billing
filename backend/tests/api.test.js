// ============================================================================
// api.test.js — End-to-End API Integration & Validation Test Suite
// ============================================================================

const http = require('http');
const app = require('../app');
const db = require('../db');

let server;
let port;
let authToken = '';

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port: port,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed, raw: data });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Starting InvFlow Comprehensive Automated Test Suite...\n');
    let passed = 0;
    let failed = 0;

    function assert(name, condition, extra = '') {
        if (condition) {
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${name} ${extra ? `(${extra})` : ''}`);
            failed++;
        }
    }

    try {
        // Start ephemeral test server
        await new Promise((resolve) => {
            server = app.listen(0, '127.0.0.1', () => {
                port = server.address().port;
                console.log(`🚀 Test server listening on port ${port}\n`);
                resolve();
            });
        });

        // 1. Test Auth: Login Success
        console.log('--- Testing Authentication ---');
        const loginRes = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
        assert('Login with default credentials returns 200 and JWT token', loginRes.status === 200 && loginRes.body.success && loginRes.body.data && loginRes.body.data.token);
        if (loginRes.body && loginRes.body.data) {
            authToken = loginRes.body.data.token;
        }

        // 2. Test Auth: Invalid Password
        const invalidLogin = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrongpassword' });
        assert('Login with invalid credentials returns 401', invalidLogin.status === 401 && !invalidLogin.body.success);

        // 3. Test Auth Me
        const meRes = await request('GET', '/api/auth/me', null, authToken);
        assert('Verify JWT token via /api/auth/me returns 200', meRes.status === 200 && meRes.body.success && meRes.body.data.user.username === 'admin');

        // 4. Test Product Management (Requirement #20 fix verification)
        console.log('\n--- Testing Product Management & Persistence ---');
        const newProduct = {
            name: 'Test Gaming Mouse 16000 DPI',
            category: 'Peripherals',
            price: 3499.50,
            quantity: 50,
            supplier: 'ElectroTech Global Ltd'
        };

        const createProdRes = await request('POST', '/api/products', newProduct, authToken);
        assert('POST /api/products saves all fields and returns new ID', createProdRes.status === 201 && createProdRes.body.success && createProdRes.body.data.id > 0);
        const createdProdId = createProdRes.body.data.id;

        // Verify product in database
        const getProdRes = await request('GET', `/api/products/${createdProdId}`);
        assert('GET /api/products/:id retrieves exact entered values', 
            getProdRes.status === 200 && 
            getProdRes.body.data.name === newProduct.name &&
            Number(getProdRes.body.data.price) === newProduct.price &&
            Number(getProdRes.body.data.quantity) === newProduct.quantity &&
            getProdRes.body.data.supplier === newProduct.supplier
        );

        // Update product
        const updateProdRes = await request('PUT', `/api/products/${createdProdId}`, {
            name: 'Test Gaming Mouse 16000 DPI (Updated)',
            category: 'Peripherals',
            price: 3299.00,
            quantity: 45,
            supplier: 'ElectroTech Global Ltd'
        });
        assert('PUT /api/products/:id updates product data', updateProdRes.status === 200 && updateProdRes.body.success);

        // 5. Test Supplier Management
        console.log('\n--- Testing Supplier Management ---');
        const newSupplier = {
            name: 'Sunil Rao',
            company: 'Rao Hardware Hub',
            phone: '+91 9988776655',
            email: 'sales@raohardware.com',
            address: '45 MG Road, Bangalore'
        };
        const createSuppRes = await request('POST', '/api/suppliers', newSupplier);
        assert('POST /api/suppliers adds supplier', createSuppRes.status === 201 && createSuppRes.body.success && createSuppRes.body.data.id > 0);
        const supplierId = createSuppRes.body.data.id;

        const getSuppliersRes = await request('GET', '/api/suppliers');
        assert('GET /api/suppliers returns list', getSuppliersRes.status === 200 && Array.isArray(getSuppliersRes.body.data));

        // 6. Test POS Checkout, Atomic Transaction & Stock Deduction
        console.log('\n--- Testing POS Billing, GST, & Real-Time Stock Deduction ---');
        const initialQty = 45;
        const purchaseQty = 5;

        const checkoutRes = await request('POST', '/api/billing', {
            customer_name: 'Dr. Anita Roy',
            items: [
                { id: createdProdId, name: 'Test Gaming Mouse 16000 DPI (Updated)', price: 3299.00, quantity: purchaseQty }
            ],
            gst_rate: 18,
            discount: 0
        });

        assert('POST /api/billing generates invoice with correct calculations', 
            checkoutRes.status === 201 && 
            checkoutRes.body.success && 
            checkoutRes.body.data.invoice_number.startsWith('INV-') &&
            checkoutRes.body.data.subtotal === (3299.00 * purchaseQty) &&
            checkoutRes.body.data.gst === ((3299.00 * purchaseQty) * 0.18) &&
            checkoutRes.body.data.total === ((3299.00 * purchaseQty) * 1.18)
        );

        // Verify stock was deducted by exactly purchaseQty
        const postCheckoutProd = await request('GET', `/api/products/${createdProdId}`);
        assert('Stock deduction: product quantity decreased by purchased quantity', 
            Number(postCheckoutProd.body.data.quantity) === (initialQty - purchaseQty)
        );

        // 7. Test Dashboard & Reports
        console.log('\n--- Testing Dashboard Metrics & Reports ---');
        const dashRes = await request('GET', '/api/dashboard');
        assert('GET /api/dashboard returns actual database metrics', 
            dashRes.status === 200 && 
            dashRes.body.success && 
            dashRes.body.data.products > 0 &&
            dashRes.body.data.total_invoices > 0 &&
            dashRes.body.data.total_revenue > 0
        );

        const reportsRes = await request('GET', '/api/reports/sales');
        assert('GET /api/reports/sales returns transactions list', 
            reportsRes.status === 200 && 
            reportsRes.body.success && 
            reportsRes.body.data.length > 0
        );

        // Clean up test items
        await request('DELETE', `/api/products/${createdProdId}`);
        await request('DELETE', `/api/suppliers/${supplierId}`);

        console.log('\n====================================================');
        console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
        console.log('====================================================\n');

    } catch (err) {
        console.error('Fatal Test Suite Error:', err);
    } finally {
        if (server) {
            server.close();
        }
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();
