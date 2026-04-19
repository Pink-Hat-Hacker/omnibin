import time
import cv2
import numpy as np
import requests
from tflite_runtime.interpreter import Interpreter
from adafruit_motorkit import MotorKit

# Init motors
kit = MotorKit()

# Load model
interpreter = Interpreter(model_path="model/model.tflite")
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

labels = ["plastic", "paper", "metal", "garbage"]

# Camera
cap = cv2.VideoCapture(0)

def classify(frame):
    img = cv2.resize(frame, (224, 224))
    input_data = np.expand_dims(img, axis=0).astype(np.float32)

    interpreter.set_tensor(input_details[0]['index'], input_data)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details[0]['index'])

    idx = np.argmax(output)
    return labels[idx], float(output[0][idx])


def rotate_bin(label):
    steps_map = {
        "plastic": 50,
        "paper": 100,
        "metal": 150,
        "garbage": 200
    }

    steps = steps_map.get(label, 0)

    print(f"[MOTOR] Rotating to {label}")
    for _ in range(steps):
        kit.stepper1.onestep()
        time.sleep(0.01)

def open_hatch():
    print("[MOTOR] Opening hatch")
    for _ in range(50):  # ~45°
        kit.stepper2.onestep()
        time.sleep(0.01)


def send_event(label, confidence):
    try:
        requests.post("http://localhost:3000/event", json={
            "prediction": label,
            "confidence": confidence,
            "timestamp": time.time()
        })
    except:
        pass


print("OmniBin running...")

while True:
    ret, frame = cap.read()

    if not ret:
        continue

    # Simple trigger: every 3 seconds
    time.sleep(3)

    label, conf = classify(frame)

    print(f"[AI] {label} ({conf:.2f})")

    rotate_bin(label)
    open_hatch()

    send_event(label, conf)
