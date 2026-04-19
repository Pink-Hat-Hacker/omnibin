import time
import cv2
import numpy as np
import requests
from tflite_runtime.interpreter import Interpreter
from adafruit_motorkit import MotorKit
# pi camera mod3 fix
from picamera2 import Picamera2
#live streaming
from flask import Flask, Response
import threading
app = Flask(__name__)
latest_label = "..."
latest_conf = 0.0


# Init motors
kit = MotorKit()

# Load model
interpreter = Interpreter(model_path="model/omnibin_model.tflite")
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

labels = ["plastic", "paper", "metal", "garbage"]

# Camera
#cap = cv2.VideoCapture(0)
# pi camera mod3 fix
picam2 = Picamera2()
picam2.configure(picam2.create_preview_configuration())
picam2.start()

def get_frame():
    frame = picam2.capture_array()
    #debugs
    print("Frame shape:", frame.shape)
    return frame

# Live streaming
def generate_frames():
    while True:
        frame = picam2.capture_array()
        frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

        #draw on img
        cv2.putText(
            frame,
            f"{latest_label} {latest_conf:.2f}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2
        )
        #encode to jpeg
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video')
def video():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


def classify(frame):
    # Converting RGBA to RGB
    frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

    # Resize
    img = cv2.resize(frame, (224, 224))
    #img = cv2.resize(frame, (224, 224))

    #normalizing
    img = img.astype(np.float32) / 255.0

    #OG
    input_data = np.expand_dims(img, axis=0).astype(np.float32)
    # debug
    print("Input shape:", input_data.shape)

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



#streaming
def run_server():
    app.run(host='0.0.0.0', port=5000)

threading.Thread(target=run_server, daemon=True).start()


print("OmniBin running...")

while True:
    # pi camera mod3 fix
    frame = get_frame()

    #ret, frame = cap.read()

    #if not ret:
    #    continue

    # Simple trigger: every # seconds
    time.sleep(5)

    label, conf = classify(frame)

    latest_label = label
    latest_conf = conf

    print(f"[AI] {label} ({conf:.2f})")

    rotate_bin(label)
    open_hatch()

    send_event(label, conf)
