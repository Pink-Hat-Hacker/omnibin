"""
calibrate_motors.py
Run this manually on the Pi to test and calibrate your stepper motors
before running the main application.

Usage:
  source venv/bin/activate
  python3 calibrate_motors.py
"""

import time
from motors import MotorController, BIN_POSITIONS

def run_calibration():
    print("=" * 40)
    print("OmniBin Motor Calibration")
    print("=" * 40)

    motors = MotorController()

    print("\n[1] Testing bin selector - rotating to each position...")
    for label, steps in BIN_POSITIONS.items():
        input(f"  Press ENTER to rotate to '{label}' (step {steps})...")
        motors.rotate_selector_to(steps)
        print(f"  -> At '{label}' position")
        time.sleep(1)

    time.sleep(2)

    print("\nReturning to home position...")
    motors.rotate_selector_to(0)
    time.sleep(1)

    print("\n[2] Testing hatch motor...")
    input("  Press ENTER to OPEN hatch...")
    motors.open_hatch()
    print("  -> Hatch opened")

    input("  Press ENTER to CLOSE hatch...")
    motors.close_hatch()
    print("  -> Hatch closed")

    print("\n[3] Full sort cycle test...")
    for label in BIN_POSITIONS.keys():
        ans = input(f"  Run full sort for '{label}'? (y/n): ")
        if ans.lower() == 'y':
            motors.sort_waste(label)
            print(f"  -> Sort cycle for '{label}' complete")
            time.sleep(1)

    print("\nCalibration complete!")
    print("\nTuning tips:")
    print("  - If motors skip steps: increase time.sleep() in motors.py")
    print("  - If direction is wrong: swap A+/A- wires on that motor")
    print("  - If 90 degrees is off: adjust STEPS_PER_REV in motors.py")

if __name__ == '__main__':
    run_calibration()
