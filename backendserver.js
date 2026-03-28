const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

// 1. DB CONNECTION (Make sure to add MONGO_URI in Render Settings)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elite_brand';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ DB Connected'))
    .catch(err => console.error('❌ DB Error:', err));

const User = mongoose.model('User', new mongoose.Schema({
    fullName: String,
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'customer' }
}));

// 2. ROUTES
app.get('/', (req, res) => res.send('🚀 API LIVE'));
app.get('/api/status', (req, res) => res.json({ status: "online" }));

app.post('/api/signup', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        const lowerEmail = email.toLowerCase();
        const existing = await User.findOne({ email: lowerEmail });
        if (existing) return res.status(400).json({ error: "User exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ fullName, email: lowerEmail, password: hashedPassword });
        await user.save();
        res.status(201).json({ user: { name: user.fullName, email: user.email } });
    } catch (err) { res.status(500).json({ error: "Signup Failed" }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (user && await bcrypt.compare(password, user.password)) {
            res.json({ user: { name: user.fullName, email: user.email } });
        } else {
            res.status(401).json({ error: "Invalid Credentials" });
        }
    } catch (err) { res.status(500).json({ error: "Server Error" }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Running on ${PORT}`));

