import { Text } from '@components/nativewindui/Text'
import { TouchableOpacity, View } from 'react-native'
import SearchIcon from '@assets/icons/SearchIcon.svg';
import { router } from 'expo-router';

const QuickSearchButton = () => {

    // Colors of primegc.kz: dark green field, gold icon, light text
    const searchIconColor = '#DBAC6C'

    return (
        <View>
            <TouchableOpacity onPress={() => router.push('../home/quick-search', { relativeToDirectory: true })}>
                <View className={'flex-row items-center gap-2 rounded-lg px-3 py-1.5 bg-[#03392D]/60 dark:bg-[#03392D]/70'}>
                    <SearchIcon width={16} height={16} fill={searchIconColor} />
                    <Text className='text-base text-[#F1F5FB]/70'>Перейти или найти…</Text>
                </View>
            </TouchableOpacity>
        </View>
    )
}

export default QuickSearchButton