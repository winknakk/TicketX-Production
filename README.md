# TicketX-Production

Production deployment repository for TicketX Customer Support Platform.

## 📁 Repository Structure

```text
├── system/
│   ├── backend/         # Fastify Core API, Database Migrations, Services & Adapters
│   └── frontend/        # React 19 + Vite Customer Portal & Admin Explorer
├── ops/                 # Docker Compose & Nginx Reverse Proxy configurations
├── Jenkinsfile          # Automated CI/CD Pipeline
└── .gitignore           # Clean Git exclusion rules
```

## 🚀 Quick Start (Server Deployment)

### 1. Run with Docker Compose
```bash
cd ops
cp .env.production.template .env.production
# Configure your secrets in .env.production
docker-compose up -d --build
```

### 2. CI/CD via Jenkins
Connect Jenkins to this repository and run the Pipeline with `Jenkinsfile`.
