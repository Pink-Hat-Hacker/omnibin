const MODEL_URL = "/model/";

let model;
let webcamStream;
let lastPrediction = null;
let lastImage = null;

async function init() {
  // Load model
  model = await tmImage.load(
    MODEL_URL + "model.json",
    MODEL_URL + "metadata.json"
  );

  // Setup webcam
  const video = document.getElementById("webcam");
  webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = webcamStream;
}

async function captureAndPredict() {
  const video = document.getElementById("webcam");
  const canvas = document.getElementById("snapshot");
  const ctx = canvas.getContext("2d");

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const prediction = await model.predict(canvas);

  prediction.sort((a, b) => b.probability - a.probability);

  const top = prediction[0];

  lastPrediction = top.className;
  lastImage = canvas.toDataURL("image/jpeg");

  document.getElementById("result").innerText =
    `${top.className} (${(top.probability * 100).toFixed(1)}%)`;

  showConfirm(top.className);
}

function showConfirm(label) {
  document.getElementById("confirmBox").style.display = "block";
  document.getElementById("result").style.display = "block";
  document.getElementById("confirmText").innerText = `Is this ${label}?`;
}

async function sendResult(confirmed) {
  await fetch("/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: lastImage,
      prediction: lastPrediction,
      confirmed
    })
  });

  document.getElementById("confirmBox").style.display = "none";
  document.getElementById("result").style.display = "none";
}

// Events
document.getElementById("captureBtn").onclick = captureAndPredict;
document.getElementById("yesBtn").onclick = () => sendResult(true);
document.getElementById("noBtn").onclick = () => sendResult(false);

init();