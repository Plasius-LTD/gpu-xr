const DEFAULT_VR_SESSION_INIT = Object.freeze({
  requiredFeatures: ["local-floor"],
  optionalFeatures: ["bounded-floor", "hand-tracking", "layers"],
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
      `Unknown XR session mode \"${mode}\". Available modes: ${available}.`
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

export function createXrStore(initialState = {}) {
  const listeners = new Set();
  let state = {
    activeSession: null,
    mode: null,
    isEntering: false,
    lastError: null,
    supportedModes: {},
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

      store.set({
        activeSession: session,
        mode,
        isEntering: false,
        lastError: null,
      });

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
    enterSession,
    enterVr,
    exitSession,
    dispose,
  };
}

export const defaultVrSessionInit = DEFAULT_VR_SESSION_INIT;
