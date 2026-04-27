"""
camera.py — Picamera2-based camera interface for OmniBin v2

Two independent capture paths:
  1. get_jpeg_bytes()   → called by the stream producer thread at 15 FPS
  2. capture_frame()    → called by the classifier (high-res, on demand)

Picamera2 supports concurrent lores + main capture natively so these
never block each other.
"""

import io
import time
import base64
import threading
import numpy as np
from PIL import Image
from picamera2 import Picamera2

# ── Motion detection tuning ────────────────────────────────────
MOTION_THRESHOLD    = 25     # Per-pixel brightness diff to count as changed
MOTION_MIN_PIXELS   = 500    # Min changed pixels to declare motion
MOTION_SETTLE_SEC   = 1.5    # Item must be still this long before capture
MOTION_COOLDOWN_SEC = 5.0    # Ignore motion for this long after a capture


class Camera:
    def __init__(self):
        self.cam = Picamera2()

        # Single configuration with:
        #   main  → 1296x972 RGB  (classification + JPEG stream)
        #   lores → 320x240 YUV   (motion detection, nearly free)
        config = self.cam.create_video_configuration(
            main={
                "size":   (1296, 972),
                "format": "RGB888"
            },
            lores={
                "size":   (320, 240),
                "format": "YUV420"
            },
            controls={
                "FrameRate": 15,
            }
        )
        self.cam.configure(config)
        self.cam.start()

        # Let auto-exposure and white balance settle
        time.sleep(2)

        # Motion state
        self._prev_y          = None
        self._motion_start    = None
        self._last_capture_at = 0.0
        self._lock            = threading.Lock()

        print("[CAMERA] Picamera2 initialized (1296x972 main, 320x240 lores)")

    # ── Streaming (called from pi_server producer thread) ──────

    def get_jpeg_bytes(self):
        """
        Capture a JPEG from the main stream for the MJPEG feed.
        Scaled down to 640x480 for efficient streaming.
        """
        try:
            frame = self.cam.capture_array("main")
            img   = Image.fromarray(frame[:, :, ::-1])
            img   = img.resize((640, 480), Image.BILINEAR)
            buf   = io.BytesIO()
            img.save(buf, format="JPEG", quality=60)
            return buf.getvalue()
        except Exception as e:
            print(f"[CAMERA] get_jpeg_bytes error: {e}")
            return None

    # ── Classification capture (called from pi_main) ───────────

    def capture_frame(self):
        """
        Capture a full-resolution RGB frame for the classifier.
        Also refreshes the lores motion baseline.
        """
        frame = self.cam.capture_array("main")
        self._refresh_lores_baseline()
        return frame

    def capture_jpeg_b64(self):
        """Full-res JPEG as base64 for MongoDB storage."""
        frame = self.capture_frame()
        img   = Image.fromarray(frame[:, :, ::-1])
        buf   = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    # ── Motion detection ───────────────────────────────────────

    def _get_lores_y(self):
        """Extract the Y (luminance) plane from the lores YUV buffer."""
        lores = self.cam.capture_array("lores")
        h, w  = 240, 320
        return lores[:h, :w].copy()

    def _refresh_lores_baseline(self):
        """Update the stored previous frame to the current one."""
        try:
            y = self._get_lores_y()
            with self._lock:
                self._prev_y = y
        except Exception:
            pass

    def check_motion(self):
        """
        Compare current lores Y-plane to the previous one.
        Returns True if significant motion is detected.
        """
        now = time.time()

        if now - self._last_capture_at < MOTION_COOLDOWN_SEC:
            return False

        try:
            y_curr = self._get_lores_y().astype(np.int16)
        except Exception as e:
            print(f"[CAMERA] lores error: {e}")
            return False

        with self._lock:
            y_prev       = self._prev_y
            self._prev_y = y_curr.astype(np.uint8)

        if y_prev is None:
            return False

        diff           = np.abs(y_curr - y_prev.astype(np.int16))
        changed_pixels = int(np.sum(diff > MOTION_THRESHOLD))
        motion         = changed_pixels > MOTION_MIN_PIXELS

        if motion:
            if self._motion_start is None:
                self._motion_start = now
                print(f"[CAMERA] Motion detected ({changed_pixels} px)")
        else:
            if self._motion_start is not None:
                print("[CAMERA] Motion cleared")
            self._motion_start = None

        return motion

    def motion_settled(self):
        """True when item has been still for at least MOTION_SETTLE_SEC."""
        if self._motion_start is None:
            return False
        return (time.time() - self._motion_start) >= MOTION_SETTLE_SEC

    def mark_captured(self):
        """Call after classification to start cooldown and reset motion state."""
        self._last_capture_at = time.time()
        self._motion_start    = None
        print(f"[CAMERA] Cooldown started ({MOTION_COOLDOWN_SEC}s)")

    # ── Cleanup ────────────────────────────────────────────────

    def release(self):
        try:
            self.cam.stop()
            self.cam.close()
            print("[CAMERA] Released")
        except Exception as e:
            print(f"[CAMERA] Release error: {e}")
