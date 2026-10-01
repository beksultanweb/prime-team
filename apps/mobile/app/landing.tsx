import { Stack } from 'expo-router';
import { View } from 'react-native';
import AddSite from '@components/features/auth/AddSite';
import SitesList from '@components/features/auth/SitesList';
import { SafeAreaView } from 'react-native-safe-area-context';
import CommonErrorBoundary from '@components/common/CommonErrorBoundary';
import PrimeLogo from '@components/common/PrimeLogo';

export default function LandingScreen() {

    return (
        <>
            <Stack.Screen options={{ title: 'Сайты', headerShown: false }} />
            <SafeAreaView className='flex-1 bg-background'>
                <View className='flex-1 justify-center h-screen pt-24 px-6 gap-3 bg-background'>
                    <PrimeLogo size={56} />
                    <View className='h-2' />
                    <SitesList />
                    <AddSite />
                </View>
            </SafeAreaView>
        </>
    );
}

export const ErrorBoundary = CommonErrorBoundary