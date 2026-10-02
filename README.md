# Secure Exam System

A web application for creating and taking online exams. The frontend is built with React and Vite; the API uses Express, MongoDB, and Mongoose.

## Features

- Student registration, email verification, password reset, and profiles
- Admin exam and question management, including CSV question import
- Scheduled exams, access codes, autosaved attempts, and result reporting
- Role-protected student and admin routes

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- A MongoDB database, local or hosted

## Setup

Install dependencies in each application directory:

```sh
cd server
npm install
```

```sh
cd frontend
npm install
```

Create `server/.env` with the backend configuration. Keep real credentials private and do not commit this file.

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/secureexam
JWT_SECRET=replace-with-a-long-random-secret
PORT=5000
FRONTEND_URL=http://localhost:5173

# Needed for email verification and password-reset messages
EMAIL_USER=your-sender@gmail.com
EMAIL_PASS=your-gmail-app-password
# Optional; defaults to EMAIL_USER
EMAIL_FROM=SecureExam Portal <your-sender@gmail.com>

# Set this if your admin-registration flow requires a shared secret
ADMIN_SECRET=replace-with-a-private-admin-secret
```

For Gmail, use an app password rather than your regular account password. `FRONTEND_URL` must be the browser-visible frontend origin used in password-reset links. `PORT` defaults to `5000` if omitted.

## Run locally

Start the API in one terminal:

```sh
cd server
npm run dev
```

Start the frontend in another terminal:

```sh
cd frontend
npm run dev
```

Open the Vite URL shown in the frontend terminal (usually `http://localhost:5173`). During development, Vite proxies `/api` requests to `http://localhost:5000`. Set `VITE_API_BASE_URL` in `frontend/.env` only when the API is hosted at a different base URL.

## Checks

Run the backend regression tests:

```sh
cd server
npm test
```

Run frontend lint and production build:

```sh
cd frontend
npm run lint
npm run build
```

For audit findings and project status, see [ProjectAudit.md](ProjectAudit.md).