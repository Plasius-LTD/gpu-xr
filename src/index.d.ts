export type XrSessionMode = "inline" | "immersive-vr" | "immersive-ar";

export type XrReferenceSpaceType =
  | "viewer"
  | "local"
  | "local-floor"
  | "bounded-floor"
  | "unbounded";

export type XrWorkerBudgetProfile = "realtime" | "xr";
export type XrVec3 = [number, number, number];
export type XrQuaternion = [number, number, number, number];
export type XrReferenceSpaceLike = XRReferenceSpace | { type: string } | null;

export interface XrPoseSnapshot {
  position: XrVec3;
  orientation: XrQuaternion;
  forward: XrVec3;
  up: XrVec3;
  emulatedPosition: boolean;
  linearVelocity: XrVec3;
  angularVelocity: XrVec3;
  transformMatrix: readonly number[];
  radius: number | null;
}

export interface XrViewSnapshot {
  eye: "left" | "right" | "none" | string;
  position: XrVec3;
  orientation: XrQuaternion;
  projectionMatrix: readonly number[];
  transformMatrix: readonly number[];
}

export interface XrViewerPoseSnapshot {
  available: boolean;
  position: XrVec3;
  orientation: XrQuaternion;
  forward: XrVec3;
  up: XrVec3;
  emulatedPosition: boolean;
  views: XrViewSnapshot[];
}

export interface XrGamepadButtonSnapshot {
  index: number;
  pressed: boolean;
  touched: boolean;
  value: number;
}

export interface XrGamepadHapticActuatorSnapshot {
  index: number;
  type: string;
  canPulse: boolean;
}

export interface XrGamepadSnapshot {
  id: string;
  mapping: string;
  connected: boolean;
  axes: number[];
  buttons: XrGamepadButtonSnapshot[];
  hapticActuators: XrGamepadHapticActuatorSnapshot[];
}

export interface XrHandJointSnapshot {
  name: string;
  pose: XrPoseSnapshot | null;
}

export interface XrHandSnapshot {
  joints: XrHandJointSnapshot[];
}

export interface XrInputSourceSnapshot {
  id: string;
  handedness: string;
  targetRayMode: string;
  profiles: string[];
  primaryProfile: string | null;
  kind: "hand" | "controller" | "pointer";
  targetRayPose: XrPoseSnapshot | null;
  gripPose: XrPoseSnapshot | null;
  gamepad: XrGamepadSnapshot | null;
  hand: XrHandSnapshot | null;
  selectPressed: boolean;
  squeezePressed: boolean;
  hasHaptics: boolean;
}

export interface XrFrameSnapshot {
  timestamp: number;
  referenceSpaceType: string;
  viewer: XrViewerPoseSnapshot;
  inputSources: XrInputSourceSnapshot[];
  sessionMode: XrSessionMode | null;
}

export interface XrHapticRequest {
  amplitude?: number;
  durationMs?: number;
  target?: {
    id?: string | null;
    handedness?: string | null;
  };
}

export interface XrStoreState {
  activeSession: XRSession | null;
  mode: XrSessionMode | null;
  isEntering: boolean;
  lastError: string | null;
  supportedModes: Partial<Record<XrSessionMode, boolean>>;
  currentFrameRate: number | null;
  targetFrameRate: number | null;
  supportedFrameRates: readonly number[];
  canUpdateTargetFrameRate: boolean;
  workerBudgetProfile: XrWorkerBudgetProfile | null;
  referenceSpaceType: XrReferenceSpaceType;
  referenceSpace: XrReferenceSpaceLike;
}

export interface XrStore {
  getSnapshot(): XrStoreState;
  subscribe(listener: (state: XrStoreState) => void): () => void;
  set(partialState: Partial<XrStoreState>): void;
  reset(): void;
}

export interface IsXrModeSupportedOptions {
  navigator?: Navigator | { xr?: unknown };
}

export interface RequestXrSessionOptions {
  mode?: XrSessionMode;
  sessionInit?: XRSessionInit;
  baseSessionInit?: XRSessionInit;
  navigator?: Navigator | { xr?: unknown };
}

export interface XrManagerOptions {
  navigator?: Navigator | { xr?: unknown };
  defaultMode?: XrSessionMode;
  referenceSpaceType?: XrReferenceSpaceType;
  baseSessionInit?: XRSessionInit;
  onSessionStart?: (session: XRSession, mode: XrSessionMode) => void;
  onSessionEnd?: () => void;
}

export interface XrFrameRateCapabilitiesOptions {
  mode?: XrSessionMode;
  fallbackFrameRates?: readonly number[];
  defaultFrameRate?: number;
}

export interface XrFrameRateCapabilities {
  mode: XrSessionMode;
  currentFrameRate: number | null;
  supportedFrameRates: readonly number[];
  refreshRateHz: number;
  canUpdateTargetFrameRate: boolean;
}

