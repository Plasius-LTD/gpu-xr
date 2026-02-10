# @plasius/gpu-xr

[![npm version](https://img.shields.io/npm/v/@plasius/gpu-xr)](https://www.npmjs.com/package/@plasius/gpu-xr)
[![license](https://img.shields.io/github/license/Plasius-LTD/gpu-xr)](./LICENSE)

Framework-agnostic WebXR session management for Plasius GPU rendering projects.
This package isolates VR session lifecycle and capability probing so app layers can
replace Three.js and still keep immersive workflows.

Apache-2.0. ESM + CJS builds.

## Install

```sh
npm install @plasius/gpu-xr
```

## Usage

```js
import { createXrManager } from "@plasius/gpu-xr";

const xr = createXrManager();
await xr.probeSupport(["immersive-vr"]);

const session = await xr.enterVr({
  optionalFeatures: ["depth-sensing", "layers"],
});

// ... bind WebGPU render state to the session ...

await xr.exitSession();
```

## API

- `isXrModeSupported(mode, options)`
- `requestXrSession(options)`
- `createXrStore(initialState)`
- `createXrManager(options)`
- `mergeXrSessionInit(base, override)`
- `defaultVrSessionInit`

## Demo

Run the demo server from the repo root:

```sh
cd gpu-xr
npm run demo
```

Then open `http://localhost:8000/gpu-xr/demo/`.

## Files

- `src/index.js`: XR runtime/session manager and store.
- `tests/package.test.js`: Unit tests for support probing and lifecycle handling.
- `docs/adrs/*`: XR architecture decisions.
