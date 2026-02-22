function servoCommand(label) {
  switch (label) {
    case "Plastic":
      console.log("[SERVO] Rotating arm to BIN 1 (Plastic) — angle: 45°");
      break;

    case "Paper":
      console.log("[SERVO] Rotating arm to BIN 2 (Paper) — angle: 90°");
      break;

    case "Metal":
      console.log("[SERVO] Rotating arm to BIN 3 (Metal) — angle: 135°");
      break;

    case "Garbage":
      console.log("[SERVO] Rotating arm to BIN 4 (Garbage) — angle: 180°");
      break;

    default:
      console.log("[SERVO] Unknown material — staying home");
      return;
  }

  console.log("[SERVO] Opening bin door for 2s");
  console.log("[SERVO] Returning to home position");
}

module.exports = servoCommand;