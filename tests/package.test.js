import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createXrPerformanceHint,
  createXrStore,
  createXrManager,
  defaultXrWorkerBudgetProfile,
  isXrModeSupported,
  mergeXrSessionInit,
  readXrFrameRateCapabilities,
  requestXrSession,
  updateXrTargetFrameRate,
  xrReferenceSpaceTypes,
  xrSessionModes,
  xrWorkerQueueClass,
  xrWorkerSchedulerMode,
} from "../src/index.js";

class FakeXrSession extends EventTarget {
  constructor(mode, init, supportedFrameRates = [90, 72, 60]) {
    super();
    this.mode = mode;
    this.init = init;
    this.ended = false;
    this.supportedFrameRates = [...supportedFrameRates];
    this.frameRate = this.supportedFrameRates[0] ?? null;
  }

  async end() {
    this.ended = true;
    this.dispatchEvent(new Event("end"));
  }

  async updateTargetFrameRate(frameRate) {
    if (!this.supportedFrameRates.includes(frameRate)) {
      throw new Error(`Unsupported target frame rate: ${frameRate}`);
    }
    this.frameRate = frameRate;
  }
}

class FakeXrSystem {
  constructor(
    supportedModes = ["immersive-vr"],
    frameRatesByMode = {
      "immersive-vr": [90, 72, 60],
      "immersive-ar": [72, 60],
      inline: [60],
    }
  ) {
    this.supportedModes = new Set(supportedModes);
    this.frameRatesByMode = frameRatesByMode;
    this.lastRequest = null;
  }

  async isSessionSupported(mode) {
    return this.supportedModes.has(mode);
  }

  async requestSession(mode, init) {
    if (!this.supportedModes.has(mode)) {
      throw new Error(`Unsupported mode: ${mode}`);
    }
    this.lastRequest = { mode, init };
    return new FakeXrSession(mode, init, this.frameRatesByMode[mode]);
  }
}

test("exports expected XR session modes", () => {
  assert.deepEqual(xrSessionModes, ["inline", "immersive-vr", "immersive-ar"]);
  assert.deepEqual(xrReferenceSpaceTypes, [
    "viewer",
    "local",
    "local-floor",
    "bounded-floor",
    "unbounded",
  ]);
});

test("mergeXrSessionInit deduplicates required and optional features", () => {
  const merged = mergeXrSessionInit(
    {
      requiredFeatures: ["local-floor", "local-floor"],
      optionalFeatures: ["hand-tracking"],
    },
    {
      requiredFeatures: ["bounded-floor", "local-floor"],
      optionalFeatures: ["layers", "hand-tracking"],
      depthSensing: { usagePreference: ["gpu-optimized"] },
    }
  );

  assert.deepEqual(merged.requiredFeatures, ["local-floor", "bounded-floor"]);
  assert.deepEqual(merged.optionalFeatures, ["hand-tracking", "layers"]);
  assert.deepEqual(merged.depthSensing, { usagePreference: ["gpu-optimized"] });
});

test("isXrModeSupported returns false without navigator.xr", async () => {
  const supported = await isXrModeSupported("immersive-vr", { navigator: {} });
  assert.equal(supported, false);
});

test("isXrModeSupported returns false when xr API cannot probe support", async () => {
  const withoutProbe = await isXrModeSupported("immersive-vr", {
    navigator: { xr: {} },
  });
  assert.equal(withoutProbe, false);

  const throwingProbe = await isXrModeSupported("immersive-vr", {
    navigator: {
      xr: {
        async isSessionSupported() {
          throw new Error("probe failed");
        },
      },
    },
  });
  assert.equal(throwingProbe, false);
});

test("invalid XR mode is rejected by support probe and session requests", async () => {
  await assert.rejects(
    () => isXrModeSupported("immersive-space"),
    /Unknown XR session mode/
  );

  await assert.rejects(
    () =>
      requestXrSession({
        mode: "immersive-space",
        navigator: { xr: new FakeXrSystem(["immersive-vr"]) },
      }),
    /Unknown XR session mode/
  );
});

