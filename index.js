require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

const cors = require("cors");

app.use(cors());
app.use(express.json());

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q66zrl2.mongodb.net/?retryWrites=true&w=majority`;

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    const db = client.db("jobbox");
    const userCollection = db.collection("user");
    const jobCollection = db.collection("job");
    const notificationsCollection = db.collection("notifications");
    const conversations = db.collection("conversation");

    app.post("/user", async (req, res) => {
      const user = req.body;

      const result = await userCollection.insertOne(user);

      res.send(result);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;

      const result = await userCollection.findOne({ email });

      if (result?.email) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });

    app.patch("/apply", async (req, res) => {
      const userId = req.body.userId;
      const jobId = req.body.jobId;
      const email = req.body.email;

      const filter = { _id: ObjectId(jobId) };
      const updateDoc = {
        $push: { applicants: { id: ObjectId(userId), email } },
      };

      const result = await jobCollection.updateOne(filter, updateDoc);

      if (result.acknowledged) {
        const notification = { ...req.body, isSeen: false };
        const sendNotify = await notificationsCollection.insertOne(
          notification
        );
        if (sendNotify.acknowledged) {
          return res.send({ status: true, data: result });
        }
      }

      res.send({ status: false });
    });

    app.patch("/cancel-apply", async (req, res) => {
      const userId = req.body.userId;
      const jobId = req.body.jobId;
      const email = req.body.email;

      const filter = { _id: ObjectId(jobId) };

      const applyJob = await jobCollection.findOne(filter);
      const remainApply = applyJob.applicants.filter(
        (user) => user.email !== email
      );

      const options = { upsert: true };

      const updateDoc = {
        $set: {
          applicants: remainApply,
        },
      };

      const result = await jobCollection.updateOne(filter, updateDoc, options);

      if (result.acknowledged) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });

    app.patch("/query", async (req, res) => {
      const userId = req.body.userId;
      const jobId = req.body.jobId;
      const email = req.body.email;
      const question = req.body.question;
      const userName = req.body.userName;

      const filter = { _id: ObjectId(jobId) };
      const updateDoc = {
        $push: {
          queries: {
            id: ObjectId(userId),
            email,
            userName,
            question: question,
            reply: [],
          },
        },
      };

      const result = await jobCollection.updateOne(filter, updateDoc);

      if (result?.acknowledged) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });

    app.patch("/reply", async (req, res) => {
      const userId = req.body.userId;
      const reply = req.body.reply;

      const filter = { "queries.id": ObjectId(userId) };

      const updateDoc = {
        $push: {
          "queries.$[user].reply": reply,
        },
      };
      const arrayFilter = {
        arrayFilters: [{ "user.id": ObjectId(userId) }],
      };

      const result = await jobCollection.updateOne(
        filter,
        updateDoc,
        arrayFilter
      );
      if (result.acknowledged) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });

    app.get("/applied-jobs/:email", async (req, res) => {
      const email = req.params.email;
      const query = { applicants: { $elemMatch: { email: email } } };
      const cursor = jobCollection.find(query).project({ applicants: 0 });
      const result = await cursor.toArray();

      res.send({ status: true, data: result });
    });

    app.get("/jobs", async (req, res) => {
      const cursor = jobCollection.find({});
      const result = await cursor.toArray();
      res.send({ status: true, data: result });
    });

    app.get("/postJob/:email", async (req, res) => {
      const email = req.params.email;
      const query = { authorEmail: email };
      const cursor = jobCollection.find(query);
      const result = await cursor.toArray();
      res.send({ status: true, data: result });
    });

    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;

      const result = await jobCollection.findOne({ _id: ObjectId(id) });
      res.send({ status: true, data: result });
    });

    app.post("/job", async (req, res) => {
      const job = req.body;

      const result = await jobCollection.insertOne(job);

      res.send({ status: true, data: result });
    });

    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;

      const result = await jobCollection.deleteOne({ _id: ObjectId(id) });
      res.send({ status: true, data: result });
    });

    app.get("/notifications/:email", async (req, res) => {
      const email = req.params.email;
      const query = { authorEmail: email };

      const result = await notificationsCollection.find(query).toArray();

      res.send({ status: true, data: result });
    });

    app.patch("/notifications/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };

      const updateDoc = {
        $set: {
          isSeen: true,
        },
      };

      const result = await notificationsCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send({ status: true, data: result });
    });

    app.get("/messages", async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.send({ status: true, data: result });
    });

    app.post("/send-messages", async (req, res) => {
      const data = req.body;
      const result = await conversations.insertOne(data);
      res.send({ status: true, data: result });
    });

    app.get("/conversation/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { senderId: id };
      const result = await conversations.find(query).toArray();
      res.send({ status: true, data: result });
    });
  } finally {
  }
};

run().catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("Employee Management - Assignment-2 Server");
});

app.listen(port, () => {
  console.log(`Employee Management - Assignment-2 Server port: ${port}`);
});
