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

export interface XrManager {
  store: XrStore;
  getState(): XrStoreState;
  subscribe(listener: (state: XrStoreState) => void): () => void;
  probeSupport(
    modes?: XrSessionMode[]
  ): Promise<Partial<Record<XrSessionMode, boolean>>>;
  enterSession(mode?: XrSessionMode, sessionInit?: XRSessionInit): Promise<XRSession>;
  enterVr(sessionInit?: XRSessionInit): Promise<XRSession>;
  exitSession(): Promise<boolean>;
  dispose(): Promise<void>;
}

export const xrSessionModes: readonly XrSessionMode[];
export const xrReferenceSpaceTypes: readonly XrReferenceSpaceType[];
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

export function createXrStore(initialState?: Partial<XrStoreState>): XrStore;

export function createXrManager(options?: XrManagerOptions): XrManager;
