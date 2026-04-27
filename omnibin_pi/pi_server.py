"""
pi_server.py — Local Flask + SocketIO server on the Pi

Uses threading async mode (not eventlet) to avoid the SSL recursion
conflict between eventlet.monkey_patch() and PyMongo's SSL context.
"""
import os
import time
import threading

from flask import Flask, Response, jsonify, request
from flask_socketio import SocketIO

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('DASHBOARD_SECRET', 'dev-secret')

# threading mode — no monkey patching, no eventlet conflict
socketio = SocketIO(
    app,
    cors_allowed_origins='*',
    async_mode='threading',
    logger=False,
    engineio_logger=False
)

# ── Shared state (injected by pi_main.py) ──────────────────────
_camera = None
_db     = None

# ── Frame buffer for MJPEG stream ─────────────────────────────
_latest_jpeg  = None
_frame_lock   = threading.Lock()
_frame_event  = threading.Event()


def _frame_producer():
    """
    Background thread: captures JPEG frames at ~15 FPS into _latest_jpeg.
    Completely decoupled from Flask request handling.
    """
    global _latest_jpeg
    interval = 1.0 / 15
    while True:
        if _camera is not None:
            try:
                jpeg = _camera.get_jpeg_bytes()
                if jpeg:
                    with _frame_lock:
                        _latest_jpeg = jpeg
                    _frame_event.set()
            except Exception as e:
                print(f"[STREAM] Frame error: {e}")
        time.sleep(interval)


_producer_thread = threading.Thread(target=_frame_producer, daemon=True)
_producer_thread.start()


def init_server(camera, db):
    global _camera, _db
    _camera = camera
    _db     = db


def emit_classification(data):
    socketio.emit('classification', data)


def emit_status(data):
    socketio.emit('status', data)


# ── Routes ─────────────────────────────────────────────────────

@app.route('/status')
def status():
    return jsonify({
        'device_id': os.getenv('DEVICE_ID', 'unknown'),
        'name':      os.getenv('DEVICE_NAME', 'OmniBin'),
        'status':    'online',
        'time':      time.time()
    })


def _generate_mjpeg():
    """MJPEG generator — reads from the shared frame buffer."""
    while True:
        triggered = _frame_event.wait(timeout=2.0)
        _frame_event.clear()

        if not triggered:
            continue

        with _frame_lock:
            frame = _latest_jpeg

        if frame is None:
            continue

        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n'
            b'Content-Length: ' + str(len(frame)).encode() + b'\r\n'
            b'\r\n' + frame + b'\r\n'
        )


@app.route('/stream')
def stream():
    return Response(
        _generate_mjpeg(),
        mimetype='multipart/x-mixed-replace; boundary=frame',
        headers={
            'Cache-Control':     'no-cache, no-store, must-revalidate',
            'Pragma':            'no-cache',
            'Expires':           '0',
            'X-Accel-Buffering': 'no',
        }
    )


@app.route('/snapshot')
def snapshot():
    """Single JPEG — handy for debugging."""
    with _frame_lock:
        frame = _latest_jpeg
    if frame is None:
        return "No frame yet", 503
    return Response(frame, mimetype='image/jpeg')


@app.route('/confirm', methods=['POST'])
def confirm():
    data              = request.json
    classification_id = data.get('classification_id')
    confirmed         = data.get('confirmed', False)
    correct_label     = data.get('correct_label')
    try:
        from pymongo import ObjectId
        update = {'confirmed': confirmed}
        if correct_label:
            update['user_label'] = correct_label
        _db.classifications.update_one(
            {'_id': ObjectId(classification_id)},
            {'$set': update}
        )
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/recent')
def recent():
    try:
        return jsonify(_db.get_recent())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/stats')
def stats():
    try:
        return jsonify(_db.get_accuracy_stats())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@socketio.on('connect')
def on_connect():
    print('[SERVER] Dashboard client connected')


@socketio.on('disconnect')
def on_disconnect():
    print('[SERVER] Dashboard client disconnected')


'''
def run_server(port=5000):
    print(f"[SERVER] Starting on 0.0.0.0:{port} (threading mode)")
    # use_reloader=False is required when running inside a thread
    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        use_reloader=False,
        log_output=False
    )
'''
def run_server(port=5000):
    print(f"[SERVER] Starting on 0.0.0.0:{port} (threading mode)")
    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        use_reloader=False,
        log_output=False,
        allow_unsafe_werkzeug=True
    )
