import Scene from './scene'
import Canvas, { color } from './canvas'
import Calc, { point, epsilon } from './calc'
import { planCurl as plan, checkPlan } from './library'

export default class Setup {
  scene: Scene
  lastDrag = undefined

  handleKey(event) {
    switch (event.keyCode) {
      case 37: // left
      case 81: // Q
        this.scene.handleTurn(-.05 + Calc.noise())
        break
      case 39: // right
      case 69: // E
        this.scene.handleTurn(.05 + Calc.noise())
        break
      case 38: // up
      case 87: // W
        this.scene.handleMove(point(0 + Calc.noise(), 1 + Calc.noise()))
        break
      case 40: // down
      case 83: // S
        this.scene.handleMove(point(0 + Calc.noise(), -1 + Calc.noise()))
        break
      case 65: // A
        this.scene.handleMove(point(-1 + Calc.noise(), 0 + Calc.noise()))
        break
      case 68: // D
        this.scene.handleMove(point(1 + Calc.noise(), 0 + Calc.noise()))
        break
      case 86: // V
        this.scene.showTile = !this.scene.showTile
        break
      case 67: // C
        this.scene.showCurrent = !this.scene.showCurrent
        break
      case 88: // X
        this.scene.showSelf = !this.scene.showSelf
        break
      case 187: // +
        this.scene.canvas.warp(1 / 1.1)
        break
      case 189: // -
        this.scene.canvas.warp(1.1)
        break
      case 48: // 0
        this.scene.canvas.zoom(1.1)
        break
      case 57: // 9
        this.scene.canvas.zoom(1 / 1.1)
        break
      case 56: // 8
        this.scene.scale *= 1.1
        break
      case 55: // 7
        this.scene.scale /= 1.1
        break
      default:
        return
    }
    this.scene.render()
  }

  handleMouse(event, action) {
    const p = point(event.pageX, event.pageY)
    if (!this.lastDrag && action === 'down') {
      this.lastDrag = p
    } else if (this.lastDrag && action === 'up') {
      this.lastDrag = undefined
    } else if (this.lastDrag && action === 'move') {
      const delta = this.scene.unscale(point(this.lastDrag.x - p.x, this.lastDrag.y - p.y))
      this.scene.handleMove(point(delta.x * 0.085 + Calc.noise(), delta.y * 0.085 + Calc.noise()))
      this.lastDrag = p
      action = 'drag'
    }
    const mouse = action === 'out' ? undefined : p
    this.scene.canvas.setMouse(mouse)
    this.scene.render(action)
  }

  handleResize(context) {
    const size = this.loadResize(context)
    this.scene.canvas.setSize(size)
    this.scene.render()
  }

  loadContext() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement
    const message = document.getElementById('message')
    if (canvas.getContext) {
      message.remove()
      return canvas.getContext('2d')
    } else {
      canvas.remove()
      message.innerHTML = 'Your browser does not support canvas rendering.'
      return undefined
    }
  }

  loadResize(context) {
    const size = point(window.innerWidth, window.innerHeight)
    context.canvas.width = size.x * 2
    context.canvas.height = size.y * 2
    context.canvas.style.width = size.x + 'px'
    context.canvas.style.height = size.y + 'px'
    context.scale(2, 2)
    return size
  }

  loadScene(context) {
    const size = this.loadResize(context)
    const canvas2 = new Canvas(context, size, color(.8, .8, .8))
    return new Scene(canvas2, plan)
  }

  loadHandlers(context) {
    document.onkeydown = event => this.handleKey(event)
    window.addEventListener('resize', event => this.handleResize(context))
    document.onmousemove = event => this.handleMouse(event, 'move')
    document.onmouseout = event => this.handleMouse(event, 'out')
    document.onmousedown = event => this.handleMouse(event, 'down')
    document.onmouseup = event => this.handleMouse(event, 'up')
  }

  load() {
    checkPlan(plan)
    const context = this.loadContext()
    if (!context) return
    this.scene = this.loadScene(context)
    this.scene.render()
    this.loadHandlers(context)
  }

  static init() {
    (window as any).load = function() { new Setup().load() }
  }
}

