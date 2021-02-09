import { point } from './calc'

export const planBox = { tiles: [
  { shape: point(.5, .5), sides: [point(-1, 0), point(0, 2), point(0, 1)] },
]}

export const planBase = { tiles: [
  { shape: point(0, 1), sides: [point(-1, 0), point(-1, 0), point(1, 0)] },
  { shape: point(0, 1), sides: [point(0, 2), point(2, 0), point(-1, 0)] },
  { shape: point(0, 1), sides: [point(1, 1), point(3, 0), point(-1, 0)] },
  { shape: point(0, 1), sides: [point(2, 1), point(4, 0), point(-1, 0)] },
  { shape: point(.5, .5), sides: [point(3, 1), point(-1, 0), point(-1, 0)] },
]}

export const planTunnel = { tiles: [
  { shape: point(.5, .5), sides: [point(-1, 0), point(0, 1), point(0, 2)] },
]}

export const planCurl = { tiles: [
  { shape: point(0, 1.), sides: [point(-1, 0), point(-1, 0), point(1, 0)] },
  { shape: point(-.0820, .9016), sides: [point(0, 2), point(2, 0), point(-1, 0)] },
  { shape: point(-.1, .1), sides: [point(1, 1), point(-1, 0), point(3, 0)] },
  { shape: point(-.0820, .9016), sides: [point(2, 2), point(4, 0), point(-1, 0)] },
  { shape: point(-.1, .1), sides: [point(3, 1), point(-1, 0), point(5, 0)] },
  { shape: point(-.0820, .9016), sides: [point(4, 2), point(6, 0), point(-1, 0)] },
  { shape: point(-.1, 1.1), sides: [point(5, 1), point(7, 0), point(-1, 0)] },
  { shape: point(.5902, .4918), sides: [point(6, 1), point(-1, 0), point(-1, 0)] },
]}

export const planGrid = { tiles: [
  { shape: point(0, 1), sides: [point(3, 1), point(-1, 0), point(1, 0)] },
  { shape: point(.5, .5), sides: [point(0, 2), point(2, 0), point(-1, 0)] },
  { shape: point(0, 1), sides: [point(1, 1), point(4, 0), point(3, 0)] },
  { shape: point(.5, .5), sides: [point(2, 2), point(0, 0), point(5, 2)] },
  { shape: point(1, 1), sides: [point(2, 1), point(5, 0), point(-1, 0)] },
  { shape: point(.5, .5), sides: [point(4, 1), point(-1, 0), point(3, 2)] },
]}

export const planInfinite = { tiles: [
  { shape: point(.5, .5), sides: [point(0, 0), point(0, 1), point(0, 2)] },
]}

export const planCircle = { tiles: [
  { shape: point(-.25, .97), sides: [point(1, 0), point(-1, 0), point(1, 2)] },
  { shape: point(.38, 1.45), sides: [point(0, 0), point(-1, 0), point(0, 2)] },
]}

export const planSpiral = { tiles: [
  { shape: point(-.25, .97), sides: [point(1, 0), point(-1, 0), point(1, 2)] },
  { shape: point(.1, 2.0), sides: [point(0, 0), point(-1, 0), point(0, 2)] },
]}

export function checkPlan(plan) {
  const { tiles } = plan
  for (let i = 0; i < tiles.length; i++) {
    const { shape, sides } = tiles[i]
    if (shape.y < -1e-5) {
      console.error(`warn: flipped tile at ${i}`)
    } else if (shape.y < 1e-5) {
      console.error(`warn: flat tile at ${i}`)
    }
    for (let j = 0; j < 3; j++) {
      const { x: index, y: offset } = sides[j]
      if (index >= 0) {
        const { x: i2, y: j2 } = tiles[index].sides[offset]
        if (i !== i2) {
          console.error(`warn: inverse missing at ${i}:${j}`)
        }
        if (j !== j2) {
          console.error(`warn: inverse offset at ${i}:${j}`)
        }
      }
    }
  }
}
