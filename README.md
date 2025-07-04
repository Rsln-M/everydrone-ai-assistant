# everydrone-ai-assistant

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/Rsln-M/everydrone-ai-assistant.git
cd everydrone-ai-assistant
```

### 2. Open two terminals, install packages, add .env file and run

```bash
cd frontend
npm install
npm run dev
```

```bash
cd agent-backend
npm install
echo "OPENAI_API_KEY=sk-..." > .env
npm run dev
```
