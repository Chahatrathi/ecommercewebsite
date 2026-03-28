const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();

// --- 1. MIDDLEWARE ---
// This allows your frontend to make requests to this backend
app.use(cors({
    origin: "*", // In a real SaaS, you would eventually replace * with your frontend URL
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));
app.use(express.json());

// --- 2. DATABASE CONNECTION ---
// On Render, go to Environment Variables and add MONGO_URI
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("⚠️ WARNING: MONGO_URI is not defined in environment variables. Defaulting to local.");
}

mongoose.connect(MONGO_URI || 'mongodb://127.0.0.1:27017/elite_brand')
    .then(() => console.log('✅ Cloud Database Connected Successfully'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error. Check your IP Whitelist on Atlas!');
        console.error(err);
    });

// --- 3. USER SCHEMA & MODEL ---
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// --- 4. ROUTES ---

// Root route (Health check for Render)
app.get('/', (req, res) => {
    res.status(200).send('🚀 ELITE SaaS API is Live.');
});

// Status check for the frontend UI dot
app.get('/api/status', (req, res) => {
    res.status(200).json({ status: "online", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

// SIGNUP ROUTE
app.post('/api/signup', async (req, res) => {
    try {
        const { fullName, email, password, role } = req.body;

        if (!email || !password || !fullName) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) return res.status(400).json({ error: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ 
            fullName, 
            email: email.toLowerCase(), 
            password: hashedPassword, 
            role: role || 'customer' 
        });

        await user.save();
        res.status(201).json({ 
            message: "User created",
            user: { name: user.fullName, email: user.email, role: user.role } 
        });
    } catch (err) { 
        console.error("Signup Error:", err);
        res.status(500).json({ error: "Internal Server Error" }); 
    }
});

// LOGIN ROUTE
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ error: "Invalid Credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid Credentials" });

        res.json({ 
            message: "Login successful",
            user: { name: user.fullName, email: user.email, role: user.role } 
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- 5. START SERVER ---
const PORT = process.env.PORT || 5000;
// We use 0.0.0.0 to make sure Render can map the port correctly
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    -------------------------------------------
    🚀 ELITE Server Live on Port ${PORT}
    📡 API Base: http://localhost:${PORT}/api
    -------------------------------------------
    `);
});
