# InvFlow — Modern Inventory & Billing Management System

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-lightgrey.svg)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A high-performance, modern SaaS-grade **Inventory & Billing Point of Sale (POS) Management System** built with Node.js, Express, SQLite3, and Vanilla JavaScript/CSS.

---

## ⚡ Key Features

- **Executive Analytics Dashboard**: Real-time business metrics (Revenue, Total Products, Invoices, Low-Stock Warnings) with Chart.js line and doughnut charts.
- **Product Management**: Full CRUD capabilities, dynamic category filtering, supplier linkages, and stock status indicators (`● In Stock`, `● Low Stock`, `● Out of Stock`).
- **Supplier Directory**: Manage vendor corporate profiles, contact information, and supplied lines.
- **Stock Level Tracking**: Inventory health progress bars, automatic reorder threshold alerts, and asset stock valuation.
- **Point of Sale (POS) & Invoicing**:
  - Live product catalog search and quick-add carts.
  - Multi-item checkout with automatic GST tax calculations.
  - Dynamic invoice preview modal with print support and **PDF Invoice Download** (`jsPDF` & `AutoTable`).
  - Automatic real-time stock deduction upon checkout.
- **Sales Reports & CSV Export**: Historical transaction auditing with date-range filters (`Today`, `7 Days`, `30 Days`, `All Time`) and 1-click **Export to CSV**.
- **SaaS Design System**: Minimal, responsive layout with dark navigation drawer, toast notifications, accessible modal dialogs, and smooth micro-animations.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (version 16 or higher)
- npm

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/srijesh123527/inventory-billing.git
   cd inventory-billing
   ```

2. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Start the application**:
   ```bash
   node server.js
   ```

4. **Access the application**:
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🔐 Default Credentials

- **Username**: `admin`
- **Password**: `admin123`
*(A 1-click demo helper is provided directly on the sign-in screen)*

---

## 🏗️ Architecture & Tech Stack

```text
├── backend/
│   ├── database.db         # SQLite database file
│   ├── package.json        # Backend dependencies (express, sqlite3, cors)
│   └── server.js           # REST API routes and database controller
├── frontend/
│   ├── css/
│   │   └── style.css       # Unified SaaS Design System & components
│   ├── js/
│   │   └── api.js          # Core helpers, auth, toast system, and modals
│   ├── billing.html        # Point of Sale & Invoicing
│   ├── index.html          # Executive Dashboard & analytics
│   ├── login.html          # Authentication screen
│   ├── products.html       # Product CRUD & catalog
│   ├── reports.html        # Sales reports & CSV export
│   ├── stock.html          # Stock monitoring & valuation
│   └── suppliers.html      # Vendor management
├── .gitignore
└── README.md
```

---

## 📄 License
This project is licensed under the MIT License.
