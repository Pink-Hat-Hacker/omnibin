"""
convert_model.py
Run this on your development machine (NOT the Pi) to convert
your Teachable Machine model to TFLite format.

Steps:
1. Export your model from Teachable Machine:
   Model → Export Model → TensorFlow → SavedModel → Download

2. Unzip the download so you have a 'saved_model/' folder here.

3. Install tensorflow on your dev machine:
   pip install tensorflow

4. Run:
   python3 convert_model.py

5. Copy model.tflite to the Pi:
   scp model.tflite pi@<PI_IP>:~/omnibin-v2/model/
"""

import tensorflow as tf
import os

SAVED_MODEL_DIR = './saved_model'
OUTPUT_PATH = './model.tflite'

if not os.path.exists(SAVED_MODEL_DIR):
    print(f"ERROR: '{SAVED_MODEL_DIR}' not found.")
    print("Export your Teachable Machine model as TensorFlow SavedModel first.")
    exit(1)

print("Loading SavedModel...")
converter = tf.lite.TFLiteConverter.from_saved_model(SAVED_MODEL_DIR)

# Optimize for edge inference
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.target_spec.supported_types = [tf.float16]

print("Converting to TFLite...")
tflite_model = converter.convert()

with open(OUTPUT_PATH, 'wb') as f:
    f.write(tflite_model)

size_kb = len(tflite_model) / 1024
print(f"Done! Saved to {OUTPUT_PATH} ({size_kb:.1f} KB)")
print(f"\nNext: scp {OUTPUT_PATH} pi@<PI_IP>:~/omnibin-v2/model/")
