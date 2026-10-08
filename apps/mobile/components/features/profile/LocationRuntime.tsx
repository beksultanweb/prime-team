import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import { locationTick } from '@lib/locationTracking'

// Mount only inside the accepted legal gate. OS background callbacks are separate.
export default function LocationRuntime() {
    useEffect(() => {
        if (Platform.OS === 'web') return
        locationTick()
        const interval = setInterval(() => { if (AppState.currentState === 'active') locationTick() }, 30_000)
        const subscription = AppState.addEventListener('change', state => { if (state === 'active') locationTick() })
        return () => { clearInterval(interval); subscription.remove() }
    }, [])
    return null
}
