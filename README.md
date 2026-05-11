# Magic CEO Ma Phoo Telegram Shop Bot

AI-powered Telegram ecommerce assistant for a Myanmar cosmetics shop.

## Stack

- Node.js and Express
- Telegram Bot API webhook
- Supabase PostgreSQL
- Supabase Storage for product images
- OpenRouter AI API
- Render hosting

## Features

- Direct product buttons, not category-first browsing
- Product photo detail view using `products.image_url`
- Burmese AI assistant for product, usage, benefit, delivery, payment, and order questions
- Delivery-zone based fee and payment logic
- Unknown delivery zones become `needs_review`, not automatic cash-on-delivery
- Delivery/payment and free delivery order calculation
- Customer session memory in Supabase
- Saves orders and order items to Supabase
- Admin Telegram order notifications

## Environment Variables

Use these in Render. Do not commit real secrets.

```env
TELEGRAM_BOT_TOKEN=your_botfather_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_or_service_key
ADMIN_CHAT_ID=your_admin_chat_id
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=deepseek/deepseek-chat-v3-0324
WEBHOOK_URL=https://magic-ceo-ma-phoo-bot.onrender.com
TELEGRAM_WEBHOOK_SECRET=choose_a_long_random_secret
USE_POLLING=false
POLLING_DROP_PENDING=false
DEFAULT_DELIVERY_FEE=3000
PORT=3000
```

## Local Setup

```bash
npm install
npm test
npm start
```

For local Telegram testing only:

```bash
npm run dev:poll
```

Do not use polling on Render.

## Render Setup

Build command:

```bash
npm install
```

Start command:

```bash
npm start
```

Render public URL:

```text
https://magic-ceo-ma-phoo-bot.onrender.com
```

Webhook path:

```text
/telegram/webhook
```

The app registers the webhook automatically when `WEBHOOK_URL` is set.

## Supabase SQL

Run migrations from the `migrations/` folder in the Supabase SQL editor.

Core additions:

```sql
alter table public.orders
add column if not exists customer_name text;

alter table public.orders
add column if not exists city text;

alter table public.products
add column if not exists image_url text;
```

Delivery zones:

```sql
create table if not exists public.delivery_zones (
  id bigserial primary key,
  city text,
  township text,
  aliases text[] default '{}',
  cod_available boolean default false,
  delivery_fee numeric default 0,
  payment_method text default 'needs_review',
  estimated_days text,
  note text,
  created_at timestamptz default now()
);
```

Customer sessions:

```sql
create table if not exists public.customer_sessions (
  id bigserial primary key,
  telegram_user_id bigint unique not null,
  last_product text,
  last_city text,
  customer_name text,
  phone text,
  address text,
  interests text[],
  current_intent text,
  draft_order jsonb,
  updated_at timestamptz default now()
);
```

## Product Images

Upload images to Supabase Storage bucket:

```text
productimgs
```

Copy each public URL and paste it into the matching `products.image_url` row.

## Telegram Commands

- `/start` - open main menu
- `/products` - show product buttons
- `/cancel` - cancel current order
- `/id` - show chat ID for admin setup

## Order Message Format

Customers can send natural order details, for example:

```text
Gigi BodyWash 3 (114000)
09763503163
Hlegu tar sone
```

Multi-item carts are supported:

```text
BodyWash 2, Shampoo 1, HairMask 1
```

```text
BodyWash 1 ဘူး နဲ့ Toothpaste 1 set မှာမယ်
```

The bot tries to detect customer name, product, quantity, phone, city/township, and address. If delivery zone is unknown, the order is marked `needs_review` and admin is notified.

Draft carts are stored in `customer_sessions.draft_order` like:

```json
{
  "items": [
    {
      "product_id": 1,
      "product_name": "BodyWash",
      "quantity": 1,
      "unit": "bottle",
      "price": 38000,
      "subtotal": 38000
    }
  ],
  "customer_name": "Gigi",
  "phone": "09763503163",
  "address": "Hlegu tar sone",
  "city": "Hlegu",
  "delivery_fee": 4500,
  "total": 80500,
  "payment_method": "အိမ်ရောက်ငွေချေ",
  "status": "pending"
}
```

Free delivery rules:

- Mixed carts get free delivery when total cart quantity is at least 3.
- BodyWash single-product orders get free delivery at quantity 4 or more.
- Other single-product orders use `products.free_delivery_qty`.
- Unknown delivery zones do not get a final delivery fee until admin confirms.

Customer-facing payment labels:

- `အိမ်ရောက်ငွေချေ` for eligible delivery zones
- `ကြိုလွှဲငွေချေ` for prepaid zones
- `Admin confirm` when delivery zone is unknown

Delivery fee/payment rules use `delivery_zones` as the source of truth:

- Matching Yangon Region aliases: `4,800 Ks` and `အိမ်ရောက်ငွေချေ`
- Matching Mandalay Region aliases: `4,800 Ks` and `အိမ်ရောက်ငွေချေ`
- Matching Naypyitaw Region aliases: `4,800 Ks`; payment follows `delivery_zones.cod_available`
- Other matched rows with `cod_available=true`: `6,000 Ks` and `အိမ်ရောက်ငွေချေ`
- Matched rows with `cod_available=false`: `ကြိုလွှဲငွေချေ`
- Unknown city/township: `Admin confirm`; no automatic delivery fee

## Admin Notification

`ADMIN_CHAT_ID` must be a numeric Telegram user ID or group ID. Do not use an `@username`.

Use `@userinfobot` in Telegram to get the numeric ID, or have the official admin Telegram account open this bot and send `/id`. The admin account must send `/start` to this bot once before the bot can message it.

Then set the numeric ID in Render:

```env
ADMIN_CHAT_ID=123456789
```

Multiple admins are supported:

```env
ADMIN_CHAT_ID=123456789,987654321
```

Cancel texts supported:

- `Cancel`
- `❌ Cancel`
- `မလုပ်တော့ပါ`
- `မလုပ်တော့ဘူး`
- `မလုပ်တော့ပါဘူး`
- `မယူတော့ပါ`
