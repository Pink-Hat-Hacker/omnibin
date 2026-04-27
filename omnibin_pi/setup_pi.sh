#!/bin/bash
# setup_pi.sh
# Run this on a fresh Raspberry Pi to set up OmniBin v2
# Usage: bash setup_pi.sh

set -e

echo "========================================"
echo "  OmniBin v2 - Pi Setup Script"
echo "========================================"

echo "[1/5] Updating system packages..."
sudo apt update && sudo apt upgrade -y

echo "[2/5] Installing system dependencies..."
sudo apt install -y \
  python3-pip python3-venv git \
  libatlas-base-dev libopenblas-dev \
  libjpeg-dev libopencv-dev python3-opencv \
  i2c-tools python3-smbus

echo "[3/5] Enabling I2C interface..."
sudo raspi-config nonint do_i2c 0
echo "  I2C enabled. Verifying..."
sudo i2cdetect -y 1 || echo "  (No I2C devices found yet - connect Motor HAT)"

echo "[4/5] Creating Python virtual environment..."
cd ~/omnibin
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "[5/5] Installing systemd service..."
sudo cp omnibin.service /etc/systemd/system/omnibin.service
sudo systemctl daemon-reload
sudo systemctl enable omnibin

echo ""
echo "========================================"
echo "  Setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env and fill in your MongoDB URI"
echo "  2. Copy model.tflite to model/ directory"
echo "  3. Run calibration: python3 calibrate_motors.py"
echo "  4. Start service:   sudo systemctl start omnibin"
echo "  5. Check logs:      sudo journalctl -u omnibin -f"
echo ""
