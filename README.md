# Kabarak Student Welfare Management System (Backend API)

This is the Node.js/Express REST API backend for the Kabarak Student Welfare Management System. It handles authentication, data management, file generation, and M-Pesa payment orchestration. It is designed for high performance and production-grade security.

## Key Features

- **High-Performance Clustering**: Utilizes Node.js native `cluster` module to span across all available CPU cores, providing load balancing and high availability out of the box.
- **Memory-Efficient Data Streaming**: Uses Node.js Streams (`stream.pipeline`) and `fast-csv` to generate large contribution reports dynamically, ensuring the server handles massive database collections without crashing.
- **Advanced Security & Hardening**:
  - `helmet`: Secures HTTP headers.
  - `express-rate-limit`: Prevents brute-force attacks and limits repeated requests.
  - `express-mongo-sanitize`: Prevents NoSQL injection attacks.
  - `xss-clean`: Sanitizes user input to prevent Cross-Site Scripting.
- **M-Pesa Integration**: Seamlessly interfaces with Safaricom Daraja API for STK Push payments, callback handling, and automated transaction verification.
- **In-Memory Caching**: Uses `node-cache` to dramatically reduce database load on frequently accessed endpoints (like Dashboard metrics and Campaign states).
- **Robust Logging**: Integrated with `morgan` and `winston` for comprehensive request logging and error tracking.

## Architecture & Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ORM)
- **Authentication**: JWT (JSON Web Tokens)
- **Payment Gateway**: Safaricom Daraja (M-Pesa)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (Local instance or MongoDB Atlas)
- Safaricom Developer Account (for Daraja credentials)

### Installation

1. Navigate to the backend directory:
   ```bash
   cd student-welfare-server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration

Create a `.env` file in the root directory and configure the following variables:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/student_welfare

# Security
JWT_SECRET=your_super_secret_key
JWT_EXPIRE=30d

# M-Pesa Configuration
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_PASSKEY=your_passkey
MPESA_SHORTCODE=your_shortcode
MPESA_CALLBACK_URL=https://your-domain.com/api/contributions/mpesa/callback
```

### Running the Server

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode (with CPU clustering):**
```bash
npm start
```

## Directory Structure

- `/controllers` - Request handlers (Admin, Member, Auth, M-Pesa)
- `/routes` - Express route definitions
- `/models` - Mongoose schemas (User, Campaign, Transaction, etc.)
- `/middleware` - Security, Auth, and Error handling middleware
- `/services` - Business logic and external API integrations (M-Pesa, caching)
- `/utils` - Helpers (Streaming, Validation, Utilities)
- `server.js` - Main entry point and clustering setup
