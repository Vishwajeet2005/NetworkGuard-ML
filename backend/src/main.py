import os
import joblib
import pandas as pd
import numpy as np
import threading
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from .database import engine, Base, get_db, Dataset, Model, ModelMetric, Prediction, Alert, DashboardMetric, SystemStatus
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import shutil
import json
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, f1_score
from sklearn.model_selection import train_test_split

# Initialize DB tables
Base.metadata.create_all(bind=engine)

os.makedirs('/app/uploads', exist_ok=True)
os.makedirs('/app/artifacts', exist_ok=True)

app = FastAPI(title="NetworkGuard ML API Phase 2")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Models
ARTIFACTS_PATH = os.getenv("ARTIFACTS_PATH", "/app/artifacts")
UPLOADS_PATH = os.getenv("UPLOADS_PATH", "/app/uploads")
monitoring_active = True
model_lock = threading.Lock()

try:
    preprocessor = joblib.load(os.path.join(ARTIFACTS_PATH, "preprocessor.joblib"))
    ml_model = joblib.load(os.path.join(ARTIFACTS_PATH, "XGBoost.joblib"))
    print("Models loaded successfully.")
except Exception as e:
    print(f"Failed to load models: {e}")
    preprocessor = None
    ml_model = None

LABEL_MAP = {
    0: "DoS",
    1: "NORMAL",
    2: "Probe",
    3: "R2L",
    4: "U2R"
}

# Seed Phase 1 artifacts into DB on startup
@app.on_event("startup")
def seed_phase1_models():
    metrics_path = os.path.join(ARTIFACTS_PATH, "metrics.json")
    if not os.path.exists(metrics_path):
        return
    with open(metrics_path) as f:
        all_metrics = json.load(f)
    
    db = next(get_db())
    try:
        algo_map = {
            "LogReg": "LogisticRegression",
            "DecisionTree": "DecisionTree",
            "RandomForest": "RandomForest",
            "XGBoost": "XGBoost"
        }
        for short_name, algo_full in algo_map.items():
            # Only seed if no model with this algorithm exists yet
            existing = db.query(Model).filter(Model.algorithm == algo_full).first()
            if existing:
                # Ensure __overall__ metric exists
                overall = db.query(ModelMetric).filter(
                    ModelMetric.model_id == existing.id,
                    ModelMetric.class_name == "__overall__"
                ).first()
                if not overall and short_name in all_metrics:
                    m = all_metrics[short_name]
                    report = m.get("report", {})
                    macro = report.get("macro avg", {})
                    db.add(ModelMetric(
                        model_id=existing.id,
                        class_name="__overall__",
                        precision=macro.get("precision"),
                        recall=macro.get("recall"),
                        f1=m.get("macro_f1"),
                        support=int(macro.get("support", 0)),
                        accuracy=report.get("accuracy"),
                        roc_auc=m.get("roc_auc"),
                        confusion_matrix=m.get("confusion_matrix"),
                        full_report=report,
                    ))
                    db.commit()
                continue

            if short_name not in all_metrics:
                continue
            m = all_metrics[short_name]
            report = m.get("report", {})
            macro = report.get("macro avg", {})
            model_path = os.path.join(ARTIFACTS_PATH, f"{short_name}.joblib")
            new_model = Model(
                name=f"Phase1_{short_name}",
                algorithm=algo_full,
                version="1.0",
                status="ACTIVE" if short_name == "XGBoost" else "READY",
                model_path=model_path,
                preprocessor_path=os.path.join(ARTIFACTS_PATH, "preprocessor.joblib"),
                dataset_name="NSL-KDD (KDDTrain+)",
                training_date=datetime.utcnow(),
            )
            db.add(new_model)
            db.flush()
            db.add(ModelMetric(
                model_id=new_model.id,
                class_name="__overall__",
                precision=macro.get("precision"),
                recall=macro.get("recall"),
                f1=m.get("macro_f1"),
                support=int(macro.get("support", 0)),
                accuracy=report.get("accuracy"),
                roc_auc=m.get("roc_auc"),
                confusion_matrix=m.get("confusion_matrix"),
                full_report=report,
            ))
            # Per-class metrics
            for cls_name, cls_data in report.items():
                if cls_name in ("accuracy", "macro avg", "weighted avg"):
                    continue
                db.add(ModelMetric(
                    model_id=new_model.id,
                    class_name=cls_name,
                    precision=cls_data.get("precision"),
                    recall=cls_data.get("recall"),
                    f1=cls_data.get("f1-score"),
                    support=int(cls_data.get("support", 0)),
                ))
            db.commit()
            print(f"Seeded Phase 1 model: {short_name}")
    except Exception as e:
        print(f"Seeding error: {e}")
        db.rollback()
    finally:
        db.close()

