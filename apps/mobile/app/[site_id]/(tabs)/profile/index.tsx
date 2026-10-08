import { Stack } from 'expo-router';
import { Platform, ScrollView, View } from 'react-native';
import { Text } from '@components/nativewindui/Text';
import LogOutButton from '@components/features/profile/profile-settings/LogOutButton';
import NotificationSetting from '@components/features/profile/profile-settings/NotificationSetting';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppearanceSetting from '@components/features/profile/profile-settings/AppearanceSetting';
import UserAvailability from '@components/features/profile/profile-settings/UserAvailability';
import UserFullName from '@components/features/profile/profile-settings/UserFullName';
import CustomStatus from '@components/features/profile/profile-settings/CustomStatus';
import ProfilePicture from '@components/features/profile/upload-profile/ProfilePicture';
import AboutApp from '@components/features/profile/AboutApp';
import Preferences from '@components/features/profile/profile-settings/Preferences';
import SwitchSitesSetting from '@components/features/profile/profile-settings/SwitchSitesSetting';
import CommonErrorBoundary from '@components/common/CommonErrorBoundary';
import LocationSetting from '@components/features/profile/profile-settings/LocationSetting';

const SCREEN_OPTIONS = {
    title: 'Профиль',
    headerTransparent: Platform.OS === 'ios',
    headerBlurEffect: 'systemMaterial',
} as const

export default function Profile() {

    const insets = useSafeAreaInsets()

    return (
        <>
            <Stack.Screen options={SCREEN_OPTIONS} />
            <View className='flex-1 px-4'>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: insets.bottom }}>
                    <View className='flex flex-col gap-4 mt-1.5'>
                        <ProfilePicture />
                        <View className='flex flex-col gap-0.5'>
                            <Text className='pl-2 pb-1 text-xs text-muted-foreground/80'>Личные данные</Text>
                            <UserFullName />
                            <CustomStatus />
                            <UserAvailability />
                        </View>
                        <View className='flex flex-col gap-0.5'>
                            <Text className='pl-2 pb-1 text-xs text-muted-foreground/80'>Настройки</Text>
                            <NotificationSetting />
                            <AppearanceSetting />
                            <Preferences />
                            <LocationSetting />
                            <SwitchSitesSetting />
                        </View>
                        <LogOutButton />
                        <AboutApp />
                    </View>
                </ScrollView>
            </View>
        </>
    )
}

export const ErrorBoundary = CommonErrorBoundary
