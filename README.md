# NetworkGuard ML

An end-to-end Machine Learning-powered Network Intrusion Detection System (NIDS).

Traditional signature-based approaches struggle with mutating patterns, large traffic volumes, and zero-day anomalies. NetworkGuard ML solves this by bridging the gap between raw network traffic and machine learning inference. Built as an operational platform and educational tool for cybersecurity labs, it provides a complete pipeline from dataset ingestion to real-time threat visualization.

## Architecture
- **Frontend:** Next.js 14, React, Tailwind CSS, Recharts (Strict Minimalist Monochrome UI)
- **Backend:** FastAPI, Python 3.11, scikit-learn, XGBoost, Pandas
- **Database:** PostgreSQL via SQLAlchemy ORM
- **Capture Engine:** Python-based traffic simulator for real-time inference testing

## Core Capabilities
- **Real-Time Threat Feed:** Streams and predicts on incoming network traffic instantly via the `/predict` API.
- **Hot-Swappable ML Models:** Change the active inference model (e.g., from Logistic Regression to XGBoost) in memory with zero downtime.
- **Dynamic Model Training:** Upload standard NSL-KDD datasets and train new ML pipelines asynchronously directly from the UI.
- **Alert Management:** Triages anomalous traffic into an actionable queue where analysts can Acknowledge or Resolve incidents.

## Quickstart

Ensure you have [Docker](https://www.docker.com/) and Docker Compose installed on your host machine.

1. Clone the repository:
   ```bash
   git clone https://github.com/Vishwajeet2005/NetworkGuard-ML.git
   cd NetworkGuard-ML
   ```

2. Start the microservices:
   ```bash
   docker compose up --build -d
   ```

3. Access the dashboard:
   - **URL:** [http://localhost:3000](http://localhost:3000)
   - **Username:** `admin`
   - **Password:** `admin`

## Project Structure
- `/frontend` - Next.js Application Router and UI components.
- `/backend` - FastAPI server, ML pipeline logic, and database schema.
- `/capture` - Simulator script that loops dataset rows to test the prediction endpoint.
- `/artifacts` - Shared volume storing trained `.joblib` model binaries and preprocessors.

## Disclaimer
This software is designed for educational and laboratory environments. Ensure proper authorization before deploying active capture engines onto production enterprise networks.
