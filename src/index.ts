import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { requestOtp, verifyOtp, refreshToken, logout } from './controllers/authController.js';
import { pushSync, pullSync } from './controllers/syncController.js';
import { registerPushToken, testPush } from './controllers/pushController.js';
import { authenticateJwt } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'cashto-backend', timestamp: new Date() });
});

// Auth Routes (Phone + OTP + JWT)
app.post('/api/v1/auth/otp/request', requestOtp);
app.post('/api/v1/auth/otp/verify', verifyOtp);
app.post('/api/v1/auth/refresh', refreshToken);
app.post('/api/v1/auth/logout', logout);

// Offline Sync Routes (Protected by JWT)
app.post('/api/v1/sync/push', authenticateJwt, pushSync);
app.get('/api/v1/sync/pull', authenticateJwt, pullSync);

// Push Notification Routes
app.post('/api/v1/push/register', authenticateJwt, registerPushToken);
app.post('/api/v1/push/test', authenticateJwt, testPush);

app.listen(PORT, () => {
  console.log(`🚀 CashTo Backend running on http://localhost:${PORT}`);
});
