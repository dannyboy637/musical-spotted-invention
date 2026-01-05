import { useState, useRef, useEffect } from 'react'
import { Menu, User, LogOut, ChevronDown, Settings, Calendar } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { useUIStore } from '../../stores/uiStore'
import { TenantSwitcher } from './TenantSwitcher'
import { SettingsModal } from './SettingsModal'

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' · ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function Header() {
  const { profile, logout } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const { toggleMobileSidebar, settingsModalOpen, openSettingsModal, closeSettingsModal } = useUIStore()

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const menuRef = useRef<HTMLDivElement>(null)

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  const isOperator = profile?.role === 'operator'

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await logout()
  }

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'operator':
        return 'bg-gold-100 text-gold-700'
      case 'owner':
        return 'bg-emerald-100 text-emerald-700'
      case 'viewer':
        return 'bg-slate-100 text-slate-700'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 lg:px-6">
      {/* Left side: hamburger + tenant */}
      <div className="flex items-center gap-4">
        {/* Mobile hamburger */}
        <button
          onClick={toggleMobileSidebar}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
        >
          <Menu size={24} />
        </button>

        {/* Tenant name or switcher */}
        {isOperator ? (
          <TenantSwitcher />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {profile?.tenant?.name || activeTenant?.name || 'No Tenant'}
            </span>
          </div>
        )}
      </div>

      {/* Right side: date/time + settings + user menu */}
      <div className="flex items-center gap-3">
        {/* Current date/time */}
        <div className="hidden md:flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <Calendar size={14} />
          <span>{formatDateTime(currentTime)}</span>
        </div>

        {/* Settings button */}
        <button
          onClick={openSettingsModal}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          title="Settings"
        >
          <Settings size={20} />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
        >
          <div className="w-8 h-8 bg-navy-100 text-navy-700 rounded-full flex items-center justify-center">
            <User size={18} />
          </div>
          <span className="hidden sm:inline max-w-[150px] truncate">
            {profile?.full_name || profile?.email || 'User'}
          </span>
          <ChevronDown size={16} className={`transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {userMenuOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg border border-slate-200 shadow-lg py-2 z-50">
            {/* User info */}
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-800 truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
              <span
                className={`inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded ${getRoleBadgeColor(
                  profile?.role
                )}`}
              >
                {profile?.role}
              </span>
            </div>

            {/* Menu items */}
            <div className="py-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsModalOpen} onClose={closeSettingsModal} />
    </header>
  )
}
