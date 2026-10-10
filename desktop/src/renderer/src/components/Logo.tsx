import logo from '../logo.png'

export function Logo({ size = 112 }: { size?: number }) {
  return <img className="logo" src={logo} alt="Open Assistant" width={size} height={size} draggable={false} />
}