test("requestXrSession requests an immersive VR session with merged features", async () => {
  const fakeXr = new FakeXrSystem(["immersive-vr"]);

  const session = await requestXrSession({
    navigator: { xr: fakeXr },
    sessionInit: {
      optionalFeatures: ["depth-sensing"],
    },
  });

  assert.ok(session instanceof FakeXrSession);
  assert.equal(fakeXr.lastRequest.mode, "immersive-vr");
  assert.deepEqual(fakeXr.lastRequest.init.requiredFeatures, ["local-floor"]);
  assert.deepEqual(fakeXr.lastRequest.init.optionalFeatures, [
    "bounded-floor",
    "hand-tracking",
    "layers",
    "depth-sensing",
  ]);
});

test("requestXrSession fails when requestSession API is unavailable", async () => {
  await assert.rejects(
    () =>
      requestXrSession({
        navigator: { xr: { isSessionSupported: async () => true } },
      }),
    /requestSession API unavailable/
  );
});

test("readXrFrameRateCapabilities normalizes current and supported XR frame rates", () => {
  const capabilities = readXrFrameRateCapabilities(
    {
      frameRate: 72,
      supportedFrameRates: [60, 90, 72, 60],
      updateTargetFrameRate() {},
    },
    { mode: "immersive-vr" }
  );

  assert.deepEqual(capabilities, {
    mode: "immersive-vr",
    currentFrameRate: 72,
    supportedFrameRates: [90, 72, 60],
    refreshRateHz: 72,
    canUpdateTargetFrameRate: true,
  });
});

test("createXrPerformanceHint aligns XR frame targets with worker budget metadata", () => {
  const hint = createXrPerformanceHint({
    mode: "immersive-vr",
    session: {
      frameRate: 90,
      supportedFrameRates: [72, 90, 60],
      updateTargetFrameRate() {},
    },
    preferredFrameRates: [72, 60],
  });

  assert.equal(hint.targetFrameRate, 72);
  assert.equal(hint.targetFrameTimeMs, 1000 / 72);
  assert.deepEqual(hint.preferredFrameRates, [72, 60]);
  assert.deepEqual(hint.workerBudget, {
    queueClass: xrWorkerQueueClass,
    schedulerMode: xrWorkerSchedulerMode,
    profile: defaultXrWorkerBudgetProfile,
  });
  assert.equal(hint.rationale.length >= 3, true);
});

test("updateXrTargetFrameRate validates and applies supported rates", async () => {
  const session = new FakeXrSession("immersive-vr", {}, [90, 72, 60]);

  await assert.rejects(
    () => updateXrTargetFrameRate(session, 45),
    /is not supported by the active session/
  );

  const applied = await updateXrTargetFrameRate(session, 72);
  assert.equal(applied, 72);
  assert.equal(session.frameRate, 72);
});

test("mergeXrSessionInit drops empty feature lists", () => {
  const merged = mergeXrSessionInit(
    {
      requiredFeatures: [""],
      optionalFeatures: [null, "   "],
    },
    {}
  );

  assert.equal("requiredFeatures" in merged, false);
  assert.equal("optionalFeatures" in merged, false);
});

test("createXrStore supports subscribe, set, and reset", () => {
  const store = createXrStore({ mode: "inline", supportedModes: { inline: true } });
  const snapshots = [];
  const unsubscribe = store.subscribe((state) => snapshots.push({ ...state }));

  store.set({ isEntering: true });
  store.reset();
  unsubscribe();
  store.set({ mode: "immersive-vr" });

  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].isEntering, true);
  assert.equal(snapshots[1].mode, "inline");
  assert.equal(snapshots[1].targetFrameRate, null);
});

test("createXrManager tracks lifecycle for enter and exit", async () => {
  const fakeXr = new FakeXrSystem(["immersive-vr", "immersive-ar"]);
  const lifecycle = [];

  const manager = createXrManager({
    navigator: { xr: fakeXr },
    onSessionStart: (_session, mode) => lifecycle.push(`start:${mode}`),
    onSessionEnd: () => lifecycle.push("end"),
  });

  const supported = await manager.probeSupport(["immersive-vr", "immersive-ar"]);
  assert.deepEqual(supported, {
    "immersive-vr": true,
    "immersive-ar": true,
  });

  const session = await manager.enterVr({ optionalFeatures: ["depth-sensing"] });
  assert.ok(session instanceof FakeXrSession);
  assert.equal(manager.getState().mode, "immersive-vr");
  assert.equal(manager.getState().isEntering, false);
  assert.equal(manager.getState().targetFrameRate, 90);
  assert.equal(manager.getState().workerBudgetProfile, "xr");

  const exited = await manager.exitSession();
  assert.equal(exited, true);
  assert.equal(manager.getState().activeSession, null);
  assert.equal(manager.getState().mode, null);
  assert.equal(manager.getState().targetFrameRate, null);

  assert.deepEqual(lifecycle, ["start:immersive-vr", "end"]);
});

