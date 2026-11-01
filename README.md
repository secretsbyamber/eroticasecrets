# EroticaSecrets — Find Your Desire

A responsive, no-login product catalogue for GitHub Pages. Customers browse products and send orders or restock requests through WhatsApp.

## Publish on GitHub Pages

1. Download and unzip this project.
2. Open your GitHub repository: `https://github.com/` and select `eroticasecrets`.
3. Upload **all files and folders inside** this project (not the outer `eroticasecrets-site` folder).
4. Commit the changes to the `main` branch.
5. In the repository, open **Settings → Pages**.
6. Under Build and deployment, choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
7. Your site should publish at `https://secretsbyamber.github.io/eroticasecrets/`.

## First setup: WhatsApp

Open `products.js` and replace:

`whatsappNumber: "2547XXXXXXXX"`

with your WhatsApp number in international format, digits only. For example, a Kenyan number beginning `07...` becomes `2547...` (do not include `+`, spaces or hyphens).

## Add a product

In `products.js`, remove the example comment and add product objects inside `window.EROTICA_PRODUCTS`.

```js
{
  id: "unique-product-id",
  name: "Product name",
  category: "Intimate Wellness",
  price: 2500,
  status: "available",
  isNew: true,
  description: "A short product description.",
  images: ["assets/product-photo.jpg"],
  reviews: [
    { name: "Verified customer", rating: 5, text: "Customer feedback you have permission to publish.", date: "October 2026" }
  ]
}
```

- `status` can be `"available"` or `"soldout"`.
- Set `isNew` to `true` to show the NEW label. A visitor can dismiss it on their device.
- Set `isNew` to `false` after the launch period.
- Upload product photos into `assets/` and use their exact paths.
- Only publish real reviews with customer permission. Reviews are display-only; there is no public review submission form, which helps prevent spam.

## Important notes

- The age confirmation is a simple front-end gate, not legal age verification.
- The shopping bag is saved in the visitor's browser. It is not a payment checkout; the customer confirms the order with you on WhatsApp.
- Restock requests and orders use WhatsApp. A real WhatsApp number must be configured.
- GitHub Pages is static hosting. Product edits are made in `products.js` and published by committing the change.
- Do not publish private customer details, phone numbers or unapproved reviews.
