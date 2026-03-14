# Adaptive Performance Integration

## Overview

`@plasius/gpu-xr` owns XR session lifecycle and now also owns XR runtime timing
signals. It does not negotiate platform policy by itself. Instead, it exposes
normalized frame-rate hints that higher-level control loops can consume.

## Contract Shape

- `readXrFrameRateCapabilities(...)`
  - normalize current and supported frame rates
  - expose whether runtime target-frame updates are available
- `createXrPerformanceHint(...)`
  - choose a target frame rate from preferred and supported values
  - convert that target into `targetFrameTimeMs`
  - attach worker-budget alignment metadata:
    - `queueClass: render`
    - `schedulerMode: dag`
    - `profile: xr` for immersive sessions
- `updateXrTargetFrameRate(...)`
  - apply a negotiated target rate back to the active session when supported

## Manager Integration

`createXrManager(...)` mirrors the same contract for the active session:

- `getFrameRateCapabilities()`
- `getPerformanceHint()`
- `setTargetFrameRate(...)`

The XR store now keeps:

- `currentFrameRate`
- `targetFrameRate`
- `supportedFrameRates`
- `canUpdateTargetFrameRate`
- `workerBudgetProfile`

## Boundary

`@plasius/gpu-xr` does not publish renderer-stage DAG nodes itself. The actual
render-stage manifest remains in `@plasius/gpu-renderer`. XR contributes timing
and mode-specific budget alignment so the governor can pick the correct worker
profile and frame target for headset sessions.