export interface XrPerformanceHintOptions extends XrFrameRateCapabilitiesOptions {
  session?: XRSession | null;
  preferredFrameRates?: readonly number[];
}

export interface XrPerformanceHint extends XrFrameRateCapabilities {
  preferredFrameRates: readonly number[];
  targetFrameRate: number;
  targetFrameTimeMs: number;
  workerBudget: Readonly<{
    queueClass: typeof xrWorkerQueueClass;
    schedulerMode: typeof xrWorkerSchedulerMode;
    profile: XrWorkerBudgetProfile;
  }>;
  rationale: readonly string[];
}

export interface XrManager {
  store: XrStore;
  getState(): XrStoreState;
  subscribe(listener: (state: XrStoreState) => void): () => void;
  getReferenceSpace(): XrReferenceSpaceLike;
  getReferenceSpaceType(): XrReferenceSpaceType;
  setReferenceSpaceType(type: XrReferenceSpaceType): Promise<XrReferenceSpaceLike>;
  requestReferenceSpace(type?: XrReferenceSpaceType): Promise<XrReferenceSpaceLike>;
  probeSupport(
    modes?: XrSessionMode[]
  ): Promise<Partial<Record<XrSessionMode, boolean>>>;
  getFrameRateCapabilities(
    options?: XrFrameRateCapabilitiesOptions & { session?: XRSession | null }
  ): XrFrameRateCapabilities;
  getPerformanceHint(options?: XrPerformanceHintOptions): XrPerformanceHint;
  enterSession(mode?: XrSessionMode, sessionInit?: XRSessionInit): Promise<XRSession>;
  enterVr(sessionInit?: XRSessionInit): Promise<XRSession>;
  setTargetFrameRate(frameRate: number): Promise<number>;
  exitSession(): Promise<boolean>;
  readFrameSnapshot(
    frame: XRFrame | unknown,
    options?: {
      session?: XRSession | null;
      referenceSpace?: XrReferenceSpaceLike;
      referenceSpaceType?: XrReferenceSpaceType;
    }
  ): XrFrameSnapshot;
  readInputSnapshot(
    frame: XRFrame | unknown,
    options?: {
      session?: XRSession | null;
      referenceSpace?: XrReferenceSpaceLike;
    }
  ): XrInputSourceSnapshot[];
  dispatchHapticRequest(
    request: XrHapticRequest,
    options?: {
      inputSources?: XRSession | { inputSources?: Iterable<XRInputSource> } | Iterable<XRInputSource>;
    }
  ): Promise<{
    pulses: number;
    amplitude: number;
    durationMs: number;
  }>;
  dispose(): Promise<void>;
}

export const xrSessionModes: readonly XrSessionMode[];
export const xrReferenceSpaceTypes: readonly XrReferenceSpaceType[];
export const xrWorkerQueueClass: "render";
export const xrWorkerSchedulerMode: "dag";
export const defaultXrWorkerBudgetProfile: "xr";
export const defaultVrSessionInit: Readonly<XRSessionInit>;

export function mergeXrSessionInit(
  base?: XRSessionInit,
  override?: XRSessionInit
): XRSessionInit;

export function isXrModeSupported(
  mode?: XrSessionMode,
  options?: IsXrModeSupportedOptions
): Promise<boolean>;

export function requestXrSession(options?: RequestXrSessionOptions): Promise<XRSession>;

export function readXrViewerPoseSnapshot(
  frame: XRFrame | unknown,
  referenceSpace: XrReferenceSpaceLike,
  options?: {
    viewerPose?: XRViewerPose | unknown;
  }
): XrViewerPoseSnapshot;

export function readXrInputSnapshot(
  frame: XRFrame | unknown,
  referenceSpace: XrReferenceSpaceLike,
  options?: {
    session?: XRSession | null;
    inputSources?: Iterable<XRInputSource> | unknown[];
  }
): XrInputSourceSnapshot[];

export function readXrFrameSnapshot(
  frame: XRFrame | unknown,
  referenceSpace: XrReferenceSpaceLike,
  options?: {
    session?: XRSession | null;
    referenceSpaceType?: XrReferenceSpaceType | string;
  }
): XrFrameSnapshot;

export function dispatchXrHapticRequest(
  inputSources: XRSession | { inputSources?: Iterable<XRInputSource> } | Iterable<XRInputSource> | null,
  request?: XrHapticRequest
): Promise<{
  pulses: number;
  amplitude: number;
  durationMs: number;
}>;

export function readXrFrameRateCapabilities(
  session: XRSession | null | undefined,
  options?: XrFrameRateCapabilitiesOptions
): XrFrameRateCapabilities;

export function createXrPerformanceHint(
  options?: XrPerformanceHintOptions
): XrPerformanceHint;

export function updateXrTargetFrameRate(
  session: XRSession,
  frameRate: number
): Promise<number>;

export function createXrStore(initialState?: Partial<XrStoreState>): XrStore;

export function createXrManager(options?: XrManagerOptions): XrManager;
