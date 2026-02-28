const express = require('express');
const crypto = require('crypto');
const pool = require('../db.js');
const { authenticate } = require('../middleware/auth.middleware.js');
const { authorize } = require('../middleware/role.middleware.js');
const { ROLES } = require('../src/constants/roles.js');

const router = express.Router();
/** POST /users/:id/payment-status
 * Access to: sales, superadmin
 */
router.get(
    '/payment-status',
    // authenticate,
    // authorize(ROLES.SALES, ROLES.SUPERADMIN),
    async (req, res) => {
        const { email } = req.query;

        try {
            const result = await pool.query(
                `SELECT status FROM payments WHERE email =$1`,
                [email]
            );

            if (result.rows.length === 0) {
                try {
                    const linkRes = await pool.query(
                        `SELECT * FROM payment_links WHERE email=$1`,
                        [email]
                    );
                    if (linkRes.rows.length === 0) {
                        return res.status(404).json({ error: "No payment link was found"});
                    }
                    if (linkRes.rows[0].used) {
                        res.json({ status: "Payment link used, but payment not found. Generate new link."});
                    }
                    res.json({ status: "Payment link created, waiting for payment.", expires_at: linkRes.rows[0].expires_at});
                } catch {
                    return res.status(404).json({ error: "User not found" });
                }
            }

            console.log("Check if only one payment was created", result.rows);
            res.json({ status: result.rows[0].status });
        } catch (error) {
            res.status(500).json({ error: "Database error"});
        }
    }
);

router.get("/subscription", async (req, res) => {
    const { email } = req.query;

    const result = await pool.query(
        `SELECT *
        FROM subscriptions
        WHERE email = $1
        AND status = 'active'
        AND current_period_end > now()`,
        [email]
    );

    const hasAccess = result.rows.length > 0;
    res.json({ status: hasAccess });
});

router.post("/create-subscription-session", async (req, res) => {
	try {
		const { email } = req.body;
		const session = await stripe.checkout.sessions.create({
			mode: "subscription",
			payment_method_types: ["card"],
			customer_email: email,
			line_items: [
				{
					price: "price_1T4O29IqG0lEuV8tdc9xMixW",
					quantity: 1,
				},
			],
			success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${process.env.FRONTEND_URL}/cancel`,
		});

		res.json({ url: session.url });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
});

router.post("/cancel-subscription", async (req, res) => {
	try {
		const { email } = req.body;
		
		const subscription = await pool.query(
			`SELECT * FROM subscriptions WHERE email=$1`,
			[email]
		);
		if (!subscription.rows.length) {
			return res.status(404).json({ error: `Subscription for user ${email} not found`});
		}

		const subscriptionId = subscription.rows[0].stripe_subscription_id;
		await stripe.subscriptions.update(subscriptionId, {
			cancel_at_period_end: true,
		});
		
		res.json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
});

router.post("/create-portal-session", async (req, res) => {
	const { email } = req.body;

	const subscription = await pool.query(
		`SELECT stripe_customer_id FROM subscriptions WHERE email=$1`,
		[email]
	);

	if (!subscription.rows.length) {
		return res.status(404).json({ error: `Subscription for user ${email} not found` });
	}

	const portalSession = await stripe.billingPortal.sessions.create({
		customer: subscription.rows[0].stripe_customer_id,
		return_url: process.env.FRONTEND_URL,
	});
	res.json({ url: portalSession.url });
});

module.exports = router;