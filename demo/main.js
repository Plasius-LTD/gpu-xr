import { createXrManager } from "../src/index.js";

const supportEl = document.querySelector("#support");
const enterBtn = document.querySelector("#enter");
const exitBtn = document.querySelector("#exit");
const logEl = document.querySelector("#log");
const displayBadge = document.querySelector("#displayBadge");
const displayDetails = document.querySelector("#displayDetails");

const appendLog = (message) => {
  const line = `[${new Date().toISOString()}] ${message}`;
  logEl.textContent = `${line}\n${logEl.textContent}`;
};

function setDisplayState(badge, details, tone = "info") {
  if (displayBadge) {
    displayBadge.textContent = badge;
    displayBadge.dataset.tone = tone;
  }
  if (displayDetails) {
    displayDetails.textContent = details;
    displayDetails.dataset.tone = tone;
  }
}

const manager = createXrManager({
  onSessionStart: (_session, mode) => {
    appendLog(`XR session started (${mode}).`);
    enterBtn.disabled = true;
    exitBtn.disabled = false;
    setDisplayState(
      "XR session active",
      "Lifecycle is active, but this demo still does not bind a renderer canvas. " +
        "Use @plasius/gpu-renderer with this session for a 3D surface.",
      "success"
    );
  },
  onSessionEnd: () => {
    appendLog("XR session ended.");
    enterBtn.disabled = false;
    exitBtn.disabled = true;
    setDisplayState(
      "Lifecycle demo",
      "The XR session ended. This demo tracks capability and session state only.",
      "warn"
    );
  },
});

try {
  const support = await manager.probeSupport(["immersive-vr"]);
  if (support["immersive-vr"]) {
    supportEl.textContent = "immersive-vr is supported.";
    enterBtn.disabled = false;
    setDisplayState(
      "Lifecycle demo",
      "XR capability is available. This demo verifies session lifecycle, not 3D rendering.",
      "info"
    );
    appendLog("XR support detected for immersive-vr.");
  } else {
    supportEl.textContent = "immersive-vr is not supported in this browser/device.";
    setDisplayState(
      "XR unavailable",
      "No 3D canvas is mounted here, and immersive-vr support is not available on this device.",
      "error"
    );
    appendLog("XR support not available.");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  supportEl.textContent = "Unable to probe XR support.";
  setDisplayState("XR probe failed", message, "error");
  appendLog(`XR probe failed: ${message}`);
}

enterBtn.addEventListener("click", async () => {
  try {
    await manager.enterVr({ optionalFeatures: ["depth-sensing"] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setDisplayState("Enter VR failed", message, "error");
    appendLog(`Failed to enter VR: ${message}`);
  }
});

exitBtn.addEventListener("click", async () => {
  await manager.exitSession();
});
