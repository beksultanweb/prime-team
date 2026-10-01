import { useCallback } from 'react'
import { useGlobalSearchParams, useSegments } from 'expo-router'
import useSiteContext from './useSiteContext'

/**
 * expo-router 6 leaves the [site_id] segment out when it resolves relative
 * hrefs ("../chat/x" turns into "/chat/x"), so routes are built absolute.
 *
 * @returns a function that turns "chat/abc" into "/<site>/chat/abc"
 */
export const useSitePath = () => {
    const sitename = useSiteContext()?.sitename
    return useCallback((path: string) => `/${sitename}/${path}`, [sitename])
}

/**
 * Paths inside the channel or thread that is open now: "chat/<id>/<path>" or
 * "thread/<id>/<path>". Uses the global route state, so it also works in
 * bottom sheets, which render outside the screen.
 */
export const useChatPath = () => {
    const sitePath = useSitePath()
    const segments = useSegments() as string[]
    const { id } = useGlobalSearchParams<{ id: string }>()
    const kind = segments.includes('thread') ? 'thread' : 'chat'
    return useCallback(
        (path?: string) => sitePath(path ? `${kind}/${id}/${path}` : `${kind}/${id}`),
        [sitePath, kind, id]
    )
}
