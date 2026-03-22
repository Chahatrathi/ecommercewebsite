const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

// Accessing Stripe Secret Key from Environment Variables
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); 

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. DATABASE CONNECTION ---
// Pulls the URI you just got from MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ SaaS Database Connected Successfully'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- 2. SCHEMAS ---
const User = mongoose.model('User', new mongoose.Schema({
    fullName: String,
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }
}));

const Order = mongoose.model('Order', new mongoose.Schema({
    userEmail: String,
    items: Array,
    total: Number,
    date: { type: Date, default: Date.now }
}));

// --- 3. ROUTES ---

// Health Check
app.get('/api/status', (req, res) => res.json({ status: "online" }));

// Signup
app.post('/api/signup', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ fullName, email: email.toLowerCase(), password: hashedPassword });
        await user.save();
        res.status(201).json({ user: { name: user.fullName, email: user.email } });
    } catch (err) { res.status(400).json({ error: "User already exists or Signup failed" }); }
});

// Login
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

// Fetch User Orders
app.get('/api/orders/:email', async (req, res) => {
    try {
        const orders = await Order.find({ userEmail: req.params.email.toLowerCase() }).sort({ date: -1 });
        res.json(orders);
    } catch (e) { res.status(500).json({ error: "Order fetch failed" }); }
});

// Stripe Checkout & Save Order
app.post('/api/checkout', async (req, res) => {
    try {
        const { items, userEmail } = req.body;
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: items.map(item => ({
                price_data: { 
                    currency: 'usd', 
                    product_data: { name: item.name }, 
                    unit_amount: item.price * 100 
                },
                quantity: 1,
            })),
            mode: 'payment',
            success_url: `${req.headers.origin}/?payment=success`,
            cancel_url: `${req.headers.origin}/?payment=cancel`,
        });

        // Save order to DB immediately for testing history
        const total = items.reduce((sum, i) => sum + i.price, 0);
        const newOrder = new Order({ userEmail: userEmail.toLowerCase(), items, total });
        await newOrder.save();

        res.json({ id: session.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 4. START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ELITE SaaS Backend running on Port ${PORT}`);
});