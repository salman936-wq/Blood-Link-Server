require('dotenv').config();
const ImageKit = require("imagekit");
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5500;

// Middleware
app.use(cors());
app.use(express.json());

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

app.get("/imagekit/auth", (req, res) => {
  const authenticationParameters =
    imagekit.getAuthenticationParameters();

  res.send(authenticationParameters);
});


// Basic Route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});