async function loadStats() {
  const res = await fetch("/admin/stats");
  const data = await res.json();

  document.getElementById("total").innerText = data.totalDocs;
  document.getElementById("accuracy").innerText = data.overallAccuracy;

  const labels = data.categories.map(c => c._id);
  const totals = data.categories.map(c => c.total);
  const accuracies = data.categories.map(c =>
    ((c.correct / c.total) * 100).toFixed(2)
  );
  const binTableBody = document.getElementById("binTableBody");

  binTableBody.replaceChildren();

  data.bins.forEach(bin => {
    const row = document.createElement("tr");
    [bin._id, bin.total, bin.accuracy, bin.mostCommonPrediction].forEach(value => {
      const cell = document.createElement("td");
      cell.innerText = value;
      row.appendChild(cell);
    });
    binTableBody.appendChild(row);
  });

  // Accuracy Chart
  new Chart(document.getElementById("accuracyChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Accuracy %",
        data: accuracies
      }]
    }
  });

  // Volume Chart
  new Chart(document.getElementById("volumeChart"), {
    type: "pie",
    data: {
      labels,
      datasets: [{
        label: "Total Predictions",
        data: totals
      }]
    }
  });
}

loadStats();

setInterval(async () => {
  const res = await fetch("/status");
  const data = await res.json();

  if (data.lastEvent) {
    document.body.innerHTML += `
      <p>Latest: ${data.lastEvent.prediction} (${data.lastEvent.confidence})</p>
    `;
  }
}, 2000);
