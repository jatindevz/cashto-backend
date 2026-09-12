# CashTo Backend Service

Independent, lightweight backend service for **CashTo** providing:
- **Phone Number + OTP Authentication** with JWT (Access Tokens + Refresh Token rotation).
- **Offline-First Delta Sync** (Two-way pull/push synchronization).
- **Push Notifications** (Expo Push Notification API).
- **Database**: SQLite via Prisma ORM (zero setup required; easily migrates to PostgreSQL for production).

---

## 🚀 Quick Start

### 1. Install & Setup
```bash
cd cashto-backend
npm install
npm run db:push
```

### 2. Start Development Server
```bash
npm run dev
```
The server will run on `http://localhost:4000`.

---

## 📱 Connecting to the CashTo Mobile App

- **Android Emulator**: Uses `http://10.0.2.2:4000` (already configured as default in `services/apiClient.ts`).
- **Physical Device**: Update `API_BASE_URL` in `CashTo/services/apiClient.ts` to your machine's local IP (e.g. `http://192.168.1.100:4000`).

---

## 🔑 Authentication Flow (Phone + OTP)

1. **Request OTP**:
   `POST /api/v1/auth/otp/request`
   ```json
   { "phone": "9876543210" }
   ```
   *In development, the mock OTP `123456` is returned in the response.*

2. **Verify OTP & Get JWT**:
   `POST /api/v1/auth/otp/verify`
   ```json
   { "phone": "9876543210", "code": "123456" }
   ```
   Returns `accessToken` (15m expiry), `refreshToken` (30d expiry), and `user` profile.

---

## 🔄 Offline Delta Sync API

- **Pull Updates**: `GET /api/v1/sync/pull?since=<timestamp>`
- **Push Updates**: `POST /api/v1/sync/push`
  ```json
  {
    "transactions": [
      {
        "id": "sms_1741753200000_abc",
        "amount": 450,
        "merchant": "Swiggy",
        "category": "food",
        "type": "debit",
        "timestamp": 1741753200000,
        "isManual": false,
        "isImportant": false,
        "source": "sms",
        "updatedAt": 1741753200000
      }
    ]
  }
  ```

---

## 🔔 Push Notifications API

- **Register Token**: `POST /api/v1/push/register`
- **Send Test Notification**: `POST /api/v1/push/test`
