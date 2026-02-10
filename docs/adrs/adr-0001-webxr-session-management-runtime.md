# ADR 0001: WebXR Session Management Runtime

- Status: Accepted
- Date: 2026-02-10

## Context

Plasius projects need VR session handling that does not depend on Three.js or
`@react-three/xr`. The current website migration target is a zero-Three stack,
so XR support must move into a dedicated package that can be consumed by any
rendering/runtime layer.

## Decision

Create `@plasius/gpu-xr` as a framework-agnostic WebXR runtime package.

- Provide session mode support probing (`isXrModeSupported`).
- Provide session creation with consistent feature merging (`requestXrSession`).
- Provide a lightweight session lifecycle manager (`createXrManager`).
- Keep integration contract independent from scene/rendering engine internals.

## Consequences

- Positive: XR handling is reusable across React, vanilla, and worker-driven pipelines.
- Positive: Three.js can be removed without blocking VR support.
- Negative: Existing R3F/XR convenience APIs must be replaced at call sites.

## Alternatives Considered

- Continue using `@react-three/xr`: Rejected because it keeps Three.js coupling.
- Put XR code inside each app: Rejected due to duplication and drift.