test("createXrManager returns existing session when already active", async () => {
  const fakeXr = new FakeXrSystem(["immersive-vr"]);
  const manager = createXrManager({ navigator: { xr: fakeXr } });

  const first = await manager.enterVr();
  const second = await manager.enterSession("immersive-vr");

  assert.equal(first, second);
  await manager.exitSession();
});

test("createXrManager captures enterSession errors and exposes lastError", async () => {
  const manager = createXrManager({
    navigator: {
      xr: {
        async requestSession() {
          throw "session failed";
        },
      },
    },
  });

  await assert.rejects(() => manager.enterVr(), /session failed/);
  assert.equal(manager.getState().isEntering, false);
  assert.equal(manager.getState().lastError, "session failed");
});

test("createXrManager exposes frame-rate capabilities and performance hints", async () => {
  const fakeXr = new FakeXrSystem(["immersive-vr"]);
  const manager = createXrManager({ navigator: { xr: fakeXr } });

  const preSessionCapabilities = manager.getFrameRateCapabilities();
  assert.equal(preSessionCapabilities.refreshRateHz, 90);
  assert.equal(preSessionCapabilities.canUpdateTargetFrameRate, false);

  await manager.enterVr();

  const capabilities = manager.getFrameRateCapabilities();
  assert.deepEqual(capabilities.supportedFrameRates, [90, 72, 60]);

  const hint = manager.getPerformanceHint({ preferredFrameRates: [72] });
  assert.equal(hint.targetFrameRate, 72);
  assert.equal(hint.workerBudget.profile, "xr");
});

test("createXrManager can update the active session target frame rate", async () => {
  const fakeXr = new FakeXrSystem(["immersive-vr"]);
  const manager = createXrManager({ navigator: { xr: fakeXr } });

  await manager.enterVr();
  const applied = await manager.setTargetFrameRate(72);

  assert.equal(applied, 72);
  assert.equal(manager.getState().currentFrameRate, 72);
  assert.equal(manager.getState().targetFrameRate, 72);
});

test("createXrManager rejects target frame updates without an active session", async () => {
  const manager = createXrManager({
    navigator: { xr: new FakeXrSystem(["immersive-vr"]) },
  });

  await assert.rejects(
    () => manager.setTargetFrameRate(72),
    /without an active XR session/
  );
});

test("exitSession returns false with no active session", async () => {
  const manager = createXrManager({
    navigator: { xr: new FakeXrSystem(["immersive-vr"]) },
  });

  assert.equal(await manager.exitSession(), false);
});

test("exitSession fallback handles sessions without end events", async () => {
  const session = {
    ended: false,
    async end() {
      this.ended = true;
    },
  };

  const manager = createXrManager({
    navigator: {
      xr: {
        async requestSession() {
          return session;
        },
      },
    },
  });

  await manager.enterVr();
  assert.equal(manager.getState().activeSession, session);

  const exited = await manager.exitSession();
  assert.equal(exited, true);
  assert.equal(manager.getState().activeSession, null);
});

test("dispose exits active session and resets store", async () => {
  const fakeXr = new FakeXrSystem(["immersive-vr", "immersive-ar"]);
  const manager = createXrManager({ navigator: { xr: fakeXr } });

  await manager.probeSupport(["immersive-vr", "immersive-ar"]);
  await manager.enterVr();
  await manager.dispose();

  const state = manager.getState();
  assert.equal(state.activeSession, null);
  assert.equal(state.mode, null);
  assert.equal(state.isEntering, false);
  assert.deepEqual(state.supportedModes, {});
});
