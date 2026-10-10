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
