const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key');

const app = express();
app.use(cors());
app.use(express.json());

// DB CONNECTION
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/elite_brand';
mongoose.connect(MONGO_URI).then(() => console.log('✅ DB Connected')).catch(e => console.log('❌ DB Error', e));

const User = mongoose.model('User', new mongoose.Schema({
    fullName: String,
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true }
}));

// API ROUTES
app.get('/api/status', (req, res) => res.json({ status: "online" }));

app.post('/api/signup', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ fullName, email: email.toLowerCase(), password: hashedPassword });
        await user.save();
        res.status(201).json({ user: { name: user.fullName, email: user.email } });
    } catch (err) { res.status(400).json({ error: "Signup Failed" }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (user && await bcrypt.compare(password, user.password)) {
            res.json({ user: { name: user.fullName, email: user.email } });
        } else { res.status(401).json({ error: "Invalid Credentials" }); }
    } catch (err) { res.status(500).json({ error: "Server Error" }); }
});

// STRIPE CHECKOUT
app.post('/api/checkout', async (req, res) => {
    try {
        const { items } = req.body;
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: { name: item.name },
                unit_amount: item.price * 100,
            },
            quantity: 1,
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${req.headers.origin}/?status=success`,
            cancel_url: `${req.headers.origin}/?status=cancel`,
        });
        res.json({ id: session.id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`API on ${PORT}`));
