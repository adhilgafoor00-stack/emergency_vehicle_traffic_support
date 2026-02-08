import express from 'express';
import { connect, get } from '../mongoDb/mongoConfig.js';
import dotenv from 'dotenv';
import authRoutes from '../routes/auth.js';
import { collection } from '../mongoDb/collection.js';
import cookieParser from 'cookie-parser';
import cors from 'cors'
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
app.use(cookieParser())
app.use(express.json());
app.use(express.json({ limit: '10kb' })); // prevent huge payloads
app.use(cors())
app.use((err, req, res, next) => {
  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    'body' in err
  ) {
    console.error("❌ Malformed JSON received:", err.message);
    return res.status(400).json({ message: "Invalid JSON format" });
  }

  next(); // Pass to default error handler if not a JSON issue
});

// ✅ Do everything AFTER DB connects
connect(async (err) => {
  if (err) {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  }

  const db = get();

  // ✅ Create index safely AFTER connection
  await db.collection(collection.User).createIndex({ email: 1 }, { unique: true });
  console.log("✅ Unique index created on email");
  console.log("✅ MongoDB connected successfully");

  // ✅ Start Express server only after DB setup
  app.listen(port, () => {
    console.log(`✅ Server is running on http://localhost:${port}`);
  });

  // ✅ Mount routes after connection
  app.use('/api', authRoutes);

  app.get('/', (req, res) => {
    res.send("Hello World");
  });
});
