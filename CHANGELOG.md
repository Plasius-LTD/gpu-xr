# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 - 2026-02-10

- Initial scaffold for `@plasius/gpu-xr`.
- Added framework-agnostic WebXR support probing and session lifecycle APIs.
- Added unit tests, demo, and ADR documentation.

## [Unreleased]

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.9] - 2026-04-02

- **Added**
  - Contract tests that keep the demo on the public `@plasius/gpu-shared`
    browser import surface.

- **Changed**
  - Updated the README to describe the live 3D XR staging scene and visible
    capability state correctly.

- **Fixed**
  - Removed the demo's deep import of `@plasius/gpu-shared` internals in favor
    of an import-map-backed package import.

- **Security**
  - (placeholder)

## [0.1.8] - 2026-03-23

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.7] - 2026-03-14

- **Added**
  - Added XR frame-rate capability helpers for current, supported, and
    updatable runtime targets.
  - Added XR performance hints that align immersive sessions with `render` /
    `dag` worker-budget metadata for adaptive performance.
  - Added XR manager methods and store state for observing and updating active
    session frame targets.
  - Added ADR, TDR, and design docs for XR adaptive-performance integration.

- **Changed**
  - Clarified README guidance for negotiated XR frame targets and worker-budget
    alignment.
  - Updated GitHub Actions workflows to run JavaScript actions on Node 24,
    refreshed core workflow action versions, and switched Codecov uploads to
    the Codecov CLI.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.6] - 2026-03-04

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.2] - 2026-03-01

- **Added**
  - `lint`, `typecheck`, and security audit scripts for local and CI enforcement.

- **Changed**
  - CI now fails early on lint/typecheck/runtime dependency audit before build/test.

- **Fixed**
  - Pack-check regex cleanup to remove an unnecessary path escape.

- **Security**
  - Runtime dependency vulnerability checks are now enforced in CI.

## [0.1.1] - 2026-02-28

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.0] - 2026-02-11

- **Added**
  - Initial release.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)
[0.1.1]: https://github.com/Plasius-LTD/gpu-xr/releases/tag/v0.1.1
[0.1.2]: https://github.com/Plasius-LTD/gpu-xr/releases/tag/v0.1.2
[0.1.6]: https://github.com/Plasius-LTD/gpu-xr/releases/tag/v0.1.6
[0.1.7]: https://github.com/Plasius-LTD/gpu-xr/releases/tag/v0.1.7
[0.1.8]: https://github.com/Plasius-LTD/gpu-xr/releases/tag/v0.1.8
[0.1.9]: https://github.com/Plasius-LTD/gpu-xr/releases/tag/v0.1.9
