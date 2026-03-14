const DEFAULT_VR_SESSION_INIT = Object.freeze({
  requiredFeatures: ["local-floor"],
  optionalFeatures: ["bounded-floor", "hand-tracking", "layers"],
});
const DEFAULT_MODE_FRAME_RATES = Object.freeze({
  inline: 60,
  "immersive-vr": 90,
  "immersive-ar": 72,
});

export const xrSessionModes = Object.freeze([
  "inline",
  "immersive-vr",
  "immersive-ar",
]);

export const xrReferenceSpaceTypes = Object.freeze([
  "viewer",
  "local",
  "local-floor",
  "bounded-floor",
  "unbounded",
]);
export const xrWorkerQueueClass = "render";
export const xrWorkerSchedulerMode = "dag";
export const defaultXrWorkerBudgetProfile = "xr";

function toStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function dedupeStrings(values) {
  return [...new Set(toStringArray(values))];
}

function readPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function normalizeFrameRates(values) {
  if (!values || typeof values === "string") {
    return Object.freeze([]);
  }

  let collected;
  try {
    collected = Array.from(values);
  } catch {
    return Object.freeze([]);
  }

  return Object.freeze(
    [...new Set(collected.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))].sort(
      (left, right) => right - left
    )
  );
}

function getDefaultFrameRateForMode(mode) {
  return DEFAULT_MODE_FRAME_RATES[mode] ?? DEFAULT_MODE_FRAME_RATES["immersive-vr"];
}

function getWorkerBudgetProfileForMode(mode) {
  return mode === "inline" ? "realtime" : defaultXrWorkerBudgetProfile;
}

function readNavigator(navigatorOverride) {
  const currentNavigator = navigatorOverride ?? globalThis.navigator;
  if (!currentNavigator || typeof currentNavigator !== "object") {
    throw new Error(
      "WebXR navigator unavailable. Provide a browser navigator with navigator.xr."
    );
  }
  return currentNavigator;
}

function readXrSystem(navigatorOverride) {
  const currentNavigator = readNavigator(navigatorOverride);
  const xr = currentNavigator.xr;
  if (!xr || typeof xr !== "object") {
    throw new Error(
      "WebXR runtime unavailable. navigator.xr is missing in this environment."
    );
  }
  return xr;
}

function assertSessionMode(mode) {
  if (!xrSessionModes.includes(mode)) {
    const available = xrSessionModes.join(", ");
    throw new Error(
      `Unknown XR session mode "${mode}". Available modes: ${available}.`
    );
  }
}

export function mergeXrSessionInit(base = {}, override = {}) {
  const requiredFeatures = dedupeStrings([
    ...toStringArray(base.requiredFeatures),
    ...toStringArray(override.requiredFeatures),
  ]);

  const optionalFeatures = dedupeStrings([
    ...toStringArray(base.optionalFeatures),
    ...toStringArray(override.optionalFeatures),
  ]);

  const merged = {
    ...base,
    ...override,
    requiredFeatures,
    optionalFeatures,
  };

  if (requiredFeatures.length === 0) {
    delete merged.requiredFeatures;
  }

  if (optionalFeatures.length === 0) {
    delete merged.optionalFeatures;
  }

  return merged;
}

export async function isXrModeSupported(
  mode = "immersive-vr",
  options = {}
) {
  assertSessionMode(mode);

  const { navigator: navigatorOverride } = options;
  let xr;
  try {
    xr = readXrSystem(navigatorOverride);
  } catch {
    return false;
  }

  if (typeof xr.isSessionSupported !== "function") {
    return false;
  }

  try {
    return Boolean(await xr.isSessionSupported(mode));
  } catch {
    return false;
  }
}

export async function requestXrSession(options = {}) {
  const {
    mode = "immersive-vr",
    sessionInit = {},
    baseSessionInit = DEFAULT_VR_SESSION_INIT,
    navigator: navigatorOverride,
  } = options;

  assertSessionMode(mode);

  const xr = readXrSystem(navigatorOverride);

  if (typeof xr.requestSession !== "function") {
    throw new Error("WebXR requestSession API unavailable.");
  }

  const init = mergeXrSessionInit(baseSessionInit, sessionInit);
  return xr.requestSession(mode, init);
}

export function readXrFrameRateCapabilities(session, options = {}) {
  const {
    mode = "immersive-vr",
    fallbackFrameRates = [],
    defaultFrameRate,
  } = options;

  assertSessionMode(mode);

  const sessionFrameRate = readPositiveNumber(session?.frameRate);
  const supportedFrameRates = normalizeFrameRates(session?.supportedFrameRates);
  const fallbackRates = normalizeFrameRates(fallbackFrameRates);
  const mergedSupported = supportedFrameRates.length
    ? [...supportedFrameRates]
    : [...fallbackRates];

  if (sessionFrameRate && !mergedSupported.includes(sessionFrameRate)) {
    mergedSupported.push(sessionFrameRate);
    mergedSupported.sort((left, right) => right - left);
  }

  const refreshRateHz =
    sessionFrameRate ??
    mergedSupported[0] ??
    readPositiveNumber(defaultFrameRate) ??
    getDefaultFrameRateForMode(mode);

  return Object.freeze({
    mode,
    currentFrameRate: sessionFrameRate,
    supportedFrameRates: Object.freeze(mergedSupported),
    refreshRateHz,
    canUpdateTargetFrameRate:
      Boolean(session) && typeof session.updateTargetFrameRate === "function",
  });
}

