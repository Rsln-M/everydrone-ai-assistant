# everydrone-ai-assistant

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/Rsln-M/everydrone-ai-assistant.git
```

### 2. Create a database and paste the details to the connection pool in agent-backend/src/agent.ts

```bash
postgresql://user:password@localhost:port/database-name
```

### 3. Open two terminals, install packages, add .env file and run

```bash
cd everydrone-ai-assistant/frontend
npm install
npm run dev
```

```bash
cd everydrone-ai-assistant/agent-backend
npm install
echo "OPENAI_API_KEY=sk-..." > .env
npm run dev
```
