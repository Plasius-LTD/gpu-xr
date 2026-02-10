# ADR 0002: Framework-Agnostic Session Store

- Status: Accepted
- Date: 2026-02-10

## Context

XR session state has to be observable by multiple UI/runtime layers. Coupling
state management to React or a specific renderer would recreate the same
framework lock-in we are removing.

## Decision

Expose an internal-neutral store (`createXrStore`) and evented manager
(`createXrManager`) with:

- snapshot reads (`getSnapshot`),
- subscriptions (`subscribe`),
- lifecycle state (`activeSession`, `mode`, `isEntering`, `lastError`),
- support map updates (`supportedModes`).

## Consequences

- Positive: Any UI layer can subscribe to XR state without adapters.
- Positive: Tests can run in Node by injecting navigator fakes.
- Negative: Consumers must wire their own framework bindings.

## Alternatives Considered

- React hooks-first API: Rejected due to framework lock-in.
- Class-only runtime without store: Rejected due to poor external observability.
