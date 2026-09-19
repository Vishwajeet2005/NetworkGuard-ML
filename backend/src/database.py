from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/networkguard")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    file_path = Column(String)
    row_count = Column(Integer, nullable=True)
    feature_count = Column(Integer, nullable=True)
    label_column = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Model(Base):
    __tablename__ = "models"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    version = Column(String)
    status = Column(String)
    algorithm = Column(String, nullable=True)
    dataset_id = Column(Integer, nullable=True)
    preprocessor_path = Column(String, nullable=True)
    model_path = Column(String, nullable=True)
    feature_schema = Column(JSON, nullable=True)
    training_date = Column(DateTime, nullable=True)
    dataset_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ModelMetric(Base):
    __tablename__ = "model_metrics"
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("models.id"))
    class_name = Column(String)
    precision = Column(Float)
    recall = Column(Float)
    f1 = Column(Float)
    support = Column(Integer)
    accuracy = Column(Float, nullable=True)
    roc_auc = Column(Float, nullable=True)
    confusion_matrix = Column(JSON, nullable=True)
    full_report = Column(JSON, nullable=True)

class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("models.id"))
    features = Column(JSON)
    prediction = Column(String)
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id"))
    severity = Column(String)
    status = Column(String, default="NEW")
    created_at = Column(DateTime, default=datetime.utcnow)

class DashboardMetric(Base):
    __tablename__ = "dashboard_metrics"
    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String)
    metric_value = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

class SystemStatus(Base):
    __tablename__ = "system_status"
    id = Column(Integer, primary_key=True, index=True)
    component = Column(String)
    status = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
