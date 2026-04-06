floor
=====

*Navigating non-euclidian space*

![Screen shot](screen.jpg)

## Install

```bash
npm install
```

## Development

Start the dev server:

```bash
npm run dev
```

Rebuild on file changes without the dev server:

```bash
npm run watch
```

## Build

Compile the app into `dist/`:

```bash
npm run build
```

## Checks

Run the local checks:

```bash
npm run check
```

Or run them individually:

```bash
npm run test
npm run lint
npm run typecheck
```

## Controls

The app starts on `grid` by default.

### Movement

- `ArrowUp` or `W`: move forward
- `ArrowDown` or `S`: move backward
- `A`: move left
- `D`: move right
- `ArrowLeft` or `Q`: turn left
- `ArrowRight` or `E`: turn right
- drag with the mouse: move by dragging the view

### Navigation Tuning

- `1`: decrease warp
- `2`: increase warp
- `3`: zoom out
- `4`: zoom in
- `5`: decrease local scale
- `6`: increase local scale

### Navigation

- `F`: previous plan
- `G`: next plan

### Modes

- `Z`: cycle render mode
- `C`: cycle topology mode

Render modes:

- `Canvas`
- `WebGL`
- `WebGL Checker`
- `WebGL Light`

Topology modes:

- `None`
- `Decycle Lazy`
- `Decycle Determ.`

`warp`, `zoom`, and `scale` affect slightly different parts of the rendering:

- `warp` changes the canvas projection range
- `zoom` changes the canvas zoom factor
- `scale` changes the avatar's local scale inside the current tile system

The movement model is intentionally non-Euclidean, so turning and wrapping may feel unusual at first.

### Debug Toggle

- `X`: toggle debug overlays
- `R`: reset the current plan state

## URLs

Plan and tile id live in the path:

- `/grid`
- `/grid/123`

The remaining view state is stored in query parameters.

## License

[MIT](LICENSE.txt)
