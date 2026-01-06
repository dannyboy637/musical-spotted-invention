import toast from 'react-hot-toast'

// Styled toast helpers for consistent notifications across the app

export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 4000,
    position: 'bottom-right',
    style: {
      background: '#102a43',
      color: '#f0f4f8',
      borderRadius: '8px',
    },
    iconTheme: {
      primary: '#22c55e',
      secondary: '#f0f4f8',
    },
  })
}

export const showError = (message: string) => {
  toast.error(message, {
    duration: 6000,
    position: 'bottom-right',
    style: {
      background: '#102a43',
      color: '#f0f4f8',
      borderRadius: '8px',
    },
    iconTheme: {
      primary: '#ef4444',
      secondary: '#f0f4f8',
    },
  })
}

export const showNetworkError = (onRetry?: () => void) => {
  toast.error(
    `Connection lost. ${onRetry ? 'Click to retry.' : 'Check your internet connection.'}`,
    {
      duration: 8000,
      position: 'bottom-right',
      style: {
        background: '#102a43',
        color: '#f0f4f8',
        borderRadius: '8px',
        cursor: onRetry ? 'pointer' : 'default',
      },
    }
  )
}

export const showWarning = (message: string) => {
  toast(message, {
    duration: 5000,
    position: 'bottom-right',
    icon: '⚠️',
    style: {
      background: '#102a43',
      color: '#f0f4f8',
      borderRadius: '8px',
    },
  })
}

// Parse API error responses and show appropriate toast
export const handleApiError = (error: unknown, fallbackMessage = 'An error occurred') => {
  let message = fallbackMessage

  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>
    if (typeof err.message === 'string') {
      message = err.message
    } else if (typeof err.detail === 'string') {
      message = err.detail
    }
  }

  // Handle specific error cases
  if (message.includes('network') || message.includes('fetch')) {
    showNetworkError()
  } else {
    showError(message)
  }
}

export { toast }
