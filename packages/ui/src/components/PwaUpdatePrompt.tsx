import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from 'sonner'

/**
 * Surfaces a "new version available" toast when a fresh deploy is waiting, and
 * reloads on the user's click. With registerType:'prompt', the new service
 * worker installs but does not take over until updateServiceWorker(true) —
 * so users get the update on the SAME load they're prompted, not the next one.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    toast('A new version of Spiflix is available', {
      description: 'Refresh to get the latest.',
      duration: Infinity,
      action: {
        label: 'Refresh',
        onClick: () => void updateServiceWorker(true),
      },
    })
  }, [needRefresh, updateServiceWorker])

  return null
}
