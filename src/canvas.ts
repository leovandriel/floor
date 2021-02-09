import Calc, { point } from './calc'

const hexColor = c => '#' + [c.r, c.g, c.b, c.a].map(v => ('0' + Math.round(v * 255).toString(16)).substr(-2)).join('')

export const color = (r, g, b, a = 1) => ({
  r, g, b, a,
  alpha: function(a) { return color(this.r, this.g, this.b, a) },
  string: function() { return this.s || (this.s = hexColor(this)) },
})

export default class Canvas {
  private _size = point(0, 0)
  private _scale = 1
  private _factor = 1
  private _range = .5

  private _background = undefined
  private _context = undefined
  private _mouse = undefined

  private _gradientCache = {}

  constructor(context, size, background) {
    this._context = context
    this._size = size
    this._background = background
    this.cache()
  }

  get range() { return this._range }
  get size() { return this._size }
  get factor() { return this._factor }
  get background() { return this._background }

  zoom(factor) {
    this._factor *= factor
    this.cache()
  }

  warp(range) {
    this._range *= range
  }

  setSize(size) {
    this._size = size
    this.cache()
  }

  setMouse(mouse) {
    this._mouse = mouse
  }

  private cache() {
    this._scale = this._factor * Math.max(this._size.x, this._size.y) / 2
    this._gradientCache = {}
  }

  private createGradient(c) {
    const gradient = this._context.createRadialGradient(this._size.x / 2, this._size.y / 2, 0, this._size.x / 2, this._size.y / 2, this._scale)
    gradient.addColorStop(0, c.string())
    gradient.addColorStop(1, this._background.string())
    return gradient
  }

  private getGradient(c) {
    return this._gradientCache[c.string()] || (this._gradientCache[c.string()] = this.createGradient(c))
  }

  private interpolate(p, q, t) {
    return color(
      Math.round((p.r * (1 - t) + q.r * t) * 100) / 100,
      Math.round((p.g * (1 - t) + q.g * t) * 100) / 100,
      Math.round((p.b * (1 - t) + q.b * t) * 100) / 100,
      Math.round((p.a * (1 - t) + q.a * t) * 100) / 100,
    )
  }

  setWidth(width) {
    this._context.lineWidth = width * this._scale / this._range / 1000
  }

  private transform(p) {
    return [this._size.x / 2 + p.x * this._scale, this._size.y / 2 - p.y * this._scale]
  }

  setColor(c, vertical?) {
    if (vertical) {
      const length = Math.min(Calc.size(vertical), 1)
      const c2 = this.interpolate(c, this._background, length).string()
      this._context.fillStyle = c2
      this._context.strokeStyle = c2
    } else {
      const gradient = this.getGradient(c)
      this._context.fillStyle = gradient
      this._context.strokeStyle = gradient
    }
  }

  drawPath(path, fill?) {
    this._context.beginPath()
    this._context.moveTo(...this.transform(path[0]))
    for (let v of path.slice(1)) {
      this._context.lineTo(...this.transform(v))
    }
    this._context.closePath()
    if (fill) {
      this._context.fill()
    } else {
      this._context.stroke()
    }
  }

  drawLine(a, b) {
    this._context.beginPath()
    this._context.moveTo(...this.transform(a))
    this._context.lineTo(...this.transform(b))
    this._context.stroke()
  }

  drawDouble(a, b, width) {
    this._context.beginPath()
    const length = Math.sqrt(Calc.pointDistanceSq(a, b)) * 300 * this._range
    const p = point((b.y - a.y) / length, (a.x - b.x) / length)
    this._context.moveTo(...this.transform(point(a.x + p.x, a.y + p.y)))
    this._context.lineTo(...this.transform(point(a.x - p.x, a.y - p.y)))
    this._context.lineTo(...this.transform(point(b.x - p.x, b.y - p.y)))
    this._context.lineTo(...this.transform(point(b.x + p.x, b.y + p.y)))
    this._context.closePath()
    this._context.stroke()
  }

  drawCircle(a, r, fill?) {
    this._context.beginPath()
    this._context.arc(...this.transform(a), r / this._range * this._scale, 0, Math.PI * 2)
    if (fill) {
      this._context.fill()
    } else {
      this._context.stroke()
    }
  }

  drawRect(p, q) {
    this._context.fillRect(p.x, p.y, q.x, q.y)
  }

  untransform(p) {
    return point((p.x - this._size.x / 2) / this._scale, (this._size.y / 2 - p.y) / this._scale)
  }

  unscale(p) {
    return point(p.x / this._scale, p.y / -this._scale)
  }

  getMouse() {
    if (!this._mouse) return undefined
    return this.untransform(this._mouse)
  }
}
