import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  UtensilsCrossed,
  Clock,
  TrendingUp,
  FolderOpen,
  GitBranch,
  Lightbulb,
  DollarSign,
  Database,
  Bell,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Gauge,
  ShieldOff,
  History,
} from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'

const navItems = [
  { to: '/operator', icon: Gauge, label: 'Control Hub', operatorOnly: true },
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/menu-engineering', icon: UtensilsCrossed, label: 'Menu Engineering' },
  { to: '/time-intelligence', icon: Clock, label: 'Time Intelligence' },
  { to: '/performance', icon: TrendingUp, label: 'Performance' },
  { to: '/categories', icon: FolderOpen, label: 'Categories' },
  { to: '/branches', icon: GitBranch, label: 'Branches' },
  { to: '/recommendations', icon: Lightbulb, label: 'Recommendations' },
  { to: '/movements', icon: History, label: 'Movements' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/exclusions', icon: ShieldOff, label: 'Exclusions', ownerOnly: true },
  { to: '/costs', icon: DollarSign, label: 'Costs', ownerOnly: true },
  { to: '/data-management', icon: Database, label: 'Data', ownerOnly: true },
  { to: '/reports', icon: FileText, label: 'Reports', ownerOnly: true },
]

interface SidebarProps {
  mobile?: boolean
}

export function Sidebar({ mobile = false }: SidebarProps) {
  const { sidebarOpen, toggleSidebar, closeMobileSidebar, openSettingsModal } = useUIStore()
  const { profile } = useAuthStore()

  const isOwnerOrOperator = profile?.role === 'owner' || profile?.role === 'operator'
  const isOperator = profile?.role === 'operator'

  // Filter nav items based on role
  const filterNavItems = (item: typeof navItems[0]) => {
    if (item.operatorOnly && !isOperator) return false
    if (item.ownerOnly && !isOwnerOrOperator) return false
    return true
  }

  // Mobile sidebar
  if (mobile) {
    return (
      <div className="flex h-full flex-col bg-navy-900">
        {/* Mobile header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-navy-700">
          <span className="text-lg font-semibold text-white">Menu</span>
          <button
            onClick={closeMobileSidebar}
            className="p-1 text-navy-300 hover:text-white rounded transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems
            .filter(filterNavItems)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={closeMobileSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-navy-700 text-gold-400'
                      : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                  }`
                }
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            ))}
        </nav>

        {/* Settings (owner/operator only) */}
        {isOwnerOrOperator && (
          <div className="border-t border-navy-700 px-2 py-4">
            <button
              onClick={() => {
                closeMobileSidebar()
                openSettingsModal()
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-navy-200 hover:bg-navy-800 hover:text-white w-full"
            >
              <Settings size={20} />
              <span>Settings</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  // Desktop sidebar
  return (
    <div
      className={`hidden lg:flex flex-col bg-navy-900 transition-all duration-200 ${
        sidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Logo area */}
      <div className="flex items-center h-16 px-4 border-b border-navy-700">
        {sidebarOpen ? (
          <span className="text-lg font-semibold text-white">Analytics</span>
        ) : (
          <span className="text-lg font-semibold text-white mx-auto">A</span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems
          .filter(filterNavItems)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={!sidebarOpen ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  sidebarOpen ? '' : 'justify-center'
                } ${
                  isActive
                    ? 'bg-navy-700 text-gold-400'
                    : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                }`
              }
            >
              <item.icon size={20} />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
      </nav>

      {/* Settings (owner/operator only) */}
      {isOwnerOrOperator && (
        <div className="border-t border-navy-700 px-2 py-4">
          <button
            onClick={openSettingsModal}
            title={!sidebarOpen ? 'Settings' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-navy-200 hover:bg-navy-800 hover:text-white w-full ${
              sidebarOpen ? '' : 'justify-center'
            }`}
          >
            <Settings size={20} />
            {sidebarOpen && <span>Settings</span>}
          </button>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="border-t border-navy-700 p-2">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full py-2 text-navy-300 hover:text-white rounded-md hover:bg-navy-800 transition-colors"
        >
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
    </div>
  )
}
