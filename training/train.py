import pandas as pd
import numpy as np
import json
import joblib
from pathlib import Path
from abc import ABC, abstractmethod
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, f1_score

NSL_KDD_COLUMNS = [
    "duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes", "land", "wrong_fragment", "urgent",
    "hot", "num_failed_logins", "logged_in", "num_compromised", "root_shell", "su_attempted", "num_root", "num_file_creations",
    "num_shells", "num_access_files", "num_outbound_cmds", "is_host_login", "is_guest_login", "count", "srv_count",
    "serror_rate", "srv_serror_rate", "rerror_rate", "srv_rerror_rate", "same_srv_rate", "diff_srv_rate", "srv_diff_host_rate",
    "dst_host_count", "dst_host_srv_count", "dst_host_same_srv_rate", "dst_host_diff_srv_rate", "dst_host_same_src_port_rate",
    "dst_host_srv_diff_host_rate", "dst_host_serror_rate", "dst_host_srv_serror_rate", "dst_host_rerror_rate",
    "dst_host_srv_rerror_rate", "label", "difficulty"
]

CATEGORICAL_COLS = ["protocol_type", "service", "flag"]
NUMERIC_COLS = [c for c in NSL_KDD_COLUMNS if c not in CATEGORICAL_COLS + ["label", "difficulty"]]

MULTICLASS_MAP = {
    "normal": "NORMAL",
    "neptune": "DoS", "smurf": "DoS", "pod": "DoS", "teardrop": "DoS", "land": "DoS", "back": "DoS", "apache2": "DoS", "udpstorm": "DoS", "processtable": "DoS", "mailbomb": "DoS",
    "ipsweep": "Probe", "nmap": "Probe", "portsweep": "Probe", "satan": "Probe", "mscan": "Probe", "saint": "Probe",
    "guess_passwd": "R2L", "ftp_write": "R2L", "imap": "R2L", "phf": "R2L", "multihop": "R2L", "warezmaster": "R2L", "warezclient": "R2L", "spy": "R2L", "xlock": "R2L", "xsnoop": "R2L", "snmpguess": "R2L", "snmpgetattack": "R2L", "httptunnel": "R2L", "sendmail": "R2L", "named": "R2L",
    "buffer_overflow": "U2R", "loadmodule": "U2R", "rootkit": "U2R", "perl": "U2R", "sqlattack": "U2R", "xterm": "U2R", "ps": "U2R",
}

class BaseNIDSModel(ABC):
    @abstractmethod
    def train(self, X, y): pass
    @abstractmethod
    def predict(self, X): pass
    @abstractmethod
    def evaluate(self, X, y): pass

class NIDSWrapper(BaseNIDSModel):
    def __init__(self, model, is_xgb=False):
        self.model = model
        self.is_xgb = is_xgb
        self.le = LabelEncoder() if is_xgb else None

    def train(self, X, y):
        y_target = self.le.fit_transform(y) if self.is_xgb else y
        self.model.fit(X, y_target)

    def predict(self, X):
        y_pred = self.model.predict(X)
        return self.le.inverse_transform(y_pred) if self.is_xgb else y_pred

    def evaluate(self, X, y):
        y_target = self.le.transform(y) if self.is_xgb else y
        y_pred = self.model.predict(X)
        y_proba = self.model.predict_proba(X)
        classes = self.le.classes_.tolist() if self.is_xgb else sorted(y.unique().tolist())
        
        return {
            "macro_f1": f1_score(y_target, y_pred, average='macro'),
            "roc_auc": roc_auc_score(y_target, y_proba, multi_class='ovr', average='macro'),
            "confusion_matrix": confusion_matrix(y_target, y_pred).tolist(),
            "report": classification_report(y_target, y_pred, target_names=classes, output_dict=True)
        }

def load_data():
    base_dir = Path(__file__).resolve().parent.parent
    train_path = base_dir / "data/KDDTrain+.txt"
    test_path = base_dir / "data/KDDTest+.txt"
    if not train_path.exists() or not test_path.exists():
        raise FileNotFoundError(f"Missing {train_path} or {test_path} in data/")

    train = pd.read_csv(train_path, header=None, names=NSL_KDD_COLUMNS)
    test = pd.read_csv(test_path, header=None, names=NSL_KDD_COLUMNS)

    for df in [train, test]:
        df.drop(columns=["difficulty"], inplace=True)
        df.replace([np.inf, -np.inf], np.nan, inplace=True)
        df.dropna(inplace=True)
        df.drop_duplicates(inplace=True)
        df["label"] = df["label"].map(MULTICLASS_MAP)
        df.dropna(subset=["label"], inplace=True)

    return train, test

def main():
    print("Loading data...")
    train, test = load_data()
    
    X_train, y_train = train.drop(columns=["label"]), train["label"]
    X_test, y_test = test.drop(columns=["label"]), test["label"]
    classes = sorted(y_train.unique().tolist())
    
    print("Building preprocessor...")
    preprocessor = ColumnTransformer(transformers=[
        ("num", StandardScaler(), NUMERIC_COLS),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_COLS),
    ])
    
    X_train_processed = preprocessor.fit_transform(X_train)
    X_test_processed = preprocessor.transform(X_test)

    artifacts_dir = Path(__file__).resolve().parent.parent / "artifacts"
    artifacts_dir.mkdir(exist_ok=True)
    joblib.dump(preprocessor, artifacts_dir / "preprocessor.joblib")

    models = {
        "LogReg": NIDSWrapper(LogisticRegression(max_iter=1000, class_weight='balanced')),
        "DecisionTree": NIDSWrapper(DecisionTreeClassifier(class_weight='balanced')),
        "RandomForest": NIDSWrapper(RandomForestClassifier(n_estimators=100, class_weight='balanced')),
        "XGBoost": NIDSWrapper(XGBClassifier(use_label_encoder=False, eval_metric='mlogloss'), is_xgb=True)
    }
    
    metrics = {}
    for name, wrapper in models.items():
        print(f"Training {name}...")
        wrapper.train(X_train_processed, y_train)
        joblib.dump(wrapper.model, artifacts_dir / f"{name}.joblib")
        metrics[name] = wrapper.evaluate(X_test_processed, y_test)
        print(f"{name} F1: {metrics[name]['macro_f1']:.4f}")

    with open(artifacts_dir / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    contract = {
        "feature_names": [c for c in NSL_KDD_COLUMNS if c not in ["label", "difficulty"]],
        "feature_count": 41,
        "categorical_features": CATEGORICAL_COLS,
        "numeric_features": len(NUMERIC_COLS),
        "label_column": "label",
        "classes": classes,
        "preprocessor_version": "1.0",
        "dataset": "NSL-KDD"
    }
    with open(artifacts_dir / "features.json", "w") as f:
        json.dump(contract, f, indent=2)
        
    print("Phase 1 complete. Artifacts saved.")

if __name__ == "__main__":
    main()
