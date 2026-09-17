import time
import os
import requests
import random

BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8000/predict")
DATA_PATH = os.environ.get("DATA_PATH", "/app/data/KDDTest+.txt")
DELAY = float(os.environ.get("DELAY", "0.5"))

NSL_KDD_COLUMNS = [
    "duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes", "land", "wrong_fragment", "urgent",
    "hot", "num_failed_logins", "logged_in", "num_compromised", "root_shell", "su_attempted", "num_root", "num_file_creations",
    "num_shells", "num_access_files", "num_outbound_cmds", "is_host_login", "is_guest_login", "count", "srv_count",
    "serror_rate", "srv_serror_rate", "rerror_rate", "srv_rerror_rate", "same_srv_rate", "diff_srv_rate", "srv_diff_host_rate",
    "dst_host_count", "dst_host_srv_count", "dst_host_same_srv_rate", "dst_host_diff_srv_rate", "dst_host_same_src_port_rate",
    "dst_host_srv_diff_host_rate", "dst_host_serror_rate", "dst_host_srv_serror_rate", "dst_host_rerror_rate",
    "dst_host_srv_rerror_rate", "label", "difficulty"
]

def main():
    if not os.path.exists(DATA_PATH):
        print(f"Data file {DATA_PATH} not found. Ensure it is mounted properly.")
        return
        
    print(f"Starting capture simulator...")
    print(f"Reading from: {DATA_PATH}")
    print(f"Sending to: {BACKEND_URL}")
    
    with open(DATA_PATH, 'r') as f:
        for line in f:
            parts = line.strip().split(',')
            if len(parts) < 41:
                continue
                
            features = {}
            for i in range(41):
                col = NSL_KDD_COLUMNS[i]
                val = parts[i]
                
                # Convert numeric values appropriately
                try:
                    features[col] = float(val) if '.' in val else int(val)
                except ValueError:
                    features[col] = val
                    
            payload = {"features": features}
            
            try:
                response = requests.post(BACKEND_URL, json=payload, timeout=2.0)
                print(f"Sent record. Status: {response.status_code}")
            except Exception as e:
                print(f"Failed to send record: {e}")
                
            # Sleep to simulate real-time traffic
            time.sleep(max(0.1, DELAY + random.uniform(-0.1, 0.1) * DELAY))

if __name__ == "__main__":
    main()
