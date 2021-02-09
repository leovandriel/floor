export const point = (x, y) => ({ x, y })
export const epsilon = 1e-5

export default class Calc {
  static size(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y)
  }

  static pointDistanceSq(a, b) {
    return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)
  }

  static lineDistanceSq(a, b, c) {
    const n = (b.y - a.y) * c.x - (b.x - a.x) * c.y + b.x * a.y + b.y * a.x
    return n * n / this.pointDistanceSq(a, b)
  }

  static segmentDistanceSq(a, b, c) {
    const p = ((c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y)) / this.pointDistanceSq(a, b)
    const q = this.interpolate(a, b, Math.max(0, Math.min(1, p)))
    return this.pointDistanceSq(q, c)
  }

  static close(a, b) {
    return this.zero(this.sub(a, b))
  }

  static zero(a) {
    return Math.abs(a.x) < epsilon && Math.abs(a.y) < epsilon
  }

  static sin(v) {
    return Math.sin(v * Math.PI * 2)
  }

  static cos(v) {
    return Math.cos(v * Math.PI * 2)
  }

  static atan2(y, x) {
    return Math.atan2(y, x) / Math.PI / 2
  }

  static noise() {
    return (2 * Math.random() - 1) * 1e-3
  }

  static interpolate(p, q, t) {
    return point(
      p.x * (1 - t) + q.x * t,
      p.y * (1 - t) + q.y * t,
    )
  }

  static isClockwise(a, b) {
    return a.x * b.y < a.y * b.x
  }

  static isClockwise3(a, b, c) {
    return (a.x - b.x) * (c.y - b.y) < (a.y - b.y) * (c.x - b.x)
  }

  static project3(a, b, c) {
    return this.project(this.sub(a, b), this.sub(c, b))
  }

  static add(a, b) {
    return point(a.x + b.x, a.y + b.y)
  }

  static sub(a, b) {
    return point(a.x - b.x, a.y - b.y)
  }

  static dot(a, b) {
    return a.x * b.x + a.y * b.y
  }

  static cross(a, b) {
    return a.x * b.y - a.y * b.x
  }

  static mul(a, b) {
    return point(a.x * b, a.y * b)
  }

  static project(a, b) {
    return this.mul(a, this.dot(a, b) / this.dot(a, a))
  }

  static intersect4(a, b, c, d) {
    const e = (a.x - b.x) * (c.y - d.y) - (c.x - d.x) * (a.y - b.y)
    return point(
      ((a.x - c.x) * (c.y - d.y) - (c.x - d.x) * (a.y - c.y)) / e,
      ((a.x - c.x) * (a.y - b.y) - (a.x - b.x) * (a.y - c.y)) / e,
    )
  }

  static intersect3(a, b, d) {
    const c = point(0, 0)
    const e = (a.x - b.x) * (c.y - d.y) - (c.x - d.x) * (a.y - b.y)
    return point(
      ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) / e,
      ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) / e,
    )
  }
}