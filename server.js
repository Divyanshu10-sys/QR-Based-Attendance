require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');

const app = express();

connectDB();

app.use(helmet());
const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map(v => v.trim()).filter(Boolean)
  : null;

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser requests (curl/health checks) and any origin when no
    // production allow-list has been configured.
    if (!origin || !allowedOrigins) return callback(null, true);
    return callback(null, allowedOrigins.includes(origin));
  }
}));
app.use(express.json({ limit: '5mb' })); // face descriptors are small JSON arrays, not raw images
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Global rate limiter - tighter limiter applied additionally on sensitive routes
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use(globalLimiter);

app.get('/', (req, res) => {
  res.json({ name: 'QR Attendance Backend', status: 'running', health: '/api/health' });
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/attendance', attendanceRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
