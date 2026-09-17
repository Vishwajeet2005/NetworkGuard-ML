from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import engine, Base, get_db, Dataset, Model, ModelMetric, Prediction, Alert, DashboardMetric, SystemStatus
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime

# Initialize DB tables (ponytail mode: skip migrations, just create all)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="NetworkGuard ML API Phase 2")

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

class AlertUpdate(BaseModel):
    status: str

# 1. GET /datasets
@app.get("/datasets")
def get_datasets(db: Session = Depends(get_db)):
    return db.query(Dataset).all()

# 2. POST /datasets
@app.post("/datasets")
def create_dataset(dataset: DatasetCreate, db: Session = Depends(get_db)):
    db_dataset = Dataset(**dataset.model_dump())
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)
    return db_dataset

# 3. GET /models
@app.get("/models")
def get_models(db: Session = Depends(get_db)):
    return db.query(Model).all()

# 4. POST /models
@app.post("/models")
def create_model(model: ModelCreate, db: Session = Depends(get_db)):
    db_model = Model(**model.model_dump())
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model

# 5. GET /models/{model_id}
@app.get("/models/{model_id}")
def get_model(model_id: int, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model

# 6. POST /predict
@app.post("/predict")
def predict(req: PredictRequest, db: Session = Depends(get_db)):
    # Mock inference
    pred_label = "ATTACK" if req.features.get("wrong_fragment", 0) > 0 else "BENIGN"
    confidence = 0.95
    db_pred = Prediction(model_id=req.model_id, features=req.features, prediction=pred_label, confidence=confidence)
    db.add(db_pred)
    db.commit()
    db.refresh(db_pred)
    
    # Alert logic based on NSL-KDD
    severity_map = {"DoS": "HIGH", "Probe": "MEDIUM", "R2L": "HIGH", "U2R": "CRITICAL", "ATTACK": "HIGH"}
    if pred_label in severity_map:
        alert = Alert(prediction_id=db_pred.id, severity=severity_map[pred_label])
        db.add(alert)
        db.commit()
        
    return db_pred

# 7. GET /alerts
@app.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    return db.query(Alert).all()

# 8. GET /alerts/{alert_id}
@app.get("/alerts/{alert_id}")
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert

# 9. PATCH /alerts/{alert_id}
@app.patch("/alerts/{alert_id}")
def update_alert(alert_id: int, alert_update: AlertUpdate, db: Session = Depends(get_db)):
    db_alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not db_alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db_alert.status = alert_update.status
    db.commit()
    db.refresh(db_alert)
    return db_alert

# 10. GET /dashboard/stats
@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    return {"total_alerts": db.query(Alert).count(), "total_predictions": db.query(Prediction).count()}

# 11. GET /dashboard/charts
@app.get("/dashboard/charts")
def get_dashboard_charts(db: Session = Depends(get_db)):
    return {"alerts_over_time": [], "severity_distribution": []}

# 12. GET /monitor/health
@app.get("/monitor/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# 13. GET /monitor/logs
@app.get("/monitor/logs")
def get_monitor_logs(db: Session = Depends(get_db)):
    return db.query(SystemStatus).order_by(SystemStatus.timestamp.desc()).limit(100).all()
