from pymongo import MongoClient
from datetime import datetime
import os


class Database:
    def __init__(self):
        uri = os.getenv('MONGO_URI')
        db_name = os.getenv('MONGO_DB', 'omnibin')
        self.device_id = os.getenv('DEVICE_ID', 'omnibin-pi-001')
        self.device_name = os.getenv('DEVICE_NAME', 'OmniBin Unit 1')

        self.client = MongoClient(uri)
        self.db = self.client[db_name]
        self.classifications = self.db['classifications']
        self.devices = self.db['devices']
        print("[DB] Connected to MongoDB")

    def register_device(self):
        """Upsert device registration record."""
        self.devices.update_one(
            {'device_id': self.device_id},
            {'$set': {
                'device_id': self.device_id,
                'name': self.device_name,
                'status': 'online',
                'last_seen': datetime.utcnow(),
                'version': '2.0.0',
            }},
            upsert=True
        )
        print(f"[DB] Device '{self.device_id}' registered")

    def update_heartbeat(self):
        """Update device last_seen timestamp."""
        self.devices.update_one(
            {'device_id': self.device_id},
            {'$set': {
                'status': 'online',
                'last_seen': datetime.utcnow()
            }}
        )

    def set_offline(self):
        """Mark device as offline on shutdown."""
        self.devices.update_one(
            {'device_id': self.device_id},
            {'$set': {'status': 'offline', 'last_seen': datetime.utcnow()}}
        )

    def log_classification(self, label, confidence, confirmed,
                           image_b64, all_predictions):
        """Insert a classification record."""
        doc = {
            'device_id': self.device_id,
            'label': label,
            'confidence': confidence,
            'confirmed': confirmed,
            'all_predictions': all_predictions,
            'image': image_b64,
            'timestamp': datetime.utcnow(),
        }
        result = self.classifications.insert_one(doc)
        return str(result.inserted_id)

    def get_accuracy_stats(self):
        """Compute accuracy metrics for admin panel."""
        pipeline = [
            {'$match': {'device_id': self.device_id}},
            {'$group': {
                '_id': '$label',
                'total': {'$sum': 1},
                'confirmed': {
                    '$sum': {'$cond': ['$confirmed', 1, 0]}
                }
            }}
        ]
        results = list(self.classifications.aggregate(pipeline))
        stats = {}
        for r in results:
            label = r['_id']
            total = r['total']
            confirmed = r['confirmed']
            stats[label] = {
                'total': total,
                'confirmed': confirmed,
                'accuracy': round(confirmed / total * 100, 1) if total else 0
            }
        return stats

    def get_recent(self, limit=50):
        """Return recent classifications for this device."""
        docs = list(
            self.classifications
            .find({'device_id': self.device_id}, {'image': 0})
            .sort('timestamp', -1)
            .limit(limit)
        )
        for d in docs:
            d['_id'] = str(d['_id'])
            d['timestamp'] = d['timestamp'].isoformat()
        return docs
