# Magic CEO Ma Phoo Telegram Shop Bot

Production-ready starter for a Telegram cosmetics ecommerce bot using Node.js, Express, Supabase PostgreSQL, Telegram Bot API, and Render.

## Features

- `/start` menu in Burmese
- Product categories and product detail view from Supabase
- Usage and benefits replies per product
- COD order flow
- Free delivery calculation using `products.free_delivery_qty`
- Saves orders to `orders` and `order_items`
- Sends admin Telegram notifications
- Burmese keyword replies for common customer questions
- Render-compatible webhook server

## Local Setup

Your current secrets are in `.env.txt`, and this bot loads both `.env` and `.env.txt`. For production, add the same variables in Render Environment settings.

```bash
npm install
npm test
npm start
```

## Render Setup

1. Create a new Render Web Service.
2. Set build command:

```bash
npm install
```

3. Set start command:

```bash
npm start
```

4. Add environment variables from `.env.example`.
5. Set `WEBHOOK_URL` to your Render service URL, for example:

```text
https://magic-ceo-ma-phoo-bot.onrender.com
```

When the service starts, it automatically registers:

```text
/telegram/webhook
```

## Telegram Commands

- `/start` - open main menu
- `/products` - show product categories
- `/cancel` - cancel current order

## Notes

The order insert is schema-tolerant. It tries a full ecommerce payload first, then removes fields Supabase reports as missing. This helps the bot work with common `orders` and `order_items` table designs while you continue refining the database schema.
