import { Stack } from 'expo-router';
import FullPageLoader from '@components/layout/FullPageLoader';

export default function InitialScreen() {

    return (
        <>
            <Stack.Screen options={{ title: 'Prime Team' }} />
            <FullPageLoader />
        </>
    );
}