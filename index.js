require('dotenv').config();
const ImageKit = require("imagekit");
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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


// Basic Route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.get("/imagekit/auth", (req, res) => {
  const authenticationParameters =
    imagekit.getAuthenticationParameters();

  res.send(authenticationParameters);
});





const uri = process.env.MONGO_DB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    const db = client.db("BlodLink");
    const usersCollection = db.collection("user");
    const donationRequestsCollection = db.collection("donationRequests");


    app.post("/api/donor/donation-request", async (req, res) => {
      try {
        const data = req.body;

        const result = await donationRequestsCollection.insertOne(data);

        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: "Failed to create donation request",
          error: error.message,
        });
      }
    });

    app.get("/api/donor/donation-request/:id", async (req, res) => {
      const { id } = req.params;

      const result = await donationRequestsCollection.find({ donorId: id }).toArray();

      res.send(result)

    });

    app.get("/api/donor/blood-request/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await donationRequestsCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });



  } finally {
    // Keep the connection open while the server runs.
    // await client.close();
  }
}

run().catch(console.dir);



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});