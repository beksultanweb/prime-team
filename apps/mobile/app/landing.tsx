import { Stack } from 'expo-router';
import PortalLogin from '@components/features/auth/PortalLogin';
import { SafeAreaView } from 'react-native-safe-area-context';
import CommonErrorBoundary from '@components/common/CommonErrorBoundary';

export default function LandingScreen() {

    return (
        <>
            <Stack.Screen options={{ title: 'Сайты', headerShown: false }} />
            <SafeAreaView className='flex-1 bg-background'>
                <PortalLogin siteURL={process.env.EXPO_PUBLIC_PRIME_SITE_URL || 'https://app.primegc.kz'} />
            </SafeAreaView>
        </>
    );
}

export const ErrorBoundary = CommonErrorBoundary
