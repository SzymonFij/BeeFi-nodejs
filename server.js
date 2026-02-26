require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors({
    origin: process.env.FRONTEND_URL
}));

// app.use('/auth', authRoutes);
// app.use('/admin', adminRoutes);
// app.use('/users', usersRoutes);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
})