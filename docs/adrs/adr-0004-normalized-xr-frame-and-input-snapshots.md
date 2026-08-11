# ADR 0004: Normalized XR Frame and Input Snapshots

## Status

Accepted

## Context

`@plasius/gpu-xr` already owned WebXR session lifecycle and performance hints.
The multimodal camera-controls platform needs a renderer-agnostic way to read
viewer pose, controller state, hand joints, and haptic capabilities without
making each consumer parse raw WebXR frame objects differently.

## Decision

Extend `@plasius/gpu-xr` with normalized snapshot contracts for:

- frame snapshots
- viewer pose snapshots
- controller and hand input snapshots
- gamepad buttons/axes/haptics
- explicit haptic request translation

The XR manager now owns the requested reference space and exposes
`readFrameSnapshot(...)`, `readInputSnapshot(...)`, and
`dispatchHapticRequest(...)` so higher layers can consume stable data while the
package remains the WebXR adapter boundary.

## Consequences

- `@plasius/gpu-camera-controls` can consume stable XR snapshots instead of raw
  browser objects.
- Browser routes and tests can mock one normalized XR contract.
- Controller labels and component metadata stay lazily owned by the XR package
  rather than leaking through camera or route code.
