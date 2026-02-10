import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Spinner } from '../ui/Spinner'

describe('Spinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<Spinner />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('applies default medium size', () => {
    const { container } = render(<Spinner />)
    const svg = container.querySelector('svg')
    const cls = svg?.getAttribute('class') ?? ''
    expect(cls).toContain('h-6')
    expect(cls).toContain('w-6')
  })

  it('applies small size', () => {
    const { container } = render(<Spinner size="sm" />)
    const svg = container.querySelector('svg')
    const cls = svg?.getAttribute('class') ?? ''
    expect(cls).toContain('h-4')
    expect(cls).toContain('w-4')
  })

  it('applies large size', () => {
    const { container } = render(<Spinner size="lg" />)
    const svg = container.querySelector('svg')
    const cls = svg?.getAttribute('class') ?? ''
    expect(cls).toContain('h-8')
    expect(cls).toContain('w-8')
  })

  it('applies custom className', () => {
    const { container } = render(<Spinner className="text-red-500" />)
    const svg = container.querySelector('svg')
    const cls = svg?.getAttribute('class') ?? ''
    expect(cls).toContain('text-red-500')
  })

  it('has animate-spin class for animation', () => {
    const { container } = render(<Spinner />)
    const svg = container.querySelector('svg')
    const cls = svg?.getAttribute('class') ?? ''
    expect(cls).toContain('animate-spin')
  })

  it('contains circle and path elements', () => {
    const { container } = render(<Spinner />)
    const circle = container.querySelector('circle')
    const path = container.querySelector('path')
    expect(circle).not.toBeNull()
    expect(path).not.toBeNull()
  })
})
