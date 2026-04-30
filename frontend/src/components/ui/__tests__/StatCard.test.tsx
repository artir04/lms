import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Users } from 'lucide-react'
import { StatCard } from '../StatCard'

describe('<StatCard />', () => {
  it('renders the title and value', () => {
    render(<StatCard title="Total Students" value={1234} icon={<Users />} />)
    expect(screen.getByText('Total Students')).toBeInTheDocument()
    expect(screen.getByText('1234')).toBeInTheDocument()
  })

  it('renders string values as-is', () => {
    render(<StatCard title="Avg Grade" value="4.25" icon={<Users />} />)
    expect(screen.getByText('4.25')).toBeInTheDocument()
  })

  it('omits the trend section when no trend is provided', () => {
    render(<StatCard title="Active" value={5} icon={<Users />} />)
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('renders the trend label when provided', () => {
    render(
      <StatCard
        title="Engagement"
        value="78%"
        icon={<Users />}
        trend="+5% from last week"
        trendUp
      />,
    )
    expect(screen.getByText('+5% from last week')).toBeInTheDocument()
  })
})
