export interface Point {
  x: number
  y: number
}

// 针的渲染尺寸（px）：坐标以左上角为锚点，集中在这里避免样式与逻辑漂移。
export const NEEDLE_WIDTH = 48
export const NEEDLE_HEIGHT = 64
export const NEEDLE_HALF = { x: NEEDLE_WIDTH / 2, y: NEEDLE_HEIGHT / 2 }

// Lucide Syringe 在 24 视口内的针尖端点为 (22,6)；放进 48×64 容器后
// （24×24 内容等比缩放为 48×48 并垂直居中）针尖相对容器中心为 (20,-12)。
// 针尾（活塞末端 (2,22)）相对容器中心为 (-20,20)。
export const CENTER_TO_TIP = { x: 20, y: -12 }
export const CENTER_TO_TAIL = { x: -20, y: 20 }

export const TIP_OFFSET_ANGLE = (Math.atan2(CENTER_TO_TIP.y, CENTER_TO_TIP.x) * 180) / Math.PI
export const REST_ROTATE = -90 - TIP_OFFSET_ANGLE
export const MIN_HEADING_DISTANCE = 2

export const rotateVector = (vector: Point, degrees: number): Point => {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos }
}

// 针的朝向角：让图标内“针尾 -> 针尖”的连线指向 from -> to 方向。
export const getHeading = (from: Point, to: Point) => {
  const direction = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
  return direction - TIP_OFFSET_ANGLE
}

// 给定针尖应处于的位置与朝向，反推 motion 元素的左上角锚点。
export const getHeldAnchor = (tip: Point, heading: number): Point => {
  const tipVector = rotateVector(CENTER_TO_TIP, heading)
  return {
    x: tip.x - tipVector.x - NEEDLE_HALF.x,
    y: tip.y - tipVector.y - NEEDLE_HALF.y,
  }
}

// 由元素锚点与朝向计算针尖、针尾的世界坐标（用于验证方向关系）。
export const getNeedleTipPosition = (anchor: Point, heading: number): Point => {
  const center = { x: anchor.x + NEEDLE_HALF.x, y: anchor.y + NEEDLE_HALF.y }
  const tipVector = rotateVector(CENTER_TO_TIP, heading)
  return { x: center.x + tipVector.x, y: center.y + tipVector.y }
}

export const getNeedleTailPosition = (anchor: Point, heading: number): Point => {
  const center = { x: anchor.x + NEEDLE_HALF.x, y: anchor.y + NEEDLE_HALF.y }
  const tailVector = rotateVector(CENTER_TO_TAIL, heading)
  return { x: center.x + tailVector.x, y: center.y + tailVector.y }
}
