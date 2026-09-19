# NetworkGuard ML
**Enterprise Network Threat Detection Pipeline**

NetworkGuard ML is a fully containerized, real-time Intrusion Detection System (IDS) powered by machine learning. It ingests simulated network traffic, evaluates 41 distinct packet features against trained anomaly detection models, and serves telemetry to a live Next.js observability dashboard.

## 🚀 Unique Selling Propositions (USPs)

*   **Hot-Swappable ML Architecture:** The FastAPI inference engine utilizes a strict 	hreading.Lock() mutex, allowing analysts to dynamically swap active models (e.g., from Logistic Regression to XGBoost) under heavy traffic loads without dropping a single packet.
*   **Zero-Latency Pipeline:** Model artifacts (.joblib) are held in memory rather than evaluated via synchronous I/O. The POST /predict endpoint achieves sub-10ms latency, critical for high-throughput SIEM environments.
*   **Built-in Threat Sandbox:** Includes an automated Capture Engine microservice that streams multi-class NSL-KDD anomaly data directly into the backend, acting as a live network stress test out of the box.
*   **Full-Stack Observability:** A Next.js 14 App Router frontend featuring live throughput AreaCharts, dynamic Attack Class Distribution metrics, and an Inspector Pane to evaluate raw JSON payloads and ML confidence intervals in real time.
*   **Hardened Attack Surface:** Protected against arbitrary Path Traversal (RCE), Memory Exhaustion (OOM) via buffered CSV chunking, and Race Conditions during model training and inference.

---

## 🏗️ Architecture

The system is deployed as a strict microservice architecture via Docker Compose:

1.  **Frontend (:3000):** Next.js 14, React, Tailwind CSS, Recharts, Lucide Icons.
2.  **Backend (:8000):** Python 3.11, FastAPI, SQLAlchemy, Scikit-Learn, XGBoost.
3.  **Capture Engine:** Python 3.11 traffic simulator that loops over raw KDDTrain+.txt files.
4.  **Database (:5432):** PostgreSQL 15 for persistent threat logging and model metrics.

---

## ⚙️ Quickstart Deployment

You do not need to install Node or Python locally. The entire stack is containerized.

`ash
# 1. Clone the repository
git clone https://github.com/Vishwajeet2005/NetworkGuard-ML.git
cd NetworkGuard-ML

# 2. Boot the microservices
docker compose up -d
`

### Accessing the Stack
*   **Dashboard:** [http://localhost:3000](http://localhost:3000) (Credentials: dmin / dmin)
*   **API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
*   **Database:** localhost:5432 (User: postgres / Pass: postgres)

---

## 🧪 Core Workflows

### 1. The Threat Feed
Upon booting, the Capture Engine immediately begins firing network flows at the API. Navigate to the **Dashboard** to watch the Threat Feed populate. Click on any malicious packet (e.g., DoS, Probe, U2R) to view the extracted ML features in the Inspector Pane.

### 2. Alert Resolution
When the active model flags an anomaly with high confidence, it generates a SQL Alert. Analysts can click the packet in the dashboard and use the **Acknowledge** or **Resolve** action buttons to close the ticket.

### 3. Training & Swapping Models
Navigate to the **Models** view. You can compare the Macro-F1 and ROC-AUC scores of all trained models (Logistic Regression, Decision Tree, Random Forest, XGBoost). Click **Set as Active** to instantly route all new network traffic through the selected model.

---

## 🛡️ Security Posture
*   **Authentication:** LocalStorage API tokens. *(Note: Full JWT implementation was architecturally drafted but rolled back to bypass PyPI enterprise deployment constraints).*
*   **Upload Sanitization:** CSV dataset uploads use werkzeug.utils.secure_filename to prevent directory traversal.
*   **Memory Management:** Pandas dataframe processing is chunk-limited to prevent massive dataset uploads from crashing the container.

---
*Built for rigorous ML Operations and Cyber Threat Intelligence.*