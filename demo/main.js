import {
  createXrPerformanceHint,
  isXrModeSupported,
} from "../dist/index.js";
import { mountGpuShowcase } from "../node_modules/@plasius/gpu-shared/dist/index.js";

const root = globalThis.document?.getElementById("app");
if (!root) {
  throw new Error("XR demo root element was not found.");
}

const immersiveVrSupported = await isXrModeSupported("immersive-vr", {
  navigator: globalThis.navigator,
}).catch(() => false);

function createState() {
  return {
    immersiveVrSupported,
    targetMode: immersiveVrSupported ? "immersive-vr" : "inline",
  };
}

function updateState(state, scene) {
  state.targetMode = scene.stress || !state.immersiveVrSupported ? "inline" : "immersive-vr";
  return state;
}

function describeState(state) {
  const preferredFrameRates =
    state.targetMode === "immersive-vr" ? [90, 72, 60] : [60];
  const hint = createXrPerformanceHint({
    mode: state.targetMode,
    preferredFrameRates,
    fallbackFrameRates: preferredFrameRates,
  });

  return {
    status: `XR ready · ${state.targetMode} target`,
    details:
      state.immersiveVrSupported
        ? "The scene remains on a desktop canvas here, but gpu-xr is negotiating headset-native targets and worker-budget metadata against the same family showcase."
        : "immersive-vr is unavailable here, so the demo falls back to inline targets while still exercising the gpu-xr performance contract.",
    sceneMetrics: [
      `immersive-vr support: ${state.immersiveVrSupported ? "yes" : "no"}`,
      `target mode: ${state.targetMode}`,
      `target frame rate: ${hint.targetFrameRate} Hz`,
      `preferred rates: ${hint.preferredFrameRates.join(", ")}`,
    ],
    qualityMetrics: [
      `target frame time: ${hint.targetFrameTimeMs.toFixed(2)} ms`,
      `worker queue class: ${hint.workerBudget.queueClass}`,
      `scheduler mode: ${hint.workerBudget.schedulerMode}`,
      `budget profile: ${hint.workerBudget.profile}`,
    ],
    debugMetrics: [
      `rationale lines: ${hint.rationale.length}`,
      `mode family: ${state.targetMode === "immersive-vr" ? "headset" : "inline"}`,
      `stress fallback: ${state.targetMode === "inline" ? "active" : "inactive"}`,
      `scene continuity: preserved`,
    ],
    notes: [
      "The 3D scene now mounts by default instead of leaving gpu-xr as a lifecycle-only placeholder.",
      "gpu-xr still owns frame-target negotiation and worker-budget hints rather than trying to become a renderer package.",
      "Stress mode forces the demo back to inline pacing so the target negotiation stays visible.",
    ],
    textState: {
      immersiveVrSupported: state.immersiveVrSupported,
      targetMode: state.targetMode,
      targetFrameRate: hint.targetFrameRate,
      workerBudget: hint.workerBudget,
    },
    visuals: {
      reflectionStrength: state.targetMode === "immersive-vr" ? 0.2 : 0.12,
      shadowAccent: state.targetMode === "immersive-vr" ? 0.08 : 0.04,
      flagMotion: state.targetMode === "immersive-vr" ? 0.58 : 0.48,
      waveAmplitude: state.targetMode === "immersive-vr" ? 0.72 : 0.58,
    },
  };
}

await mountGpuShowcase({
  root,
  focus: "performance",
  packageName: "@plasius/gpu-xr",
  title: "XR Frame Target Harbor Validation",
  subtitle:
    "A shared 3D harbor scene driven by gpu-xr frame-target negotiation and worker-budget hints instead of a state-only lifecycle panel.",
  createState,
  updateState,
  describeState,
});
