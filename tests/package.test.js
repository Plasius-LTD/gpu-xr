import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createXrManager,
  isXrModeSupported,
  mergeXrSessionInit,
  requestXrSession,
  xrSessionModes,
} from "../src/index.js";

class FakeXrSession extends EventTarget {
  constructor(mode, init) {
    super();
    this.mode = mode;
    this.init = init;
    this.ended = false;
  }

  async end() {
    this.ended = true;
    this.dispatchEvent(new Event("end"));
  }
}

class FakeXrSystem {
  constructor(supportedModes = ["immersive-vr"]) {
    this.supportedModes = new Set(supportedModes);
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
    return new FakeXrSession(mode, init);
  }
}

test("exports expected XR session modes", () => {
  assert.deepEqual(xrSessionModes, ["inline", "immersive-vr", "immersive-ar"]);
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

  const exited = await manager.exitSession();
  assert.equal(exited, true);
  assert.equal(manager.getState().activeSession, null);
  assert.equal(manager.getState().mode, null);

  assert.deepEqual(lifecycle, ["start:immersive-vr", "end"]);
});
