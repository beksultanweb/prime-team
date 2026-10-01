import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@components/nativewindui/Text';
import { useAsyncStorage } from '@react-native-async-storage/async-storage';
import { Button } from '@components/nativewindui/Button';

export default function NotFoundScreen() {

    const { getItem } = useAsyncStorage(`default-site`)

    const handleGoHome = () => {
        getItem().then(site => {
            if (site) {
                router.replace(`/${site}`)
            } else {
                router.replace('/landing')
            }
        })
    }
    return (
        <>
            <Stack.Screen options={{ title: 'Упс!' }} />
            <View className='flex-1 bg-background justify-center gap-3 items-center'>
                <Text className='text-3xl text-foreground'>Такой страницы нет.</Text>
                <View className='h-2' />
                <Button onPress={handleGoHome}>
                    <Text>На главную</Text>
                </Button>
            </View>
        </>
    );
}