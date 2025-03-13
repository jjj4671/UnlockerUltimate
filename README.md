# BrightProxyTester

A tool for testing proxies and unlockers.

## Local Development Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL (optional, the app will use in-memory storage if no database is available)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

### Environment Setup

Create a `.env` file in the root directory with the following variables:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/brightproxy
PORT=5000
```

If you don't have PostgreSQL installed, the application will use in-memory storage.

### Running the Application

To start the development server:

```bash
npm run dev
```

The application will be available at http://localhost:5000

### Building for Production

To build the application for production:

```bash
npm run build
```

To start the production server:

```bash
npm start
```

## Features

- Proxy testing
- Unlocker testing with A/B testing capabilities
- Test history and results management
- Settings management 