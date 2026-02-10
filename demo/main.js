import { createXrManager } from "../src/index.js";

const supportEl = document.querySelector("#support");
const enterBtn = document.querySelector("#enter");
const exitBtn = document.querySelector("#exit");
const logEl = document.querySelector("#log");

const appendLog = (message) => {
  const line = `[${new Date().toISOString()}] ${message}`;
  logEl.textContent = `${line}\n${logEl.textContent}`;
};

const manager = createXrManager({
  onSessionStart: (_session, mode) => {
    appendLog(`XR session started (${mode}).`);
    enterBtn.disabled = true;
    exitBtn.disabled = false;
  },
  onSessionEnd: () => {
    appendLog("XR session ended.");
    enterBtn.disabled = false;
    exitBtn.disabled = true;
  },
});

const support = await manager.probeSupport(["immersive-vr"]);
if (support["immersive-vr"]) {
  supportEl.textContent = "immersive-vr is supported.";
  enterBtn.disabled = false;
  appendLog("XR support detected for immersive-vr.");
} else {
  supportEl.textContent = "immersive-vr is not supported in this browser/device.";
  appendLog("XR support not available.");
}

enterBtn.addEventListener("click", async () => {
  try {
    await manager.enterVr({ optionalFeatures: ["depth-sensing"] });
  } catch (error) {
    appendLog(`Failed to enter VR: ${error?.message ?? String(error)}`);
  }
});

exitBtn.addEventListener("click", async () => {
  await manager.exitSession();
});
