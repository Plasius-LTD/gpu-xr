const DEFAULT_VR_SESSION_INIT = Object.freeze({
  requiredFeatures: ["local-floor"],
  optionalFeatures: ["bounded-floor", "hand-tracking", "layers"],
});
const DEFAULT_REFERENCE_SPACE_TYPE = "local-floor";
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

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeQuaternion(value, fallback = [0, 0, 0, 1]) {
  const source = Array.isArray(value)
    ? value
    : [value?.x, value?.y, value?.z, value?.w];
  const quaternion = [
    finiteNumber(source?.[0], fallback[0]),
    finiteNumber(source?.[1], fallback[1]),
    finiteNumber(source?.[2], fallback[2]),
    finiteNumber(source?.[3], fallback[3]),
  ];
  const length = Math.hypot(
    quaternion[0],
    quaternion[1],
    quaternion[2],
    quaternion[3]
  );
  if (length <= 1e-6) {
    return [...fallback];
  }
  return quaternion.map((component) => component / length);
}

function rotateVecByQuaternion(vector, quaternion) {
  const [qx, qy, qz, qw] = normalizeQuaternion(quaternion);
  const ix = qw * vector[0] + qy * vector[2] - qz * vector[1];
  const iy = qw * vector[1] + qz * vector[0] - qx * vector[2];
  const iz = qw * vector[2] + qx * vector[1] - qy * vector[0];
  const iw = -qx * vector[0] - qy * vector[1] - qz * vector[2];
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

function normalizeVec3(value, fallback = [0, 0, 0]) {
  const source = Array.isArray(value)
    ? value
    : [value?.x, value?.y, value?.z];
  return [
    finiteNumber(source?.[0], fallback[0]),
    finiteNumber(source?.[1], fallback[1]),
    finiteNumber(source?.[2], fallback[2]),
  ];
}

function normalizeDirection(value, fallback = [0, 0, -1]) {
  const vector = normalizeVec3(value, fallback);
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length <= 1e-6) {
    return [...fallback];
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function readMatrix(value) {
  if (!value) {
    return [];
  }
  try {
    return Array.from(value).map((entry) => finiteNumber(entry, 0));
  } catch {
    return [];
  }
}

function readPoseTransform(transform, fallbackPosition = [0, 0, 0]) {
  if (!transform || typeof transform !== "object") {
    return null;
  }
  const position = normalizeVec3(transform.position, fallbackPosition);
  const orientation = normalizeQuaternion(transform.orientation, [0, 0, 0, 1]);
  const matrix = readMatrix(transform.matrix);
  const forward = normalizeDirection(
    matrix.length >= 16
      ? [-matrix[8], -matrix[9], -matrix[10]]
      : rotateVecByQuaternion([0, 0, -1], orientation),
    [0, 0, -1]
  );
  const up = normalizeDirection(
    matrix.length >= 16
      ? [matrix[4], matrix[5], matrix[6]]
      : rotateVecByQuaternion([0, 1, 0], orientation),
    [0, 1, 0]
  );
  return {
    position,
    orientation,
    forward,
    up,
    matrix,
  };
}

function readPoseLike(pose, fallbackPosition = [0, 0, 0]) {
  if (!pose || typeof pose !== "object") {
    return null;
  }
  const transformed = readPoseTransform(
    pose.transform ?? pose,
    fallbackPosition
  );
  if (!transformed) {
    return null;
  }
  return {
    position: transformed.position,
    orientation: transformed.orientation,
    forward: transformed.forward,
    up: transformed.up,
    emulatedPosition: pose.emulatedPosition === true,
    linearVelocity: normalizeVec3(pose.linearVelocity, [0, 0, 0]),
    angularVelocity: normalizeVec3(pose.angularVelocity, [0, 0, 0]),
    transformMatrix: transformed.matrix,
    radius: readPositiveNumber(pose.radius),
  };
}

function readGamepadButtons(gamepad) {
  if (!gamepad || !Array.isArray(gamepad.buttons)) {
    return [];
  }
  return gamepad.buttons.map((button, index) => ({
    index,
    pressed: button?.pressed === true,
    touched: button?.touched === true,
    value: clamp(finiteNumber(button?.value, 0), 0, 1),
  }));
}

function readGamepadAxes(gamepad) {
  if (!gamepad || !Array.isArray(gamepad.axes)) {
    return [];
  }
  return gamepad.axes.map((axis) => clamp(finiteNumber(axis, 0), -1, 1));
}

function readHapticActuators(gamepad) {
  if (!gamepad || !Array.isArray(gamepad.hapticActuators)) {
    return [];
  }
  return gamepad.hapticActuators.map((actuator, index) => ({
    index,
    type: typeof actuator?.type === "string" ? actuator.type : "unknown",
    canPulse: typeof actuator?.pulse === "function",
  }));
}

function toInputSourceId(inputSource, index) {
  const profile = Array.isArray(inputSource?.profiles) && inputSource.profiles.length > 0
    ? inputSource.profiles[0]
    : "unknown";
  const handedness = String(inputSource?.handedness ?? "none");
  const targetRayMode = String(inputSource?.targetRayMode ?? "unknown");
  return `${handedness}:${targetRayMode}:${profile}:${index}`;
}

function readHandJoints(frame, hand, referenceSpace) {
  if (!hand) {
    return [];
  }
  const joints = [];
  try {
    for (const entry of hand.entries()) {
      const [name, jointSpace] = entry;
      const pose = typeof frame?.getJointPose === "function"
        ? frame.getJointPose(jointSpace, referenceSpace)
        : null;
      const snapshot = readPoseLike(pose);
      joints.push({
        name,
        pose: snapshot,
      });
    }
  } catch {
    return [];
  }
  return joints;
}

function readInputSourceSnapshot(inputSource, frame, referenceSpace, index) {
  const targetRayPose =
    typeof frame?.getPose === "function" && inputSource?.targetRaySpace
      ? readPoseLike(frame.getPose(inputSource.targetRaySpace, referenceSpace))
      : readPoseLike(inputSource?.targetRayPose);
  const gripPose =
    typeof frame?.getPose === "function" && inputSource?.gripSpace
      ? readPoseLike(frame.getPose(inputSource.gripSpace, referenceSpace))
      : readPoseLike(inputSource?.gripPose);
  const gamepad = inputSource?.gamepad
    ? {
        id: String(inputSource.gamepad.id ?? ""),
        mapping: String(inputSource.gamepad.mapping ?? ""),
        connected: inputSource.gamepad.connected !== false,
        axes: readGamepadAxes(inputSource.gamepad),
        buttons: readGamepadButtons(inputSource.gamepad),
        hapticActuators: readHapticActuators(inputSource.gamepad),
      }
    : null;
  const handJoints = readHandJoints(frame, inputSource?.hand, referenceSpace);

  return {
    id: toInputSourceId(inputSource, index),
    handedness: String(inputSource?.handedness ?? "none"),
    targetRayMode: String(inputSource?.targetRayMode ?? "unknown"),
    profiles: dedupeStrings(inputSource?.profiles),
    primaryProfile:
      Array.isArray(inputSource?.profiles) && inputSource.profiles.length > 0
        ? String(inputSource.profiles[0])
        : null,
    kind: inputSource?.hand ? "hand" : gamepad ? "controller" : "pointer",
    targetRayPose,
    gripPose,
    gamepad,
    hand: handJoints.length > 0 ? { joints: handJoints } : null,
    selectPressed: gamepad?.buttons?.[0]?.pressed === true,
    squeezePressed: gamepad?.buttons?.[1]?.pressed === true,
    hasHaptics:
      Array.isArray(gamepad?.hapticActuators) && gamepad.hapticActuators.length > 0,
  };
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

function assertReferenceSpaceType(type) {
  if (!xrReferenceSpaceTypes.includes(type)) {
    const available = xrReferenceSpaceTypes.join(", ");
    throw new Error(
      `Unknown XR reference space type "${type}". Available types: ${available}.`
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

export function readXrViewerPoseSnapshot(frame, referenceSpace, options = {}) {
  const pose =
    typeof frame?.getViewerPose === "function"
      ? frame.getViewerPose(referenceSpace)
      : options.viewerPose ?? frame?.viewerPose ?? null;
  const basePose = readPoseLike(pose);
  const views = Array.isArray(pose?.views)
    ? pose.views.map((view) => {
        const viewPose = readPoseLike(view?.transform);
        return {
          eye: typeof view?.eye === "string" ? view.eye : "none",
          position: viewPose?.position ?? [0, 0, 0],
          orientation: viewPose?.orientation ?? [0, 0, 0, 1],
          projectionMatrix: readMatrix(view?.projectionMatrix),
          transformMatrix: viewPose?.transformMatrix ?? [],
        };
      })
    : [];

  return {
    available: Boolean(basePose),
    position: basePose?.position ?? [0, 0, 0],
    orientation: basePose?.orientation ?? [0, 0, 0, 1],
    forward: basePose?.forward ?? [0, 0, -1],
    up: basePose?.up ?? [0, 1, 0],
    emulatedPosition: basePose?.emulatedPosition === true,
    views,
  };
}

export function readXrInputSnapshot(frame, referenceSpace, options = {}) {
  const inputSources = Array.isArray(options.inputSources)
    ? options.inputSources
    : Array.from(options.session?.inputSources ?? frame?.session?.inputSources ?? []);
  return inputSources.map((inputSource, index) =>
    readInputSourceSnapshot(inputSource, frame, referenceSpace, index)
  );
}

export function readXrFrameSnapshot(frame, referenceSpace, options = {}) {
  const session = options.session ?? frame?.session ?? null;
  return {
    timestamp: finiteNumber(frame?.predictedDisplayTime ?? frame?.timestamp, 0),
    referenceSpaceType: String(
      options.referenceSpaceType ?? referenceSpace?.type ?? DEFAULT_REFERENCE_SPACE_TYPE
    ),
    viewer: readXrViewerPoseSnapshot(frame, referenceSpace, options),
    inputSources: readXrInputSnapshot(frame, referenceSpace, {
      ...options,
      session,
    }),
    sessionMode: typeof session?.mode === "string" ? session.mode : null,
  };
}

export async function dispatchXrHapticRequest(inputSources, request = {}) {
  const amplitude = clamp(finiteNumber(request.amplitude, 0.6), 0, 1);
  const durationMs = Math.max(1, finiteNumber(request.durationMs, 40));
  const targetId = request.target?.id ?? null;
  const targetHandedness = request.target?.handedness ?? null;
  const targetSources = Array.isArray(inputSources)
    ? inputSources
    : Array.from(inputSources?.inputSources ?? []);
  const matched = targetSources.filter((inputSource, index) => {
    if (targetId && toInputSourceId(inputSource, index) !== targetId) {
      return false;
    }
    if (targetHandedness && inputSource?.handedness !== targetHandedness) {
      return false;
    }
    return true;
  });
  let pulses = 0;

  for (const inputSource of matched) {
    const actuators = Array.isArray(inputSource?.gamepad?.hapticActuators)
      ? inputSource.gamepad.hapticActuators
      : [];
    for (const actuator of actuators) {
      if (typeof actuator?.pulse === "function") {
        await actuator.pulse(amplitude, durationMs);
        pulses += 1;
      }
    }
  }

  return {
    pulses,
    amplitude,
    durationMs,
  };
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
    referenceSpaceType: DEFAULT_REFERENCE_SPACE_TYPE,
    referenceSpace: null,
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
        referenceSpaceType: DEFAULT_REFERENCE_SPACE_TYPE,
        referenceSpace: null,
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
    referenceSpaceType = DEFAULT_REFERENCE_SPACE_TYPE,
    baseSessionInit = DEFAULT_VR_SESSION_INIT,
    onSessionStart,
    onSessionEnd,
  } = options;

  assertSessionMode(defaultMode);
  assertReferenceSpaceType(referenceSpaceType);

  const store = createXrStore({ referenceSpaceType });
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
      referenceSpace: null,
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

  const requestReferenceSpace = async (
    type = store.getSnapshot().referenceSpaceType ?? referenceSpaceType
  ) => {
    assertReferenceSpaceType(type);
    const { activeSession } = store.getSnapshot();
    if (!activeSession || typeof activeSession.requestReferenceSpace !== "function") {
      const fallbackSpace = { type };
      store.set({
        referenceSpaceType: type,
        referenceSpace: fallbackSpace,
      });
      return fallbackSpace;
    }

    const referenceSpace = await activeSession.requestReferenceSpace(type);
    store.set({
      referenceSpaceType: type,
      referenceSpace,
    });
    return referenceSpace;
  };

  const getReferenceSpace = () => store.getSnapshot().referenceSpace;

  const getReferenceSpaceType = () => store.getSnapshot().referenceSpaceType;

  const setReferenceSpaceType = async (type) => {
    return requestReferenceSpace(type);
  };

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
      referenceSpaceType: store.getSnapshot().referenceSpaceType,
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
      await requestReferenceSpace(store.getSnapshot().referenceSpaceType);

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

  const readFrameSnapshot = (frame, snapshotOptions = {}) => {
    const state = store.getSnapshot();
    return readXrFrameSnapshot(
      frame,
      snapshotOptions.referenceSpace ?? state.referenceSpace,
      {
        session: snapshotOptions.session ?? state.activeSession,
        referenceSpaceType:
          snapshotOptions.referenceSpaceType ?? state.referenceSpaceType,
      }
    );
  };

  const readInputSnapshotForFrame = (frame, snapshotOptions = {}) => {
    const state = store.getSnapshot();
    return readXrInputSnapshot(
      frame,
      snapshotOptions.referenceSpace ?? state.referenceSpace,
      {
        session: snapshotOptions.session ?? state.activeSession,
      }
    );
  };

  const dispatchHapticRequest = async (request, hapticOptions = {}) => {
    const state = store.getSnapshot();
    return dispatchXrHapticRequest(
      hapticOptions.inputSources ?? state.activeSession,
      request
    );
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
    getReferenceSpace,
    getReferenceSpaceType,
    setReferenceSpaceType,
    requestReferenceSpace,
    probeSupport,
    getFrameRateCapabilities,
    getPerformanceHint,
    enterSession,
    enterVr,
    setTargetFrameRate,
    exitSession,
    readFrameSnapshot,
    readInputSnapshot: readInputSnapshotForFrame,
    dispatchHapticRequest,
    dispose,
  };
}

export const defaultVrSessionInit = DEFAULT_VR_SESSION_INIT;
