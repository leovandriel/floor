import Calc, { point, epsilon } from './calc'
import Canvas, { color } from './canvas'

class Render {
  distanceSq = -1
  type = 'none'
  mouse = undefined
  points = []
  offsetSq = 1

  constructor(mouse, offset) {
    this.mouse = mouse
    this.offsetSq = offset * offset
  }

  wall(a, b) {
    if (!this.mouse) return
    const distanceSq = Calc.segmentDistanceSq(a, b, this.mouse)
    this.add(distanceSq + this.offsetSq / 2, 'wall', [a, b])
  }

  corner(a) {
    if (!this.mouse) return
    const distanceSq = Calc.pointDistanceSq(a, this.mouse)
    this.add(distanceSq, 'corner', [a])
  }

  add(distanceSq, type, points) {
    if (distanceSq < this.offsetSq && (this.distanceSq < 0 || this.distanceSq > distanceSq)) {
      this.distanceSq = distanceSq
      this.type = type
      this.points = points
    }
  }
}

export default class Scene {
  tileColor = color(.4, .4, .8)
  highlightColor = color(.5, .5, .9)
  avatarColor = color(.1, .1, .1)
  wallColor = color(0, 0, 0)
  mouseColor = color(1, 1, 0)

  showCurrent = false
  showSelf = false
  showTile = false

  current = 0
  position = point(.5, .2)
  rotation = 0
  scale = .2
  step = .03
  avatarRadius = 0.01
  plan

  canvas: Canvas

  constructor(canvas, plan) {
    this.canvas = canvas
    this.plan = plan
  }

  shiftShape(shape, offset) {
    switch (offset) {
      case 0:
        return shape
      case 1:
        const d = shape.x * shape.x + shape.y * shape.y
        return point(1 - shape.x / d, shape.y / d)
      case 2:
        const e = (1 - shape.x) * (1 - shape.x) + shape.y * shape.y
        return point((1 - shape.x) / e, shape.y / e)
    }
  }

  shiftCorner(p, q, a) {
    const d = point(q.x - p.x, q.y - p.y)
    return point(p.x + a.x * d.x - a.y * d.y, p.y + a.x * d.y + a.y * d.x)
  }

  renderAvatar(state, a) {
    this.canvas.setColor(this.avatarColor)
    this.canvas.drawCircle(a, this.avatarRadius, true)
  }

  renderMouse(state) {
    this.canvas.setColor(this.mouseColor)
    if (state.type === 'wall') {
      this.canvas.drawDouble(state.points[0], state.points[1], 4)
    } else if (state.type === 'corner') {
      this.canvas.drawCircle(state.points[0], 0.01)
    }
  }

  renderWall(state, p, q, v, w) {
    const p2 = Calc.intersect3(p, q, v)
    const q2 = Calc.intersect3(p, q, w)
    state.wall(p2, q2)
    if (Calc.close(p2, p)) {
      state.corner(p)
      const f = this.canvas.factor < 1 ? this.canvas.range * 10 : 2 / Calc.size(p)
      this.canvas.setColor(this.wallColor.alpha(.2), p)
      this.canvas.drawLine(p, point(p.x * f, p.y * f))
    }
    if (Calc.close(q2, q)) {
      state.corner(q)
      const f = this.canvas.factor < 1 ? this.canvas.range * 10 : 2 / Calc.size(q)
      this.canvas.setColor(this.wallColor.alpha(.2), q)
      this.canvas.drawLine(q, point(q.x * f, q.y * f))
    }
    this.canvas.setColor(this.wallColor)
    this.canvas.drawLine(p2, q2)
  }

  renderBackground(state) {
    this.canvas.setColor(this.canvas.background)
    this.canvas.drawRect(point(0, 0), this.canvas.size)
  }