# Schemas
class DatasetCreate(BaseModel):
    name: str
    path: str

class ModelCreate(BaseModel):
    name: str
    version: str
    status: str

class PredictRequest(BaseModel):
    model_id: int
    features: Dict[str, Any]

class BatchPredictRequest(BaseModel):
    model_id: int
    records: List[Dict[str, Any]]

class AlertUpdate(BaseModel):
    status: str

class TrainRequest(BaseModel):
    dataset_id: int
    model_name: str
    algorithm: str
    parameters: Optional[Dict[str, Any]] = None

# Helper function for training
def train_model_task(dataset_id: int, model_name: str, algorithm: str, model_id: int):
    from .database import SessionLocal
    db = SessionLocal()
    model_record = None
    try:
        model_record = db.query(Model).filter(Model.id == model_id).first()
        if not model_record:
            return
            
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            model_record.status = "FAILED"
            db.commit()
            return
            
        # 1. Load the dataset CSV
        df = pd.read_csv(dataset.file_path)
        
        # 2. Apply NSL-KDD column logic
        CATEGORICAL_COLS = ["protocol_type", "service", "flag"]
        
        # Determine numeric cols from dataframe since we don't have all NSL-KDD strictly
        NUMERIC_COLS = [c for c in df.columns if c not in CATEGORICAL_COLS + [dataset.label_column, "difficulty"]]
        
        MULTICLASS_MAP = {
            "normal": "NORMAL",
            "neptune": "DoS", "smurf": "DoS", "pod": "DoS", "teardrop": "DoS", "land": "DoS", "back": "DoS", "apache2": "DoS", "udpstorm": "DoS", "processtable": "DoS", "mailbomb": "DoS",
            "ipsweep": "Probe", "nmap": "Probe", "portsweep": "Probe", "satan": "Probe", "mscan": "Probe", "saint": "Probe",
            "guess_passwd": "R2L", "ftp_write": "R2L", "imap": "R2L", "phf": "R2L", "multihop": "R2L", "warezmaster": "R2L", "warezclient": "R2L", "spy": "R2L", "xlock": "R2L", "xsnoop": "R2L", "snmpguess": "R2L", "snmpgetattack": "R2L", "httptunnel": "R2L", "sendmail": "R2L", "named": "R2L",
            "buffer_overflow": "U2R", "loadmodule": "U2R", "rootkit": "U2R", "perl": "U2R", "sqlattack": "U2R", "xterm": "U2R", "ps": "U2R",
        }
        
        if "difficulty" in df.columns:
            df.drop(columns=["difficulty"], inplace=True)
            
        df.replace([np.inf, -np.inf], np.nan, inplace=True)
        df.dropna(inplace=True)
        df.drop_duplicates(inplace=True)
        df[dataset.label_column] = df[dataset.label_column].map(MULTICLASS_MAP).fillna(df[dataset.label_column])
        df.dropna(subset=[dataset.label_column], inplace=True)
        
        X = df.drop(columns=[dataset.label_column])
        y = df[dataset.label_column]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        train_preprocessor = ColumnTransformer(transformers=[
            ("num", StandardScaler(), NUMERIC_COLS),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_COLS),
        ])
        
        X_train_processed = train_preprocessor.fit_transform(X_train)
        X_test_processed = train_preprocessor.transform(X_test)
        
        is_xgb = algorithm == 'XGBoost'
        le = LabelEncoder() if is_xgb else None
        
        if algorithm == 'LogisticRegression':
            t_model = LogisticRegression(max_iter=1000, class_weight='balanced')
        elif algorithm == 'DecisionTree':
            t_model = DecisionTreeClassifier(class_weight='balanced')
        elif algorithm == 'RandomForest':
            t_model = RandomForestClassifier(n_estimators=100, class_weight='balanced')
        elif algorithm == 'XGBoost':
            t_model = XGBClassifier(use_label_encoder=False, eval_metric='mlogloss')
        else:
            t_model = LogisticRegression(max_iter=1000, class_weight='balanced')

        y_train_target = le.fit_transform(y_train) if is_xgb else y_train
        t_model.fit(X_train_processed, y_train_target)
        
        y_test_target = le.transform(y_test) if is_xgb else y_test
        y_pred = t_model.predict(X_test_processed)
        y_proba = t_model.predict_proba(X_test_processed)
        
        classes = le.classes_.tolist() if is_xgb else sorted(y.unique().tolist())
        
        macro_f1 = float(f1_score(y_test_target, y_pred, average='macro'))
        try:
            roc_auc = float(roc_auc_score(y_test_target, y_proba, multi_class='ovr', average='macro'))
        except:
            roc_auc = 0.0
        cm = confusion_matrix(y_test_target, y_pred).tolist()
        report = classification_report(y_test_target, y_pred, target_names=classes, output_dict=True)
        acc = report.get('accuracy', 0.0)
        
        model_filename = f"{model_name}_{model_id}.joblib"
        preprocessor_filename = f"preprocessor_{model_id}.joblib"
        
        joblib.dump(t_model, os.path.join(ARTIFACTS_PATH, model_filename))
        joblib.dump(train_preprocessor, os.path.join(ARTIFACTS_PATH, preprocessor_filename))
        
        model_record.status = "READY"
        model_record.model_path = os.path.join(ARTIFACTS_PATH, model_filename)
        model_record.preprocessor_path = os.path.join(ARTIFACTS_PATH, preprocessor_filename)
        model_record.training_date = datetime.utcnow()
        db.commit()
        
        metric_record = ModelMetric(
            model_id=model_id,
            class_name="__overall__",
            precision=float(report['macro avg']['precision']),
            recall=float(report['macro avg']['recall']),
            f1=macro_f1,
            support=int(report['macro avg']['support']),
            accuracy=acc,
            roc_auc=roc_auc,
            confusion_matrix=cm,
            full_report=report
        )
        db.add(metric_record)
        
        for cls in classes:
            if cls in report and isinstance(report[cls], dict):
                cls_metric = ModelMetric(
                    model_id=model_id,
                    class_name=cls,
                    precision=float(report[cls]['precision']),
                    recall=float(report[cls]['recall']),
                    f1=float(report[cls]['f1-score']),
                    support=int(report[cls]['support'])
                )
                db.add(cls_metric)
        db.commit()
        
    except Exception as e:
        print(f"Training failed: {e}")
        if model_record:
            model_record.status = "FAILED"
            db.commit()
    finally:
        db.close()

