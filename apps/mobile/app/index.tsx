import { useEffect } from 'react';
import { router, Stack } from 'expo-router';
import FullPageLoader from '@components/layout/FullPageLoader';
import { getDefaultSite } from '@lib/auth';
import { isInitialRouteResolved } from '@lib/appBoot';

export default function InitialScreen() {

    // Сюда попадают и после запуска: eGov Mobile и другие приложения возвращают в Prime Team
    // ссылкой kz.primegc.team://…, и роутер открывает «/». Корневой _layout выбирает маршрут
    // только один раз, поэтому без этого экран загрузки висел бесконечно, а вход через eGov
    // не завершался. Экран входа сам продолжит сохранённую попытку входа через eGov.
    useEffect(() => {
        if (!isInitialRouteResolved()) return
        getDefaultSite()
            .then(site => router.replace(site ? `/${site}` : '/landing'))
            .catch(() => router.replace('/landing'))
    }, [])

    return (
        <>
            <Stack.Screen options={{ title: 'Prime Team' }} />
            <FullPageLoader />
        </>
    );
}