  renderTile(state, a, b, c, v, w, highlight?) {
    this.canvas.setColor(highlight ? this.highlightColor : this.tileColor)
    if (!v) {
      this.canvas.drawPath([a, b, c], true)
      if (this.showTile) {
        this.canvas.setColor(this.highlightColor.alpha(.5))
      }
      this.canvas.drawPath([a, b, c], false)
      return
    }
    const path = []
    path.push(Calc.intersect3(a, c, v))
    if (Calc.isClockwise(v, b)) {
      path.push(Calc.intersect3(a, b, v))
    } else {
      path.push(Calc.intersect3(b, c, v))
    }
    if (Calc.isClockwise(v, b) && Calc.isClockwise(b, w)) {
      path.push(b)
    }
    if (Calc.isClockwise(b, w)) {
      path.push(Calc.intersect3(c, b, w))
    } else {
      path.push(Calc.intersect3(b, a, w))
    }
    path.push(Calc.intersect3(c, a, w))
    this.canvas.drawPath(path, true)
    if (this.showTile) {
      this.canvas.setColor(this.highlightColor.alpha(.5))
    }
    this.canvas.drawPath(path, false)
  }

  renderBranch(state, level, index, offset, p, q, v, w) {
    if (Calc.isClockwise(w, v)) {
      return
    }
    if ((p.x < -1 && q.x < -1)
     || (p.y < -1 && q.y < -1)
     || (p.x > 1 && q.x > 1)
     || (p.y > 1 && q.y > 1)) {
      return
    }
    if (index < 0) {
      if (level === 2) {
        this.renderWall(state, p, q, v, w)
      }
      return
    }
    const { shape, sides } = this.plan.tiles[index]
    const a = this.shiftShape(shape, offset)
    const r = this.shiftCorner(p, q, a)
    if (level === 0) {
      this.renderTile(state, p, r, q, v, w)
    }
    if (level === 1 && this.showSelf && index === this.current) {
      const a = this.shiftPosition(shape, offset, this.position)
      this.renderAvatar(state, this.shiftCorner(p, q, a))
    }
    const b1 = sides[(offset + 1) % 3]
    const b2 = sides[(offset + 2) % 3]
    this.renderBranch(state, level, b1.x, b1.y, p, r, Calc.isClockwise(p, v) ? v : p, Calc.isClockwise(w, r) ? w : r)
    this.renderBranch(state, level, b2.x, b2.y, r, q, Calc.isClockwise(r, v) ? v : r, Calc.isClockwise(w, q) ? w : q)
  }

  getCorners(shape) {
    const sin = Calc.sin(this.rotation)
    const cos = Calc.cos(this.rotation)
    const p = point(
      -(cos * this.position.x + -sin * this.position.y) * this.scale / this.canvas.range,
      -(sin * this.position.x + cos * this.position.y) * this.scale / this.canvas.range,
    )
    const q = point(
      -(cos * -(1 - this.position.x) + -sin * this.position.y) * this.scale / this.canvas.range,
      -(sin * -(1 - this.position.x) + cos * this.position.y) * this.scale / this.canvas.range,
    )
    const r = this.shiftCorner(p, q, shape)
    return { p, q, r }
  }

  renderTrunc(state, level) {
    const { shape, sides } = this.plan.tiles[this.current]
    const { p, q, r } = this.getCorners(shape)
    const corners = [p, q, r]
    this.renderTile(state, p, q, r, null, null, this.showCurrent)
    for (let i = 0; i < 3; i++) {
      const a = corners[(4 - i) % 3]
      const b = corners[(3 - i) % 3]
      this.renderBranch(state, level, sides[i].x, sides[i].y, a, b, a, b)
    }
  }

  render(action?) {
    const state = new Render(this.canvas.getMouse(), this.scale / this.canvas.range / 10)
    this.canvas.setWidth(4)
    this.renderBackground(state)
    for (let level = 0; level < 3; level++) {
      this.renderTrunc(state, level)
    }
    this.renderAvatar(state, point(0, 0))
    this.canvas.setWidth(2)
    this.renderMouse(state)
  }

  shiftPosition(shape, offset, position) {
    switch (offset) {
      case 0:
        return position
      case 1:
        const d = shape.x * shape.x + shape.y * shape.y
        return point(1 - (shape.x * position.x + shape.y * position.y) / d, (shape.y * position.x - shape.x * position.y) / d)
      case 2:
        const e = (1 - shape.x) * (1 - shape.x) + shape.y * shape.y
        return point(((1 - shape.x) * (1 - position.x) + shape.y * position.y) / e, (shape.y * (1 - position.x) - (1 - shape.x) * position.y) / e)
    }
  }