# Endpoints
@app.post("/datasets/upload")
def upload_dataset(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # SECURITY FIX: Prevent Path Traversal by extracting only the basename
    import uuid
    safe_filename = os.path.basename(file.filename)
    if not safe_filename or '..' in safe_filename:
        safe_filename = f"dataset_{uuid.uuid4().hex}.csv"
        
    if not safe_filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")
        
    file_path = os.path.join(UPLOADS_PATH, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # MEMORY FIX: Only read the first 5 rows for metadata extraction to prevent OOM
    try:
        preview_df = pd.read_csv(file_path, nrows=5)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV format: {e}")
        
    feature_count = preview_df.shape[1]
    
    # Calculate row count without loading into RAM
    row_count = sum(1 for _ in open(file_path, 'rb')) - 1
    
    label_cols = [c for c in preview_df.columns if c.lower() in ['label', 'class', 'attack_cat']]
    label_column = label_cols[0] if label_cols else None
    
    # Estimate missing values for preview
    missing_values = int(preview_df.isnull().sum().sum())
    column_names = preview_df.columns.tolist()
    
    # Fill nan to prevent json errors
    preview_df = preview_df.fillna("")
    preview = preview_df.to_dict(orient="records")
    
    dataset = Dataset(
        name=safe_filename,
        file_path=file_path,
        row_count=row_count,
        feature_count=feature_count,
        label_column=label_column
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    
    return {
        "id": dataset.id,
        "name": dataset.name,
        "file_path": dataset.file_path,
        "row_count": dataset.row_count,
        "feature_count": dataset.feature_count,
        "label_column": dataset.label_column,
        "missing_values": missing_values,
        "column_names": column_names,
        "preview": preview
    }

@app.get("/datasets")
def get_datasets(db: Session = Depends(get_db)):
    return db.query(Dataset).all()

@app.get("/datasets/{id}")
def get_dataset(id: int, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    df = pd.read_csv(dataset.file_path)
    df = df.fillna("")
    return {
        "dataset": dataset,
        "column_names": df.columns.tolist(),
        "preview": df.head(5).to_dict(orient="records")
    }

@app.get("/models")
def get_models(db: Session = Depends(get_db)):
    models = db.query(Model).filter(Model.status != "DELETED").all()
    results = []
    for m in models:
        # Fetch aggregate metrics for this model
        metric = db.query(ModelMetric).filter(
            ModelMetric.model_id == m.id,
            ModelMetric.class_name == "__overall__"
        ).first()
        results.append({
            "id": m.id,
            "name": m.name,
            "algorithm": m.algorithm or m.name,
            "version": m.version,
            "status": m.status,
            "dataset_name": m.dataset_name,
            "training_date": m.training_date.isoformat() if m.training_date else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "macro_f1": metric.f1 if metric else None,
            "accuracy": metric.accuracy if metric else None,
            "roc_auc": metric.roc_auc if metric else None,
            "metrics": {
                "classification_report": metric.full_report if metric and metric.full_report else {},
                "confusion_matrix": metric.confusion_matrix if metric and metric.confusion_matrix else []
            }
        })
    return results

@app.delete("/models/{id}")
def delete_model(id: int, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    if model.status == "ACTIVE":
        raise HTTPException(status_code=400, detail="Cannot delete the currently active model. Switch to another model first.")
    
    model.status = "DELETED"
    db.commit()
    return {"status": "success"}

@app.post("/models")
def create_model(model: ModelCreate, db: Session = Depends(get_db)):
    db_model = Model(**model.model_dump())
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model

@app.post("/models/train")
def train_model(req: TrainRequest, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    model = Model(
        name=req.model_name,
        version="1.0",
        status="TRAINING",
        algorithm=req.algorithm,
        dataset_id=req.dataset_id,
        dataset_name=dataset.name
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    
    thread = threading.Thread(target=train_model_task, args=(req.dataset_id, req.model_name, req.algorithm, model.id))
    thread.start()
    
    return {"status": "training_started", "model_id": model.id}

@app.get("/models/{id}")
def get_model(id: int, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model

@app.get("/models/{id}/status")
def get_model_status(id: int, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"status": model.status}

@app.patch("/models/{id}/activate")
def activate_model(id: int, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
        
    # Set all active models to READY
    active_models = db.query(Model).filter(Model.status == "ACTIVE").all()
    for m in active_models:
        m.status = "READY"
        
    # Set the target model to ACTIVE
    model.status = "ACTIVE"
    db.commit()
    
    # Reload model into global memory cache
    global ml_model, preprocessor
    try:
        if model.model_path and model.preprocessor_path:
            with model_lock:
                ml_model = joblib.load(model.model_path)
                preprocessor = joblib.load(model.preprocessor_path)
            print(f"Hot-reloaded model {model.name} into memory.")
    except Exception as e:
        print(f"Failed to hot-reload model: {e}")
        raise HTTPException(status_code=500, detail="Failed to load model into memory")
        
    return {"status": "success", "active_model_id": model.id}

@app.get("/models/{id}/metrics")
def get_model_metrics(id: int, db: Session = Depends(get_db)):
    metrics = db.query(ModelMetric).filter(ModelMetric.model_id == id).all()
    if not metrics:
        return []
    return metrics

@app.get("/models/comparison")
def get_models_comparison(db: Session = Depends(get_db)):
    models = db.query(Model).filter(Model.status == 'READY').all()
    comp = []
    for m in models:
        metric = db.query(ModelMetric).filter(ModelMetric.model_id == m.id, ModelMetric.class_name == 'overall').first()
        if metric:
            comp.append({
                "model_id": m.id,
                "name": m.name,
                "algorithm": m.algorithm,
                "accuracy": metric.accuracy,
                "macro_f1": metric.f1,
                "roc_auc": metric.roc_auc
            })
    return comp

def get_loaded_model(model_id: int, db: Session):
    model_record = db.query(Model).filter(Model.id == model_id).first()
    is_xgb = model_record.algorithm == 'XGBoost' if model_record else True
    
    with model_lock:
        return ml_model, preprocessor, is_xgb

@app.post("/predict")
def predict(req: PredictRequest, db: Session = Depends(get_db)):
    if not db.query(Model).filter(Model.id == req.model_id).first():
        db.add(Model(id=req.model_id, name="XGBoost_Real", version="1.0", status="ACTIVE"))
        db.commit()

    m_model, m_preprocessor, is_xgb = get_loaded_model(req.model_id, db)
    
    if m_model and m_preprocessor:
        df = pd.DataFrame([req.features])
        if 'label' in df.columns:
            df = df.drop(columns=['label'])
        if 'difficulty' in df.columns:
            df = df.drop(columns=['difficulty'])
            
        try:
            X_proc = m_preprocessor.transform(df)
            pred_idx = m_model.predict(X_proc)[0]
            proba = m_model.predict_proba(X_proc)[0]
            
            if is_xgb:
                pred_label = LABEL_MAP.get(int(pred_idx), "NORMAL")
            else:
                pred_label = str(pred_idx)
                
            confidence = round(float(np.max(proba)), 4)
        except Exception as e:
            print(f"Predict error: {e}")
            pred_label = "ERROR"
            confidence = 0.0
    else:
        pred_label = "NORMAL"
        confidence = 1.0
        
    is_malicious = (pred_label != "NORMAL")
    db_pred = Prediction(model_id=req.model_id, features=req.features, prediction=pred_label, confidence=confidence)
    db.add(db_pred)
    db.commit()
    db.refresh(db_pred)
    
    if is_malicious:
        severity = "CRITICAL" if pred_label in ["U2R"] else "HIGH" if pred_label == "DoS" else "MEDIUM"
        alert = Alert(prediction_id=db_pred.id, severity=severity)
        db.add(alert)
        db.commit()
        
    return db_pred

@app.post("/predict/batch")
def predict_batch(req: BatchPredictRequest, db: Session = Depends(get_db)):
    m_model, m_preprocessor, is_xgb = get_loaded_model(req.model_id, db)
    
    results = []
    
    if not m_model or not m_preprocessor:
        for r in req.records:
            results.append({"prediction": "NORMAL", "confidence": 1.0})
        return results
        
    df = pd.DataFrame(req.records)
    if 'label' in df.columns:
        df = df.drop(columns=['label'])
    if 'difficulty' in df.columns:
        df = df.drop(columns=['difficulty'])
        
    try:
        X_proc = m_preprocessor.transform(df)
        preds = m_model.predict(X_proc)
        probas = m_model.predict_proba(X_proc)
        
        for i in range(len(preds)):
            pred_idx = preds[i]
            if is_xgb:
                pred_label = LABEL_MAP.get(int(pred_idx), "NORMAL")
            else:
                pred_label = str(pred_idx)
            confidence = round(float(np.max(probas[i])), 4)
            results.append({"prediction": pred_label, "confidence": confidence})
    except Exception as e:
        print(f"Batch predict error: {e}")
        for r in req.records:
            results.append({"prediction": "ERROR", "confidence": 0.0})
            
    return results

@app.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(500).all()
    results = []
    for a in alerts:
        pred = db.query(Prediction).filter(Prediction.id == a.prediction_id).first()
        features = pred.features if pred and isinstance(pred.features, dict) else {}
        results.append({
            "id": a.id,
            "severity": a.severity,
            "status": a.status,
            "prediction": pred.prediction if pred else "UNKNOWN",
            "confidence": pred.confidence if pred else 0.0,
            "timestamp": pred.timestamp.isoformat() if pred and pred.timestamp else a.created_at.isoformat(),
            "prediction_id": a.prediction_id,
            "details": {
                "src": f"192.168.{(a.id % 10) + 1}.{(a.prediction_id or 0) % 254 + 1}",
                "dst": f"10.0.0.{(a.prediction_id or 0) % 254 + 1}",
                "protocol": features.get("protocol_type", "tcp"),
                "raw_features": features,
            }
        })
    return results

@app.get("/alerts/{alert_id}")
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    pred = db.query(Prediction).filter(Prediction.id == a.prediction_id).first()
    features = pred.features if pred and isinstance(pred.features, dict) else {}
    return {
        "id": a.id,
        "severity": a.severity,
        "status": a.status,
        "prediction": pred.prediction if pred else "UNKNOWN",
        "confidence": pred.confidence if pred else 0.0,
        "timestamp": pred.timestamp.isoformat() if pred and pred.timestamp else a.created_at.isoformat(),
        "prediction_id": a.prediction_id,
        "details": {
            "src": f"192.168.{(a.id % 10) + 1}.{(a.prediction_id or 0) % 254 + 1}",
            "dst": f"10.0.0.{(a.prediction_id or 0) % 254 + 1}",
            "protocol": features.get("protocol_type", "tcp"),
            "raw_features": features,
        }
    }

@app.patch("/alerts/{alert_id}")
def update_alert(alert_id: int, alert_update: AlertUpdate, db: Session = Depends(get_db)):
    db_alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not db_alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db_alert.status = alert_update.status
    db.commit()
    db.refresh(db_alert)
    return {"id": db_alert.id, "status": db_alert.status}

@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    preds = db.query(Prediction).order_by(Prediction.timestamp.desc()).limit(1000).all()
    tp, fn = 0, 0
    for p in preds:
        if not isinstance(p.features, dict): continue
        raw = p.features.get("label", "normal").lower()
        is_mal = raw != "normal"
        pred_mal = p.prediction != "NORMAL"
        if is_mal and pred_mal: tp += 1
        elif is_mal and not pred_mal: fn += 1
    det_rate = round((tp / (tp + fn) * 100), 1) if (tp + fn) > 0 else 100.0
    
    try:
        load1 = os.getloadavg()[0]
        sys_load = min(100.0, round((load1 / max(1, os.cpu_count() or 1)) * 100, 1))
    except:
        sys_load = 21.9
        
    return {
        "total_alerts": db.query(Alert).count(),
        "total_predictions": db.query(Prediction).count(),
        "detection_rate": det_rate,
        "system_load": sys_load
    }

@app.get("/dashboard/charts")
def get_dashboard_charts(db: Session = Depends(get_db)):
    total = max(1, db.query(Alert).count())
    dos = db.query(Alert).filter(Alert.severity == "HIGH").count()
    probe = db.query(Alert).filter(Alert.severity == "MEDIUM").count()
    u2r = db.query(Alert).filter(Alert.severity == "CRITICAL").count()
    from collections import defaultdict
    recent_preds = db.query(Prediction.timestamp, Prediction.prediction).order_by(Prediction.timestamp.desc()).limit(4000).all()
    buckets = defaultdict(lambda: {"requests": 0, "alerts": 0})
    for ts, pred in recent_preds:
        minute_str = ts.strftime("%H:%M")
        buckets[minute_str]["requests"] += 1
        if pred != "NORMAL": buckets[minute_str]["alerts"] += 1
    
    alerts_over_time = [{"time": k, "requests": v["requests"], "alerts": v["alerts"]} for k, v in sorted(buckets.items())][-20:]
    
    if not alerts_over_time:
        alerts_over_time = [{"time": "Live", "requests": 0, "alerts": 0}]

    return {
        "alerts_over_time": alerts_over_time,
        "severity_distribution": [
            {"label": "DoS", "val": int(dos/total*100), "color": "bg-red-500"},
            {"label": "Probe", "val": int(probe/total*100), "color": "bg-amber-500"},
            {"label": "U2R", "val": int(u2r/total*100), "color": "bg-purple-500"}
        ]
    }

@app.get("/dashboard/telemetry")
def get_dashboard_telemetry(db: Session = Depends(get_db)):
    preds = db.query(Prediction).order_by(Prediction.timestamp.desc()).limit(200).all()
    return [
        {
            "id": p.id,
            "timestamp": p.timestamp.strftime("%H:%M:%S"),
            "protocol": p.features.get("protocol_type", "TCP") if isinstance(p.features, dict) else "TCP",
            "src": f"192.168.1.{p.id % 255}",
            "dst": f"10.0.0.{p.features.get('dst_bytes', 0) % 255}" if isinstance(p.features, dict) else "10.0.0.1",
            "length": p.features.get("src_bytes", 0) if isinstance(p.features, dict) else 0,
            "flags": p.features.get("flag", "SF") if isinstance(p.features, dict) else "SF",
            "classification": p.prediction,
            "confidence": p.confidence,
            "raw_features": p.features
        } for p in preds
    ]

@app.get("/monitor/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@app.get("/monitor/logs")
def get_monitor_logs(db: Session = Depends(get_db)):
    return db.query(SystemStatus).order_by(SystemStatus.timestamp.desc()).limit(100).all()

@app.post("/monitor/start")
def start_monitor():
    global monitoring_active
    monitoring_active = True
    return {"status": "monitoring_started"}

@app.post("/monitor/stop")
def stop_monitor():
    global monitoring_active
    monitoring_active = False
    return {"status": "monitoring_stopped"}

@app.get("/monitor/status")
def get_monitor_status():
    return {"monitoring_active": monitoring_active, "capture_health": "ok"}
