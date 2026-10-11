import type { CSSProperties } from 'react'
import bean from '../assets/agents/bean.png'
import blob from '../assets/agents/blob.png'
import clover from '../assets/agents/clover.png'
import crescent from '../assets/agents/crescent.png'
import diamond from '../assets/agents/diamond.png'
import dome from '../assets/agents/dome.png'
import egg from '../assets/agents/egg.png'
import peanut from '../assets/agents/peanut.png'
import pear from '../assets/agents/pear.png'
import pill from '../assets/agents/pill.png'
import plus from '../assets/agents/plus.png'
import square from '../assets/agents/square.png'

// One character per shape: transparent, square-padded renders.
const IMAGES = { blob, bean, square, pill, crescent, pear, plus, diamond, egg, peanut, dome, clover }

export type Shape = keyof typeof IMAGES

export const SHAPES = Object.keys(IMAGES) as Shape[]

// Each character's color as an accent: a lighter tint on the dark theme, a deeper one on the light theme.
const COLORS: Record<Shape, { dark: string; light: string }> = {
  bean: { dark: '#ff8a80', light: '#d93a2b' },
  blob: { dark: '#5c9dff', light: '#2f4fe0' },
  clover: { dark: '#7cb8ff', light: '#1f6fd6' },
  crescent: { dark: '#ffb066', light: '#c96a0a' },
  diamond: { dark: '#f5d442', light: '#9a7b00' },
  dome: { dark: '#ff9e85', light: '#d4553a' },
  egg: { dark: '#5fe0a0', light: '#12935a' },
  peanut: { dark: '#b88cff', light: '#7a3fe0' },
  pear: { dark: '#5ee0e6', light: '#0f8f99' },
  pill: { dark: '#c69bff', light: '#8a4fd6' },
  plus: { dark: '#ff7ab8', light: '#d6247a' },
  square: { dark: '#a6f05a', light: '#4f9a12' },
}

// Gives an element with class "bot-tint" this character's color as its --tint (see styles.css).
export const botStyle = (shape: Shape) =>
  ({ '--bot-dark': COLORS[shape].dark, '--bot-light': COLORS[shape].light }) as CSSProperties

export function AgentIcon({ shape, size = 28 }: { shape: Shape; size?: number }) {
  return (
    <img
      className="agent-icon"
      src={IMAGES[shape]}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  )
}
