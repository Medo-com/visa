const express = require('express');
const cors = require('cors');
const path = require('path');
const visaRoutes = require('./routes/visaRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API routes
app.use('/api', visaRoutes);

// Serve the frontend for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Serve the visa-free destinations page
app.get('/visa-free', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'visa-free.html'));
});

// Serve the contact page
app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'contact.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
