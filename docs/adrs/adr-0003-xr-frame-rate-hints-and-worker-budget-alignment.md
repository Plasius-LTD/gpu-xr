# ADR 0003: XR Frame-Rate Hints and Worker-Budget Alignment

- Status: Accepted
- Date: 2026-03-14

## Context

`@plasius/gpu-performance` negotiates device-specific frame targets, but XR
runtime details such as current frame rate, supported frame-rate buckets, and
target-frame updates belong to the active XR session. Without an XR-owned
contract, apps have to duplicate browser-specific probing and manually keep XR
timing aligned with renderer worker budgets.

## Decision

Extend `@plasius/gpu-xr` with:

- `readXrFrameRateCapabilities(...)` for normalized session frame-rate data
- `createXrPerformanceHint(...)` for adaptive-performance inputs
- `updateXrTargetFrameRate(...)` for runtime target updates when the session
  supports them
- manager methods and store fields that expose the same data for active sessions

The performance hint also publishes worker-budget alignment metadata:

- `queueClass: render`
- `schedulerMode: dag`
- `profile: xr` for immersive sessions

## Consequences

- Positive: XR timing stays owned by the XR package instead of leaking into
  renderer or app glue.
- Positive: `gpu-performance` can consume XR-specific frame-rate ranges without
  coupling to browser APIs.
- Negative: The XR store surface grows and must remain backward compatible.

## Alternatives Considered

- Put XR frame-rate probing directly into `@plasius/gpu-performance`: Rejected
  because WebXR session capabilities belong to `@plasius/gpu-xr`.
- Keep XR frame targeting entirely in apps: Rejected because it duplicates
  fragile runtime probing logic and drifts from worker-budget integration.