export function createXrPerformanceHint(options = {}) {
  const {
    session = null,
    mode = "immersive-vr",
    preferredFrameRates = [],
    fallbackFrameRates = [],
    defaultFrameRate,
  } = options;

  const capabilities = readXrFrameRateCapabilities(session, {
    mode,
    fallbackFrameRates,
    defaultFrameRate,
  });

  const filteredPreferredFrameRates = normalizeFrameRates(preferredFrameRates).filter(
    (frameRate) =>
      capabilities.supportedFrameRates.length === 0 ||
      capabilities.supportedFrameRates.includes(frameRate)
  );

  const derivedPreferredFrameRates = filteredPreferredFrameRates.length
    ? filteredPreferredFrameRates
    : capabilities.supportedFrameRates.length
      ? capabilities.supportedFrameRates
      : Object.freeze([capabilities.refreshRateHz]);
  const targetFrameRate =
    derivedPreferredFrameRates[0] ?? capabilities.refreshRateHz;
  const rationale = [];

  if (capabilities.currentFrameRate) {
    rationale.push(
      `XR session reports a current frame rate of ${capabilities.currentFrameRate}Hz.`
    );
  } else {
    rationale.push("XR session does not expose a current frame rate; using defaults.");
  }

  if (capabilities.supportedFrameRates.length) {
    rationale.push(
      `XR runtime exposes supported frame rates: ${capabilities.supportedFrameRates.join(", ")}Hz.`
    );
  } else {
    rationale.push("XR runtime does not expose supported frame rates; using fallback targets.");
  }

  if (filteredPreferredFrameRates.length) {
    rationale.push("Preferred XR frame rates were filtered against runtime-supported values.");
  } else {
    rationale.push("XR target frame rate defaults to the highest available runtime target.");
  }

  return Object.freeze({
    ...capabilities,
    preferredFrameRates: Object.freeze([...derivedPreferredFrameRates]),
    targetFrameRate,
    targetFrameTimeMs: 1000 / targetFrameRate,
    workerBudget: Object.freeze({
      queueClass: xrWorkerQueueClass,
      schedulerMode: xrWorkerSchedulerMode,
      profile: getWorkerBudgetProfileForMode(mode),
    }),
    rationale: Object.freeze(rationale),
  });
}

export async function updateXrTargetFrameRate(session, frameRate) {
  if (!session || typeof session !== "object") {
    throw new Error("XR session is required to update target frame rate.");
  }

  const requestedFrameRate = readPositiveNumber(frameRate);
  if (!requestedFrameRate) {
    throw new Error("XR target frame rate must be a finite number greater than zero.");
  }

  if (typeof session.updateTargetFrameRate !== "function") {
    throw new Error("XR session does not support updateTargetFrameRate(frameRate).");
  }

  const supportedFrameRates = normalizeFrameRates(session.supportedFrameRates);
  if (
    supportedFrameRates.length > 0 &&
    !supportedFrameRates.includes(requestedFrameRate)
  ) {
    throw new Error(
      `XR target frame rate ${requestedFrameRate}Hz is not supported by the active session.`
    );
  }

  await session.updateTargetFrameRate(requestedFrameRate);
  return requestedFrameRate;
}

export function createXrStore(initialState = {}) {
  const listeners = new Set();
  let state = {
    activeSession: null,
    mode: null,
    isEntering: false,
    lastError: null,
    supportedModes: {},
    currentFrameRate: null,
    targetFrameRate: null,
    supportedFrameRates: [],
    canUpdateTargetFrameRate: false,
    workerBudgetProfile: null,
    ...initialState,
  };

  const notify = () => {
    for (const listener of listeners) {
      listener(state);
    }
  };

  return {
    getSnapshot() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(partialState) {
      state = {
        ...state,
        ...partialState,
      };
      notify();
    },
    reset() {
      state = {
        activeSession: null,
        mode: null,
        isEntering: false,
        lastError: null,
        supportedModes: {},
        currentFrameRate: null,
        targetFrameRate: null,
        supportedFrameRates: [],
        canUpdateTargetFrameRate: false,
        workerBudgetProfile: null,
        ...initialState,
      };
      notify();
    },
  };
}

