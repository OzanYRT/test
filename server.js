const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const Joi = require("joi");
const bcrypt = require("bcrypt");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
let usersCollection;

const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_cluster = process.env.MONGODB_CLUSTER;
const mongodb_database = process.env.MONGODB_DATABASE;
const node_session_secret = process.env.NODE_SESSION_SECRET;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const uri = `mongodb+srv://${mongodb_user}:${encodeURIComponent(mongodb_password)}@${mongodb_cluster}/${mongodb_database}`;

MongoClient.connect(uri, { useUnifiedTopology: true })
  .then((client) => {
    console.log("Connected to MongoDB");
    const db = client.db("test");
    usersCollection = db.collection("users");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB", error);
  });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Set up connect-mongo for session storage
var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${encodeURIComponent(mongodb_password)}@${mongodb_cluster}/${mongodb_database}`,
  crypto: {
    secret: mongodb_session_secret,
  },
});

app.use(
  session({
    secret: node_session_secret,
    store: mongoStore,
    resave: true,
    saveUninitialized: false,
    cookie: {
      maxAge: 60 * 60 * 1000,
    },
  })
);


app.get("/", (req, res) => {
  if (req.session.loggedIn) {
    res.send(`
      Hello ${req.session.username} <br>
      <a href='/members'><button>Go to Members area</button></a> <br>
      <a href='/logout'><button>Log out</button></a>
    `);
  } else {
    res.send(`
      <a href='/signup'><button>Sign up</button></a> <br>
      <a href='/login'><button>Log in</button></a>
    `);
  }
});

app.get('/signup', (req, res) => {
  res.send(`
    create user
    <form action="/signup" method="post"> 
      <input type="text" name="name" placeholder="name"><br>
      <input type="email" name="email" placeholder="email"><br>
      <input type="password" name="password" placeholder="password"><br>
      <input type="submit" value="Submit">
    </form>
  `);
});

app.post("/signup", async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(50).required()
  });
  const validationResult = schema.validate(req.body);

  if (validationResult.error) {
    res.status(400).send(validationResult.error.details[0].message + "<br><a href='/signup'>Go back to sign up</a>");
  } else {
    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      const newUser = {
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
      };
      const result = await usersCollection.insertOne(newUser);
      req.session.loggedIn = true;
      req.session.username = newUser.name;
      res.redirect("/members");
    } catch (error) {
      res.status(500).send("Error signing up.");
    }
  }
});

app.get("/login", (req, res) => {
  res.send(`
    log in
    <form action="/login" method="post"> 
      <input type="email" name="email" placeholder="email"><br>
      <input type="password" name="password" placeholder="password"><br>
      <input type="submit" value="Submit">
    </form>
  `);
});

app.post("/login", async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(50).required()
  });
  const validationResult = schema.validate(req.body);

  if (validationResult.error) {
    res.status(400).send(validationResult.error.details[0].message + "<br><a href='/login'>Go back to log in</a>");
  } else {
    try {
      const user = await usersCollection.findOne({ email: req.body.email });
      if (user && (await bcrypt.compare(req.body.password, user.password))) {
        req.session.loggedIn = true;
        req.session.username = user.name;
        res.redirect("/");
      } else {
        res.status(401).send("Incorrect email or password.<br><a href='/login'>Go back to log in</a>");
      }
    } catch (error) {
      res.status(500).send("Error logging in.");
    }
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session", err);
      res.status(500).send("Error logging out.");
    } else {
      res.redirect("/");
    }
  });
});

app.get("/members", (req, res) => {
  if (req.session.loggedIn) {
    const images = ['image1.jpg', 'image2.jpg', 'image3.jpg'];
    const randomImage = images[Math.floor(Math.random() * images.length)];

    res.send(`
      <h1>Members area</h1>
      Hello ${req.session.username} <br>
      <a href='/logout'><button>Log out</button></a> <br>
      <img src="${randomImage}" alt="Random Image">
    `);
  } else {
    res.status(403).send("You must be logged in to access the members area.<br><a href='/'>Go back to home page</a>");
  }
});

app.get('*', (req, res) => {
  res.status(404);
  res.send('Page doesnt exists');
});

app.listen(3000, () => {
  console.log('server is running on port 3000');
});