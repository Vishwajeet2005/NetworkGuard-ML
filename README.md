# NetworkGuard ML

NetworkGuard ML is an end-to-end, machine learning-based Network Intrusion Detection System (NIDS) designed as a Final-Year Project. It simulates real-time network traffic ingestion, performs flow-based ML inference using the NSL-KDD dataset, and provides an interactive Next.js dashboard for security analysts to investigate alerts.

## Architecture

The system strictly follows a microservices architecture bounded by Docker Compose:

1.  **Frontend (`:3000`)**: Next.js 14 App Router, Tailwind CSS, Recharts. Provides the investigation dashboard and model metric comparisons.
2.  **Backend (`:8000`)**: FastAPI, SQLAlchemy, Alembic. Exposes 13 API endpoints for inference, alert generation, and system monitoring.
3.  **Capture Simulator**: A Python service that streams `KDDTest+.txt` to the backend to simulate real-time packet capture.
4.  **Database (`:5432`)**: PostgreSQL 15 storing all 7 core entities (Models, Alerts, Datasets, Predictions, etc.).

## Dataset Limitations & Engineering Decisions

This project was explicitly adapted to use the **NSL-KDD** dataset. 

*   **Architectural Fallback (Phase 4)**: Because NSL-KDD contains host-based application features (e.g., `num_root`, `su_attempted`, `num_file_creations`), it is technically impossible to extract these purely from live `NET_RAW` network packets via Scapy. Thus, the real-time capture module operates in a simulation mode, streaming the test CSV directly to the inference engine to demonstrate the pipeline's capabilities without hallucinating host features.
*   **Class Imbalance**: NSL-KDD possesses severe underrepresentation in the `U2R` (User-to-Root) and `R2L` (Remote-to-Local) attack classes. The models intentionally use `class_weight='balanced'` to heavily penalize missing these classes. 
*   **Evaluation Baseline**: Due to the introduction of novel zero-day attacks in `KDDTest+.txt` that do not exist in the training data, a baseline macro F1 score of ~58-60% (achieved by the XGBoost and Logistic Regression models) is the expected, mathematically sound academic result.

## Installation & Setup

### Prerequisites
*   **Docker Desktop** (Required for the 4-service stack)
*   Python 3.11 (Required only for offline Phase 1 training)

### 1. Offline Model Training (Phase 1)
Before booting the system, the ML models must be trained and the inference contract (`features.json`) generated.

1. Download `KDDTrain+.txt` and `KDDTest+.txt` into the `data/` directory.
2. Run the training script:
```bash
python training/train.py
```
This generates the `artifacts/` folder containing the preprocessor, models, and JSON metrics.

### 2. Booting the NIDS Platform (Phase 2-5)
Once artifacts are generated, spin up the entire distributed system:

```bash
docker compose up --build
```

The UI will be available at `http://localhost:3000`.

## Feature Contract

The inference engine is strictly bound by `artifacts/features.json`. Any simulated traffic that does not perfectly map to the exact 41-feature pre-encoded NSL-KDD schema will be actively rejected by the backend to prevent data pollution.