export function createXrManager(options = {}) {
  const {
    navigator: navigatorOverride,
    defaultMode = "immersive-vr",
    baseSessionInit = DEFAULT_VR_SESSION_INIT,
    onSessionStart,
    onSessionEnd,
  } = options;

  assertSessionMode(defaultMode);

  const store = createXrStore();
  let activeSessionEndHandler = null;

  const detachSessionEndHandler = () => {
    const { activeSession } = store.getSnapshot();
    if (
      activeSession &&
      activeSessionEndHandler &&
      typeof activeSession.removeEventListener === "function"
    ) {
      activeSession.removeEventListener("end", activeSessionEndHandler);
    }
    activeSessionEndHandler = null;
  };

  const handleSessionEnded = () => {
    detachSessionEndHandler();
    store.set({
      activeSession: null,
      mode: null,
      isEntering: false,
      currentFrameRate: null,
      targetFrameRate: null,
      supportedFrameRates: [],
      canUpdateTargetFrameRate: false,
      workerBudgetProfile: null,
    });
    if (typeof onSessionEnd === "function") {
      onSessionEnd();
    }
  };

  const attachSessionEndHandler = (session) => {
    if (!session || typeof session.addEventListener !== "function") {
      return;
    }
    activeSessionEndHandler = handleSessionEnded;
    session.addEventListener("end", activeSessionEndHandler);
  };

  const getState = () => store.getSnapshot();

  const subscribe = (listener) => store.subscribe(listener);

  const getFrameRateCapabilities = (options = {}) => {
    const state = store.getSnapshot();
    return readXrFrameRateCapabilities(
      options.session ?? state.activeSession,
      {
        mode: options.mode ?? state.mode ?? defaultMode,
        fallbackFrameRates:
          options.fallbackFrameRates ?? state.supportedFrameRates,
        defaultFrameRate:
          options.defaultFrameRate ??
          state.targetFrameRate ??
          state.currentFrameRate ??
          undefined,
      }
    );
  };

  const getPerformanceHint = (options = {}) => {
    const state = store.getSnapshot();
    return createXrPerformanceHint({
      session: options.session ?? state.activeSession,
      mode: options.mode ?? state.mode ?? defaultMode,
      preferredFrameRates:
        options.preferredFrameRates ??
        (state.targetFrameRate ? [state.targetFrameRate] : []),
      fallbackFrameRates:
        options.fallbackFrameRates ?? state.supportedFrameRates,
      defaultFrameRate:
        options.defaultFrameRate ??
        state.targetFrameRate ??
        state.currentFrameRate ??
        undefined,
    });
  };

  const syncSessionPerformanceState = (session, mode, preferredFrameRates = []) => {
    const hint = createXrPerformanceHint({
      session,
      mode,
      preferredFrameRates,
    });

    store.set({
      activeSession: session,
      mode,
      isEntering: false,
      lastError: null,
      currentFrameRate: hint.currentFrameRate,
      targetFrameRate: hint.targetFrameRate,
      supportedFrameRates: hint.supportedFrameRates,
      canUpdateTargetFrameRate: hint.canUpdateTargetFrameRate,
      workerBudgetProfile: hint.workerBudget.profile,
    });

    return hint;
  };

  const probeSupport = async (modes = [defaultMode]) => {
    const supportedModes = {};
    for (const mode of modes) {
      assertSessionMode(mode);
      supportedModes[mode] = await isXrModeSupported(mode, {
        navigator: navigatorOverride,
      });
    }
    store.set({ supportedModes });
    return supportedModes;
  };

  const enterSession = async (mode = defaultMode, sessionInit = {}) => {
    assertSessionMode(mode);

    const existing = store.getSnapshot().activeSession;
    if (existing) {
      return existing;
    }

    store.set({ isEntering: true, lastError: null });

    try {
      const session = await requestXrSession({
        mode,
        sessionInit,
        baseSessionInit,
        navigator: navigatorOverride,
      });

      attachSessionEndHandler(session);
      syncSessionPerformanceState(session, mode);

      if (typeof onSessionStart === "function") {
        onSessionStart(session, mode);
      }

      return session;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown XR error");
      store.set({
        isEntering: false,
        lastError: message,
      });
      throw error;
    }
  };

  const enterVr = async (sessionInit = {}) => {
    return enterSession("immersive-vr", sessionInit);
  };

  const setTargetFrameRate = async (frameRate) => {
    const state = store.getSnapshot();
    const activeSession = state.activeSession;
    if (!activeSession) {
      throw new Error(
        "Cannot update XR target frame rate without an active XR session."
      );
    }

    try {
      const appliedFrameRate = await updateXrTargetFrameRate(
        activeSession,
        frameRate
      );
      syncSessionPerformanceState(activeSession, state.mode ?? defaultMode, [
        appliedFrameRate,
      ]);
      return appliedFrameRate;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown XR error");
      store.set({ lastError: message });
      throw error;
    }
  };

  const exitSession = async () => {
    const { activeSession } = store.getSnapshot();
    if (!activeSession) {
      return false;
    }

    if (typeof activeSession.end === "function") {
      await activeSession.end();
    }

    // Fallback for test fakes or runtimes that do not emit an end event.
    if (store.getSnapshot().activeSession) {
      handleSessionEnded();
    }

    return true;
  };

  const dispose = async () => {
    await exitSession();
    detachSessionEndHandler();
    store.reset();
  };

  return {
    store,
    getState,
    subscribe,
    probeSupport,
    getFrameRateCapabilities,
    getPerformanceHint,
    enterSession,
    enterVr,
    setTargetFrameRate,
    exitSession,
    dispose,
  };
}

export const defaultVrSessionInit = DEFAULT_VR_SESSION_INIT;
