require('dotenv').config();
const ImageKit = require("imagekit");
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const Stripe = require("stripe");


const app = express();
const PORT = process.env.PORT || 5500;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
let paymentsCollection;


app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {


    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log("======================");
      console.log(err);
      console.log("======================");

      return res.status(400).send(err.message);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Duplicate check
      const exists = await paymentsCollection.findOne({
        sessionId: session.id,
      });

      if (!exists) {
        await paymentsCollection.insertOne({
          sessionId: session.id,
          paymentIntentId: session.payment_intent,

          email: session.customer_email || session.metadata.email,

          amount: session.amount_total / 100,

          currency: session.currency,

          status: session.payment_status,

          createdAt: new Date(),
        });

        console.log("✅ Payment Saved");
      } else {
        console.log("⚠️ Payment Already Exists");
      }
    }

    res.sendStatus(200);
  }
);

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
    paymentsCollection = db.collection("payments");


    // Admin and Volentare - get all request for blod
    app.get("/api/admin/donation-request", async (req, res) => {

      const query = {};


      if (req.query.status) {
        query.status = req.query.status;
      }

      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.perPage) || 10;

      const skipItems = (page - 1) * perPage;
      const total = await donationRequestsCollection.countDocuments(query);
      const result = await donationRequestsCollection.find(query).skip(skipItems).limit(perPage).toArray();

      res.send({
        datas: result,
        total: total,
        totalPage: Math.ceil(total / perPage),
      });


    });



    // Donor - post new request for blod
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


    // Update blood request
    app.put("/api/dashboard/donor/request/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body;
        console.log(updatedData);

        const result = await donationRequestsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: updatedData,
          }
        );

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: error.message });
      }
    });


    // Donor - accepted request
    app.patch("/api/dashboard/donor/blood-request/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const data = req.body;

        const updateFields = {};

        if (data.donatedBy !== undefined) {
          updateFields.donatedBy = data.donatedBy;
        }

        if (data.donatedByPhone !== undefined) {
          updateFields.donatedByPhone = data.donatedByPhone;
        }

        if (data.status !== undefined) {
          updateFields.status = data.status;
        }

        const result = await donationRequestsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: updateFields,
          }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Status update for donetion Request 
    app.patch("/api/dashboard/donor/status-request/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      const result = await donationRequestsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: status,
          },
        }
      );

      res.send(result);
    });



    // Delete blod request
    app.delete("/api/dashboard/donor/blood-request/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = donationRequestsCollection.deleteOne({ _id: new ObjectId(id) })

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Blood request not found",
          });
        }

        res.send({
          success: true,
          message: "Blood request deleted successfully",
        });


      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    })





    // Public get all rquest (Filter: Pending)
    app.get("/api/donation-requests", async (req, res) => {
      try {
        const query = {
          status: "Pending",
        };

        if (req.query.division) {
          query.division = req.query.division;
        }

        if (req.query.district) {
          query.district = req.query.district;
        }


        if (req.query.bloodGroup) {
          query.bloodGroup = req.query.bloodGroup;
        }

        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.perPage) || 6;

        const skipItems = (page - 1) * perPage;

        const total = await donationRequestsCollection.countDocuments(query);

        const bloodRequest = await donationRequestsCollection
          .find(query)
          .skip(skipItems)
          .limit(perPage)
          .toArray();

        res.send({
          datas: bloodRequest,
          total,
          page,
          perPage,
          totalPage: Math.ceil(total / perPage),
        });




      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Public get donner details
    app.get("/api/all-donor", async (req, res) => {
      try {
        const query = {};

        if (req.query.district) {
          query.district = req.query.district;
        }

        if (req.query.bloodGroup) {
          query.bloodGroup = req.query.bloodGroup;
        }

        const perPage = 12;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * perPage;

        const totalData = await usersCollection.countDocuments(query);

        const donors = await usersCollection
          .find(query)
          .skip(skip)
          .limit(perPage)
          .toArray();

        res.send({
          data: donors,
          totalData,
          totalPage: Math.ceil(totalData / perPage),
          perPage,
          currentPage: page,
        });
      } catch (error) {
        res.status(500).send({
          message: "Internal Server Error",
          error: error.message,
        });
      }
    });

    // Public get last 30 payments
    app.get("/api/public/payments", async (req, res) => {
      try {
        const result = await paymentsCollection
          .aggregate([
            // Latest payments first
            {
              $sort: {
                createdAt: -1,
              },
            },

            // Get last 30 payments
            {
              $limit: 30,
            },

            // Join user collection
            {
              $lookup: {
                from: "user", // <-- আপনার user collection name
                localField: "email",
                foreignField: "email",
                as: "user",
              },
            },

            // Convert user array to object
            {
              $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true,
              },
            },

            // Return only required fields
            {
              $project: {
                _id: 0,
                amount: 1,
                transactionId: "$paymentIntentId",
                date: "$createdAt",

                name: {
                  $ifNull: ["$user.name", "Guest"],
                },

                image: {
                  $ifNull: [
                    "$user.image",
                    "https://img.magnific.com/free-vector/user-circles-set_78370-4704.jpg",
                  ],
                },
              },
            },
          ])
          .toArray();

        // Add Serial Number
        const payments = result.map((item, index) => ({
          serialNumber: index + 1,
          ...item,
        }));

        res.status(200).send(payments);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch payments",
          error: error.message,
        });
      }
    });




    // Donor - get all personal request for blod
    app.get("/api/donor/donation-request/:id", async (req, res) => {

      const { id } = req.params;
      const query = { donorId: id };


      if (req.query.status) {
        query.status = req.query.status;
      }

      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.perPage) || 10;

      const skipItems = (page - 1) * perPage;
      const total = await donationRequestsCollection.countDocuments(query);
      const result = await donationRequestsCollection.find(query).skip(skipItems).limit(perPage).toArray();

      res.send({
        datas: result,
        total: total,
        totalPage: Math.ceil(total / perPage),
      });


    });

    // Donor - get blod request by id
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

    // User profile change with patch
    app.patch("/api/profile/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const data = req.body;


        const updateDoc = {
          $set: {
            name: data.fullName,
            email: data.email,
            phone: data.phone,
            bloodGroup: data.bloodGroup,
            division: data.division,
            district: data.district,
          },
        };

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // Donor personal funding history check
    app.get("/api/donor/payments/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const data = await paymentsCollection.find({ email: email }).sort({ createdAt: -1 }).toArray();
        res.send(data)
      }
      catch (error) {
        res.status(500).send({ message: error.message });
      }
    })








  } finally {
    // Keep the connection open while the server runs.
    // await client.close();
  }
}

run().catch(console.dir);



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});