"""
OmniBin v2 — Main loop
Runs on Raspberry Pi 4B

Classification flow:
  1. Poll camera.check_motion() in a fast loop (~10 Hz)
  2. Once motion has settled (item is still in frame), capture + classify
  3. If confidence >= threshold, sort and log
  4. Camera cooldown prevents re-triggering during sort
"""

import os
import time
import signal
import threading
from dotenv import load_dotenv

load_dotenv()

from camera import Camera
from classifier import WasteClassifier
from motors import MotorController
from database import Database
import pi_server

# ── Configuration ──────────────────────────────────────────────
CONFIDENCE_THRESHOLD  = 0.70   # Minimum confidence to accept classification
MOTION_POLL_HZ        = 10     # How often to check for motion (times/sec)
HEARTBEAT_INTERVAL    = 30     # Seconds between DB heartbeats

running = True


def signal_handler(sig, frame):
    global running
    print("\n[MAIN] Shutdown signal received")
    running = False


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def heartbeat_loop(db, interval):
    while running:
        try:
            db.update_heartbeat()
        except Exception as e:
            print(f"[HEARTBEAT] Error: {e}")
        time.sleep(interval)


def classify_and_sort(camera, classifier, motors, db):
    """
    Called once motion has settled.
    Captures frame, classifies, logs, and sorts.
    Returns the classification label or None if below threshold.
    """
    print("[MAIN] Item detected — capturing frame for classification")

    try:
        frame    = camera.capture_frame()
        all_preds = classifier.predict(frame)
        top       = all_preds[0]  # Already sorted by confidence desc
    except Exception as e:
        print(f"[MAIN] Capture/classify error: {e}")
        camera.mark_captured()  # Still trigger cooldown
        return None

    label      = top["label"]
    confidence = top["confidence"]

    print(f"[MAIN] Classification: {label} ({confidence:.1%})")

    if confidence < CONFIDENCE_THRESHOLD:
        print(f"[MAIN] Confidence {confidence:.1%} below threshold "
              f"{CONFIDENCE_THRESHOLD:.0%} — skipping")
        camera.mark_captured()
        return None

    # Capture JPEG for storage (second capture at full res)
    image_b64 = camera.capture_jpeg_b64()

    # Log to MongoDB
    doc_id = db.log_classification(
        label=label,
        confidence=confidence,
        confirmed=None,
        image_b64=image_b64,
        all_predictions=all_preds
    )

    # Push real-time event to dashboard
    event_data = {
        "classification_id": doc_id,
        "label":             label,
        "confidence":        confidence,
        "all_predictions":   all_preds,
        "image":             "data:image/jpeg;base64," + image_b64,
        "timestamp":         time.time(),
    }
    pi_server.emit_classification(event_data)
    pi_server.emit_status({"state": "sorting", "label": label})

    # Mark cooldown BEFORE sorting so camera ignores the motor movement
    camera.mark_captured()

    # Sort (blocking — motors must finish before we accept next item)
    try:
        motors.sort_waste(label)
    except Exception as e:
        print(f"[MOTORS] Sort error: {e}")

    pi_server.emit_status({"state": "idle"})
    print("[MAIN] Ready for next item")
    return label


def main():
    print("=" * 50)
    print("  OmniBin — Starting up")
    print("=" * 50)

    # ── Init subsystems ────────────────────────────────────────
    db         = Database()
    db.register_device()

    camera     = Camera()
    classifier = WasteClassifier(
        model_path="model/model.tflite",
        labels_path="model/labels.txt"
    )
    motors     = MotorController()

    # ── Start local Flask/SocketIO server ──────────────────────
    pi_server.init_server(camera, db)
    server_port = int(os.getenv("PI_SERVER_PORT", 5000))
    server_thread = threading.Thread(
        target=pi_server.run_server,
        args=(server_port,),
        daemon=True
    )
    server_thread.start()
    print(f"[MAIN] Local server on port {server_port}")

    # ── Start heartbeat thread ─────────────────────────────────
    hb_thread = threading.Thread(
        target=heartbeat_loop,
        args=(db, HEARTBEAT_INTERVAL),
        daemon=True
    )
    hb_thread.start()

    # ── Motion-gated classification loop ──────────────────────
    poll_interval = 1.0 / MOTION_POLL_HZ
    print(f"[MAIN] Watching for items (polling at {MOTION_POLL_HZ} Hz)...")
    pi_server.emit_status({"state": "idle"})

    while running:
        try:
            motion = camera.check_motion()
        except Exception as e:
            print(f"[MAIN] Motion check error: {e}")
            time.sleep(1)
            continue

        if motion and camera.motion_settled():
            # Item is in frame and has been still long enough — classify
            classify_and_sort(camera, classifier, motors, db)
        else:
            # Nothing happening — sleep until next poll
            time.sleep(poll_interval)

    # ── Shutdown ───────────────────────────────────────────────
    print("[MAIN] Shutting down...")
    db.set_offline()
    motors.home()
    camera.release()
    print("[MAIN] Done.")


if __name__ == "__main__":
    main()
