# InvFlow — Enterprise-Grade Inventory & Billing Management SaaS

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLite3](https://img.shields.io/badge/SQLite3-Embedded-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless%20Ready-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

A high-performance, secure, responsive, and database-agnostic **Inventory & Point of Sale (POS) Billing Management System**. Built with a unified backend adapter supporting **PostgreSQL** in production/cloud (e.g. Neon, Supabase, Render, AWS RDS) and **SQLite3** for zero-configuration local development. Fully optimized for serverless deployment on **Vercel**.

---

## 📸 System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      InvFlow Architecture                   │
└─────────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   [ Local Development ]                 [ Production Cloud ]
       Express Server                      Vercel Serverless
             │                                     │
             ▼                                     ▼
     SQLite Embedded DB                   PostgreSQL Cloud DB
 (backend/database.db)                   (Neon / Supabase / RDS)
```

---

## ⚡ Key Highlights & Capabilities

* **🔐 Enterprise Authentication**: Secure authentication powered by `bcryptjs` password hashing and signed JSON Web Tokens (`JWT`).
* **📦 Complete Product Lifecycle (CRUD)**: Dynamic catalog management, pricing tier controls, SKU search, and stock status tracking (`● In Stock`, `● Low Stock`, `● Out of Stock`).
* **🏭 Supplier Network Directory**: Vendor contact registry, linked lines, and corporate profile management.
* **📊 Stock Health Monitoring**: Live valuation calculation, low-stock notifications, restock threshold filtering, and inventory progress bars.
* **🧾 Point of Sale (POS) & Checkout**:
  * Real-time product search and cart management.
  * Configurable GST tax calculations and discount support.
  * **Atomic Database Transactions**: Automatically deducts inventory upon invoice creation to prevent overselling.
  * **PDF Invoice Generator**: 1-click professional PDF invoice downloads via `jsPDF` & `AutoTable`.
* **📈 Executive Analytics & Reports**:
  * Real-time metrics (Revenue, Product count, Low-stock alerts, Invoice volume).
  * Interactive Chart.js charts (Revenue trajectory & inventory distribution).
  * Date range filtering (`Today`, `Last 7 Days`, `Last 30 Days`, `All Time`).
  * 1-click **Export to CSV** for financial reporting.
* **🎨 Modern SaaS Design System**: Slate `#f8fafc` backdrop, Royal Blue `#2563eb` accents, responsive dark drawer sidebar, toast notifications, and modal dialogs.
* **☁️ Cloud & Vercel Serverless Ready**: Integrated `@vercel/node` serverless functions and automatic environment-driven database switching.

---

## 📁 Repository Directory Structure

```text
inventory-billing/
│
├── api/
│   └── index.js             # Vercel Serverless Function entry point
│
├── backend/
│   ├── app.js               # Express application, middleware & REST API routes
│   ├── db.js                # Universal DB adapter (PostgreSQL + SQLite) & migrations
│   ├── package.json         # Backend dependencies & scripts
│   ├── server.js            # Local HTTP server entry point
│   └── tests/
│       └── api.test.js      # Automated E2E test suite (12 test cases)
│
├── frontend/
│   ├── billing.html         # Point of Sale (POS), Cart & Invoice generation
│   ├── css/
│   │   └── style.css        # Unified SaaS design system & responsive layout
│   ├── index.html           # Executive analytics dashboard & charts
│   ├── js/
│   │   └── api.js           # Centralized API client, JWT session & UI helpers
│   ├── login.html           # Secure sign-in portal
│   ├── products.html        # Product catalog CRUD & SKU search
│   ├── reports.html         # Sales analytics, charts & CSV export
│   ├── stock.html           # Stock health monitoring & valuation
│   └── suppliers.html       # Supplier directory & vendor registry
│
├── .env.example             # Environment configuration template
├── .gitignore               # Excludes secrets, databases, and dependencies
├── package.json             # Root monorepo configuration
├── README.md                # Comprehensive documentation
└── vercel.json              # Vercel deployment & routing configuration
```

---

## 🚀 Quick Start (Local Development)

### 1. Clone the Repository
```bash
git clone https://github.com/srijesh123527/inventory-billing.git
cd inventory-billing
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Local Development Server
```bash
npm run dev
```

### 4. Access the Application
Open your browser and navigate to:
```text
http://localhost:3000
```

### 🔑 Default Credentials
* **Username**: `admin`
* **Password**: `admin123`
*(A 1-click demo helper is provided directly on the login screen for quick access)*

---

## 🧪 Automated Testing

Run the automated integration test suite to verify authentication, product persistence, supplier CRUD, POS transactions, stock deduction, and analytics:

```bash
npm test
```

Expected output:
```text
🧪 Starting InvFlow Comprehensive Automated Test Suite...
  ✅ PASS: Login with default credentials returns 200 and JWT token
  ✅ PASS: Login with invalid credentials returns 401
  ✅ PASS: Verify JWT token via /api/auth/me returns 200
  ✅ PASS: POST /api/products saves all fields and returns new ID
  ✅ PASS: GET /api/products/:id retrieves exact entered values
  ✅ PASS: PUT /api/products/:id updates product data
  ✅ PASS: POST /api/suppliers adds supplier
  ✅ PASS: GET /api/suppliers returns list
  ✅ PASS: POST /api/billing generates invoice with correct calculations
  ✅ PASS: Stock deduction: product quantity decreased by purchased quantity
  ✅ PASS: GET /api/dashboard returns actual database metrics
  ✅ PASS: GET /api/reports/sales returns transactions list
====================================================
📊 Test Results: 12 Passed, 0 Failed
====================================================
```

---

## 🌐 Production Deployment on Vercel

### Step 1: Provision a Free PostgreSQL Database
You can use any free hosted PostgreSQL provider:
* **[Neon Serverless Postgres](https://neon.tech/)** (Recommended)
* **[Supabase Database](https://supabase.com/)**
* **[Render PostgreSQL](https://render.com/)**

Copy your PostgreSQL connection string:
```text
postgresql://neondb_owner:password@ep-example.neon.tech/neondb?sslmode=require
```

### Step 2: Deploy to Vercel
1. Push your repository to GitHub.
2. Log in to [Vercel](https://vercel.com/) and click **"Add New Project"**.
3. Import your `inventory-billing` repository.
4. In **Environment Variables**, add:
   * `DATABASE_URL`: Your PostgreSQL connection string.
   * `JWT_SECRET`: A secure random string (e.g. `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`).
   * `NODE_ENV`: `production`.
5. Click **Deploy**.

> **Note**: Database tables (`users`, `products`, `suppliers`, `sales`, `sale_items`) and the hashed default admin user are automatically created upon the first request!

---

## 🛠️ Environment Variables Configuration

Create a `.env` file in the root directory (refer to `.env.example`):

```env
# Environment Mode
NODE_ENV=development

# Server Port
PORT=3000

# JWT Authentication Secret
JWT_SECRET=your-secure-jwt-secret-key

# Database Connection (Optional for local development; required for PostgreSQL/Vercel)
DATABASE_URL=
```

---

## 📡 REST API Documentation

All API responses follow a consistent standard JSON structure:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

### 🔐 Authentication Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate user and receive JWT token |
| `GET` | `/api/auth/me` | Verify active session & retrieve user info |

### 📦 Product Management Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | Retrieve all inventory products |
| `GET` | `/api/products/:id` | Retrieve single product details |
| `POST` | `/api/products` | Create a new product |
| `PUT` | `/api/products/:id` | Update product information |
| `DELETE` | `/api/products/:id` | Delete product from database |

### 🏭 Supplier Management Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/suppliers` | Retrieve all registered suppliers |
| `GET` | `/api/suppliers/:id` | Retrieve single supplier details |
| `POST` | `/api/suppliers` | Register a new supplier |
| `PUT` | `/api/suppliers/:id` | Update supplier details |
| `DELETE` | `/api/suppliers/:id` | Remove supplier |

### 📊 Stock & Inventory Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stock` | Retrieve stock level valuation & threshold metrics |
| `PUT` | `/api/stock/:id` | Adjust or restock quantity for a product |

### 🧾 POS Billing & Invoicing Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/billing` | Checkout cart, deduct stock atomically & generate invoice |
| `GET` | `/api/invoices` | Retrieve all historical invoices |
| `GET` | `/api/invoices/:id` | Retrieve invoice details with itemized breakdown |

### 📈 Dashboard & Analytics Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Real-time overview metrics (Revenue, Stock, Orders) |
| `GET` | `/api/reports/sales` | Transaction history for chart rendering and CSV export |

---

## 🛡️ Security Best Practices Implemented

* **Password Hashing**: `bcryptjs` with salt rounds = 10; zero plaintext passwords in database.
* **SQL Injection Prevention**: All queries use parameterized queries across both SQLite and PostgreSQL.
* **Stateless JWT Authentication**: Signed tokens verified on protected actions with configurable expiration.
* **Input Sanitization & Validation**: Comprehensive type checking and boundary constraints on pricing and stock units.
* **XSS Prevention**: HTML string escaping utility applied across all rendered DOM tables and lists.
* **Environment Protection**: `.env` and `*.db` excluded from version control via `.gitignore`.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
