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

## Usage

## Controls

### Movement

- `ArrowUp` or `W`: move forward
- `ArrowDown` or `S`: move backward
- `A`: move left
- `D`: move right
- `ArrowLeft` or `Q`: turn left
- `ArrowRight` or `E`: turn right
- drag with the mouse: move by dragging the view

### Navigation Tuning

- `=` or numpad `+`: decrease warp
- `-` or numpad `-`: increase warp
- `0` or numpad `0`: zoom in
- `9` or numpad `9`: zoom out
- `8` or numpad `8`: increase local scene scale
- `7` or numpad `7`: decrease local scene scale

`warp`, `zoom`, and `scene scale` affect slightly different parts of the rendering:

- `warp` changes the canvas projection range
- `zoom` changes the canvas zoom factor
- `scene scale` changes the avatar's local scale inside the current tile system

The movement model is intentionally non-Euclidean, so turning and wrapping may feel unusual at first.

### Debug Toggles

- `V`: show tile outlines more clearly
- `C`: highlight the current tile
- `X`: show the avatar in recursively rendered copies of the scene

## License

[MIT](LICENSE.txt)
