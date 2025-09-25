// This example sets up an endpoint using the Express framework.
const express = require("express");
const app = express();

const stripe = require("stripe")(
  "sk_test_51S84DFLV1NkgtKMpmnj0LXdqMVhfOF9ALf2poYvBOCWKARUcx1oyh8xBCExuCdrQxg2GDvPAgNaL67d1ptYt9QpZ004wvWgkBD"
);

app.post("/create-checkout-session", async (req, res) => {
  console.log("Creating checkout session...");
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "T-shirt",
          },
          unit_amount: 2000,
        },
        quantity: 1,
      },
    ],
    mode: "subscription",
    ui_mode: "embedded",
    return_url:
      "http://localhost:9000/dashboard/projects?session_id={CHECKOUT_SESSION_ID}",
  });

  res.send({ clientSecret: session.client_secret });
});

app.listen(4242, () => console.log(`Listening on port ${4242}!`));
