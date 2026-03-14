# TDR 0001: XR Adaptive Performance Hint Contract

- Status: Accepted
- Date: 2026-03-14

## Context

The XR package needs to expose enough information for adaptive-performance
governors to negotiate headset-native frame targets, while keeping the API
small, serializable, and independent from renderer internals.

## Decision

Define a two-layer XR performance contract:

- `readXrFrameRateCapabilities(...)`
  - current frame rate
  - supported frame-rate buckets
  - runtime refresh hint
  - whether the session supports `updateTargetFrameRate(...)`
- `createXrPerformanceHint(...)`
  - preferred and chosen target frame rates
  - target frame time in milliseconds
  - worker-budget alignment metadata:
    `queueClass`, `schedulerMode`, `profile`
  - rationale strings for diagnostics

`createXrManager(...)` forwards the same contract through:

- `getFrameRateCapabilities()`
- `getPerformanceHint()`
- `setTargetFrameRate(...)`

## Consequences

- Positive: apps can compose XR timing with `@plasius/gpu-performance` without
  touching raw session fields directly.
- Positive: worker-budget alignment stays explicit and observable.
- Negative: callers still need renderer manifests from `@plasius/gpu-renderer`
  for actual frame-stage DAG topology.
