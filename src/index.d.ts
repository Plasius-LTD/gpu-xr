export type XrSessionMode = "inline" | "immersive-vr" | "immersive-ar";

export type XrReferenceSpaceType =
  | "viewer"
  | "local"
  | "local-floor"
  | "bounded-floor"
  | "unbounded";

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
  baseSessionInit?: XRSessionInit;
  onSessionStart?: (session: XRSession, mode: XrSessionMode) => void;
  onSessionEnd?: () => void;
}

export type XrWorkerBudgetProfile = "realtime" | "xr";

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