  unshiftPosition(shape, offset, position) {
    switch (offset) {
      case 0:
        return position
      case 1:
        return point(shape.x * (1 - position.x) + shape.y * position.y, shape.y * (1 - position.x) - shape.x * position.y)
      case 2:
        return point(1 - (1 - shape.x) * position.x - shape.y * position.y, shape.y * position.x - (1 - shape.x) * position.y)
    }
  }

  shiftRotation(shape, offset) {
    switch (offset) {
      case 0:
        return 0
      case 1:
        return Calc.atan2(shape.y, shape.x)
      case 2:
        return Calc.atan2(-shape.y, 1 - shape.x)
    }
  }

  shiftScale(shape, offset) {
    switch (offset) {
      case 0:
        return 1
      case 1:
        return Calc.size(shape)
      case 2:
        return Calc.size(point(1 - shape.x, shape.y))
    }
  }


  handleTransition(next, offset, nextOffset, shape, nextShape) {
    const shift1 = this.shiftPosition(shape, offset, next)
    const shift2 = point(1 - shift1.x, -shift1.y)
    return this.unshiftPosition(nextShape, nextOffset, shift2)
  }

  handlePhysics(next, wallCount = 0) {
    if (wallCount >= 2) return this.position
    const { shape, sides } = this.plan.tiles[this.current]
    const corners = [point(1, 0), point(0, 0), shape]
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3
      if (Calc.isClockwise3(corners[i], corners[j], next)) {
        const { x: t, y: u } = Calc.intersect4(corners[i], corners[j], this.position, next)
        if (t > -epsilon && t < (1 + epsilon) && u > -epsilon && u < 1 + epsilon) {
          const { x: index, y: offset } = sides[i]
          if (index < 0) {
            this.position = Calc.interpolate(this.position, next, u - epsilon)
            const intersection = Calc.interpolate(corners[i], corners[j], t)
            const next1 = Calc.project3(corners[i], intersection, next)
            const next2 = Calc.add(next1, this.position)
            this.handlePhysics(next2, wallCount + 1)
          } else {
            const { shape: nextShape } = this.plan.tiles[index]
            this.position = Calc.interpolate(this.position, next, u)
            this.position = this.handleTransition(this.position, i, offset, shape, nextShape)
            const shift3 = this.handleTransition(next, i, offset, shape, nextShape)
            this.rotation += this.shiftRotation(shape, i) - this.shiftRotation(nextShape, offset)
            if (i == offset) this.rotation += .5
            this.scale *= this.shiftScale(shape, i) / this.shiftScale(nextShape, offset)
            this.current = index
            this.handlePhysics(shift3, wallCount)
          }
          return
        }
      }
    }
    this.position = next
  }

  handleSnap() {
    const { shape } = this.plan.tiles[this.current]
    if (this.position.y < 0) this.position.y = 0
    if (this.position.y > shape.y) this.position.y = shape.y
    const min = shape.x * this.position.y / shape.y
    if (this.position.x < min) this.position.x = min
    const max = min + 1 - this.position.y / shape.y
    if (this.position.x > max) this.position.x = max
  }

  handleMove(delta) {
    if (Calc.zero(delta)) return
    const sin = Calc.sin(this.rotation)
    const cos = Calc.cos(this.rotation)
    let next = point(
      this.position.x + (cos * delta.x + sin * delta.y) * this.step / this.scale,
      this.position.y + (-sin * delta.x + cos * delta.y) * this.step / this.scale,
    )
    this.handlePhysics(next)
    this.handleSnap()
  }

  handleTurn(delta) {
    this.rotation += delta
  }

  unscale(p) {
    const p2 = this.canvas.unscale(p)
    return point(p.x * this.canvas.range / this.canvas.factor, p.y * -this.canvas.range / this.canvas.factor)
  }
}
