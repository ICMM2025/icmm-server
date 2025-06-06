require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const errorMiddleware = require("./middlewares/error");
const notFound = require("./middlewares/not-found");
const app = express();
const testRoute = require("./routes/test-route");
const mailerRoute = require("./routes/mailer-route");
const authRoute = require("./routes/auth-route");

// //middleware
app.use(
  cors()
  //   cors({
  //     origin: "https://icmm-web.onrender.com", // your frontend domain
  //     credentials: true, // if you're using cookies or auth headers
  //   })
);
app.use(express.json());

// routing
app.use("/api/test", testRoute);
app.use("/api/mailer", mailerRoute);
app.use("/api/auth", authRoute);
app.use(notFound);
app.use(errorMiddleware);

// start server
const port = process.env.PORT || 8009;
app.listen(port, () => console.log("SERVER ON:", port));
