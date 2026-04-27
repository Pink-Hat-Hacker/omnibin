import time
from adafruit_motorkit import MotorKit
from adafruit_motor import stepper

# Steps per revolution for NEMA 17 (200 steps = 1.8 degrees per step)
STEPS_PER_REV = 100

# Bin positions (4 quadrants = 90 degrees each = 50 steps each)
BIN_POSITIONS = {
    'Garbage': 0,    # 0 degrees   — home position
    'Plastic': 25,   # 90 degrees
    'Paper':   50,  # 180 degrees
    'Metal':   75,  # 270 degrees
}

# Hatch: 180 degrees = 100 steps
HATCH_OPEN_STEPS = 100
HATCH_HOLD_SECONDS = 3.0
STEPPER_STYLE = stepper.DOUBLE  # More torque than SINGLE


class MotorController:
    def __init__(self):
        self.kit = MotorKit()  # Default I2C address 0x60
        self.motor_selector = self.kit.stepper1   # Bin selector
        self.motor_hatch = self.kit.stepper2      # Hatch
        self.current_position = 0  # Track selector position in steps
        print("[MOTORS] Motor HAT initialized")

    def _release_all(self):
        """Release motors to prevent heat buildup when idle."""
        self.motor_selector.release()
        self.motor_hatch.release()

    def rotate_selector_to(self, target_steps):
        """
        Rotate bin selector to target step position.
        Handles both clockwise and counter-clockwise shortest path.
        """
        diff = target_steps - self.current_position

        # Normalize to shortest path within 200 steps (full rev)
        if diff > STEPS_PER_REV / 2:
            diff -= STEPS_PER_REV
        elif diff < -STEPS_PER_REV / 2:
            diff += STEPS_PER_REV

        if diff == 0:
            print(f"[MOTORS] Selector already at position {target_steps}")
            return

        direction = stepper.FORWARD if diff > 0 else stepper.BACKWARD
        steps = abs(diff)

        print(f"[MOTORS] Rotating selector {steps} steps "
              f"{'CW' if diff > 0 else 'CCW'}")

        for _ in range(steps):
            self.motor_selector.onestep(
                direction=direction, style=STEPPER_STYLE
            )
            time.sleep(0.001)  # steps/sec — adjust for your motor

        self.current_position = target_steps
        self.motor_selector.release()

    def open_hatch(self):
        """Rotate hatch motor 180 degrees to open."""
        print(f"[MOTORS] Opening hatch ({HATCH_OPEN_STEPS} steps)")
        for _ in range(HATCH_OPEN_STEPS):
            self.motor_hatch.onestep(
                direction=stepper.FORWARD, style=STEPPER_STYLE
            )
            time.sleep(0.008)

    def close_hatch(self):
        """Rotate hatch motor 180 degrees back to closed."""
        print(f"[MOTORS] Closing hatch ({HATCH_OPEN_STEPS} steps)")
        for _ in range(HATCH_OPEN_STEPS):
            self.motor_hatch.onestep(
                direction=stepper.BACKWARD, style=STEPPER_STYLE
            )
            time.sleep(0.0001)
        self.motor_hatch.release()

    def sort_waste(self, label):
        """
        Full sort sequence:
        1. Rotate selector to correct bin
        2. Open hatch
        3. Hold open
        4. Close hatch
        5. Return to home
        """
        if label not in BIN_POSITIONS:
            print(f"[MOTORS] Unknown label '{label}', defaulting to Garbage")
            label = 'Garbage'

        target = BIN_POSITIONS[label]
        print(f"[MOTORS] Sorting '{label}' to bin position {target} steps")

        # Step 1: Rotate to bin
        self.rotate_selector_to(target)
        time.sleep(1)  # Settle

        # Step 2: Open hatch
        self.open_hatch()
        time.sleep(HATCH_HOLD_SECONDS)

        # Step 3: Close hatch
        self.close_hatch()
        time.sleep(0.3)

        # Step 4: Return home
        self.rotate_selector_to(0)
        self._release_all()
        print("[MOTORS] Sort complete, returned home")
        time.sleep(1)

    def home(self):
        """Emergency return to home position."""
        self.rotate_selector_to(0)
        self.close_hatch()
        self._release_all()
