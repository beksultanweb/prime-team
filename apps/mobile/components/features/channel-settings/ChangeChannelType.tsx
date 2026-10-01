import { channelTypeLabel, channelTypeInstrumental } from '@lib/ru'
import { Sheet, useSheetRef } from "@components/nativewindui/Sheet";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Pressable, View } from "react-native"
import { Button } from "@components/nativewindui/Button";
import { Text } from "@components/nativewindui/Text";
import { FrappeDoc, useFrappeUpdateDoc, useSWRConfig } from "frappe-react-sdk";
import { ChannelListItem } from "@raven/types/common/ChannelListItem";
import { toast } from "sonner-native";
import GlobeIcon from "@assets/icons/GlobeIcon.svg";
import LockIcon from "@assets/icons/LockIcon.svg";
import HashIcon from "@assets/icons/HashIcon.svg";
import { useColorScheme } from "@hooks/useColorScheme";

export const ChangeChannelType = ({ channelData }: { channelData: FrappeDoc<ChannelListItem> | undefined }) => {

    const bottomSheetModalRef = useSheetRef()
    const { colors } = useColorScheme()
    const changeChannelTypeButtons = channelData ? getChangeChannelType({
        channelData,
        bottomSheetModalRef,
        iconMap: {
            'Public': <GlobeIcon height={18} width={18} fill={colors.icon} />,
            'Private': <LockIcon height={18} width={18} fill={colors.icon} />,
            'Open': <HashIcon height={18} width={18} fill={colors.icon} />
        }
    }) : []

    return (
        <>
            {changeChannelTypeButtons.map((button) => (
                <Pressable key={button.id}
                    onPress={button.onPress}
                    className='flex flex-row items-center py-3 px-4 rounded-xl gap-2 bg-background dark:bg-card active:bg-card-background/50 dark:active:bg-card/80'>
                    {button.icon}
                    <Text className="text-base">{button.title}</Text>
                </Pressable>
            ))}

            <ChangeChannelTypeSheet channelData={channelData} bottomSheetModalRef={bottomSheetModalRef} />
        </>
    )
}


interface ChangeChannelTypeSheetProps {
    channelData: FrappeDoc<ChannelListItem> | undefined;
    bottomSheetModalRef: React.RefObject<BottomSheetModal | null>;
}

type ChannelType = 'Public' | 'Private' | 'Open';

const ChangeChannelTypeSheet = ({ channelData, bottomSheetModalRef }: ChangeChannelTypeSheetProps) => {

    const { mutate } = useSWRConfig()
    const { updateDoc, loading: updatingDoc, error } = useFrappeUpdateDoc();

    const getAlertSubMessage = (newChannelType: ChannelType) => {
        switch (newChannelType) {
            case 'Public':
                return `Любой сотрудник сможет вступить в канал и увидеть историю сообщений. Если потом сделать канал закрытым, история останется видна тем, кто успел в него вступить.`;
            case 'Private':
                return `История и участники канала не изменятся. Все файлы канала станут закрытыми и будут доступны только участникам.`;
            case 'Open':
                return `Все сотрудники станут участниками канала и увидят историю сообщений. Если потом сделать канал закрытым, лишних участников придётся удалить вручную.`;
            default:
                return '';
        }
    }

    const changeChannelType = (newChannelType: 'Public' | 'Private' | 'Open') => {
        updateDoc("Raven Channel", channelData?.name ?? null, {
            type: newChannelType
        }).then(() => {
            mutate(["channel_members", channelData?.name])
            toast.success("Теперь канал " + channelTypeLabel(newChannelType));
            handleClose();
        });
    };

    const handleClose = () => {
        bottomSheetModalRef.current?.dismiss();
    }

    return (
        <Sheet ref={bottomSheetModalRef}>
            {(props: { data: { newChannelType: ChannelType } } & any) => {
                return (
                    <BottomSheetView {...props}>
                        <View className="flex-col px-4 gap-3 mt-2 mb-20">
                            <Text className="text-xl font-cal-sans">
                                Сделать канал {channelTypeInstrumental(props.data?.newChannelType)}?
                            </Text>
                            <Text className="text-sm">Если сделать канал <Text className="text-sm font-semibold">{channelData?.channel_name}</Text> {`${channelTypeInstrumental(props.data?.newChannelType)}:`}
                            </Text>
                            <Text className="text-sm">
                                {getAlertSubMessage(props.data?.newChannelType)}
                            </Text>
                            <View className="flex-col gap-3 pt-1">
                                <Button onPress={() => changeChannelType(props.data?.newChannelType)}
                                    disabled={updatingDoc}>
                                    <Text>{updatingDoc ? 'Меняем…' : 'Изменить'}</Text>
                                </Button>
                                <Button onPress={handleClose} variant="plain" className="border border-border">
                                    <Text>Отмена</Text>
                                </Button>
                            </View>
                        </View>
                    </BottomSheetView>
                )
            }}
        </Sheet>
    )
}


/**
 * channel type can be - Private, Public, Open
 * Change Channel Type would take in current channel type and change it to the next type depending on the current type
 * Example: If current channel type is Public, Change Channel Type would change it to Private or Open, so it returns two list item buttons accordingly
 * For current type Private - it would return Public and Open
 * For current type Open - it would return Public and Private
 * For current type Public - it would return Private and Open
*/
const getChangeChannelType = ({ channelData, bottomSheetModalRef, iconMap }: { channelData: ChannelListItem, bottomSheetModalRef: React.RefObject<BottomSheetModal | null>, iconMap: Record<string, React.ReactNode> }) => {

    const channelType = channelData?.type as ChannelType

    const channelTypeMap = {
        'Public': ['Private', 'Open'],
        'Private': ['Public', 'Open'],
        'Open': ['Public', 'Private']
    }

    const channelTypeList = channelTypeMap[channelType] as ChannelType[]

    const channelSettingsData = channelTypeList.map((type) => {
        return {
            id: type,
            title: `Сделать ${channelTypeInstrumental(type)}`,
            onPress: () => {
                // The sheet reads the new type from the data passed to present()
                const sheet = bottomSheetModalRef.current as BottomSheetModal<{ newChannelType: ChannelType }> | null
                sheet?.present({
                    newChannelType: type,
                })
            },
            icon: iconMap[type]
        }
    })

    return channelSettingsData
}