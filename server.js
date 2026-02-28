require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { ensureSuperAdminExists } = require('./bootstrap/admin.bootstrap');
const adminRoutes = require('./routes/admin.routes.js');
const salesRoutes = require('./routes/sales.routes.js');
const usersRoutes = require('./routes/users.routes.js');
const authRoutes = require('./routes/auth.routes.js');

const app = express();
app.use(cors({
    origin: process.env.FRONTEND_URL
}));
// ensureSuperAdminExists();

app.get("/init-db", async (req, res) => {
  try {
	await pool.query('DROP TABLE IF EXISTS payments CASCADE;');
	await pool.query('DROP TABLE IF EXISTS users CASCADE');
	await pool.query('DROP TABLE IF EXISTS payment_links');
	await pool.query('DROP TABLE IF EXISTS subscriptions CASCADE');
    await pool.query(`
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			role VARCHAR(50) DEFAULT 'client',
			payment_status VARCHAR(50),
			created_at TIMESTAMP DEFAULT NOW()
		);
    `);
	// Commented code should be run only once
    await pool.query(`
        CREATE TYPE payment_type AS ENUM ('one_time', 'subscription');
            CREATE TYPE payment_status AS ENUM (
                'pending',
                'succeeded',
                'failed',
                'canceled',
                'refunded'
            );
        
		CREATE TABLE IF NOT EXISTS payments (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

			email TEXT NOT NULL,
			
			stripe_payment_intent_id TEXT,
			stripe_invoice_id TEXT,
			stripe_subscription_id TEXT,
			stripe_customer_id TEXT,

			type payment_type NOT NULL,
			status payment_status NOT NULL,

			amount INTEGER NOT NULL,
			currency VARCHAR(10),

			period_start TIMESTAMP WITH TIME ZONE,
			period_end TIMESTAMP WITH TIME ZONE,

			created_at TIMESTAMP DEFAULT NOW()
		);
    `);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS subscriptions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			
			email TEXT NOT NULL,

			stripe_subscription_id TEXT UNIQUE NOT NULL,
			stripe_customer_id TEXT NOT NULL,

			status TEXT NOT NULL,
			current_period_start TIMESTAMP WITH TIME ZONE,
			current_period_end TIMESTAMP WITH TIME ZONE,

			cancel_at_period_end BOOLEAN DEFAULT false,

			created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
		)`)
	await pool.query(`
		CREATE TABLE payment_links (
			id SERIAL PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			token VARCHAR(255) UNIQUE NOT NULL,
			expires_at TIMESTAMP NOT NULL,
			used BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT NOW()
		);
	`);
    res.send("Table created");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});


app.use(express.json());

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/sales', salesRoutes);
app.use('/users', usersRoutes);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
})