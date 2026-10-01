import { capitalize, channelTypeLabel } from '@lib/ru'
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Controller, useFormContext } from 'react-hook-form';
import { useCallback, useMemo } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { Text } from "@components/nativewindui/Text";
import { ErrorText, FormLabel } from "@components/layout/Form";
import { ChannelIcon } from "../ChannelList/ChannelIcon";
import { useColorScheme } from "@hooks/useColorScheme";

export type ChannelCreationForm = {
    channel_name: string,
    channel_description: string,
    type: 'Public' | 'Private' | 'Open'
}

const CreateChannelForm = () => {

    const { control, formState: { errors }, setValue, watch } = useFormContext<ChannelCreationForm>()

    const handleNameChange = useCallback((text: string) => {
        setValue('channel_name', text?.toLowerCase().replace(' ', '-'))
    }, [setValue])

    const channelType = watch('type')

    const { header, helperText } = useMemo(() => {
        switch (channelType) {
            case 'Private':
                return {
                    header: 'Закрытый канал',
                    helperText: 'Закрытый канал видят и вступают в него только по приглашению.'
                }
            case 'Open':
                return {
                    header: 'Открытый канал',
                    helperText: 'В открытом канале участники — все сотрудники.'
                }
            default:
                return {
                    header: 'Публичный канал',
                    helperText: 'В публичный канал может вступить и читать его любой сотрудник, а писать — только участники.'
                }
        }
    }, [channelType])

    const { colors } = useColorScheme()

    return (
        <KeyboardAwareScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentInsetAdjustmentBehavior="automatic">

            <View className="flex-col gap-3 justify-start px-5 pt-5 pb-6">
                <Text className="text-xl font-cal-sans">
                    {header}
                </Text>
                <Text className="text-sm">В каналах общается команда. Лучше всего заводить их по темам, например #регистратура.</Text>
            </View>

            <View className="px-5 gap-6">


                <View className="flex-col gap-2">
                    <FormLabel isRequired>Название</FormLabel>
                    <Controller
                        name="channel_name"
                        control={control}
                        rules={{
                            required: "Введите название канала",
                            maxLength: {
                                value: 50,
                                message: "Название канала — не длиннее 50 символов.",
                            },
                            minLength: {
                                value: 3,
                                message: "Название канала — не короче 3 символов.",
                            },
                            pattern: {
                                // no special characters allowed, cannot start with a space
                                value: /^[a-zA-Z0-9][a-zA-Z0-9-]*$/,
                                message: "В названии канала можно использовать только буквы, цифры и дефисы.",
                            },
                        }}
                        render={({ field: { onBlur, value }, fieldState: { error } }) => (
                            <View className={`flex-row items-center rounded-lg border ${error ? "border-red-600" : "border-border"}`}>
                                {/* Channel Icon */}
                                <View className="mx-3">
                                    <ChannelIcon type={channelType} fill={colors.icon} />
                                </View>
                                <TextInput
                                    className={`flex-1 pt-2 pb-2 text-[16px] text-foreground`}
                                    placeholder="dev-team"
                                    placeholderTextColor={colors.grey}
                                    maxLength={50}
                                    value={value}
                                    onBlur={onBlur}
                                    onChangeText={handleNameChange}
                                    autoFocus
                                    accessibilityHint={error ? "Название канала не подходит. Проверьте ошибку." : undefined}
                                    aria-invalid={error ? "true" : "false"}
                                />
                                {/* Character counter */}
                                <View className="mx-3">
                                    <Text className={`text-sm ${error ? "text-red-600" : "text-muted-foreground"}`}>
                                        {50 - (value?.length || 0)}
                                    </Text>
                                </View>
                            </View>
                        )}
                    />

                    {errors?.channel_name && (
                        <ErrorText>{errors.channel_name?.message}</ErrorText>
                    )}
                </View>

                <View className="flex-col gap-2">
                    <View className="flex-row items-center gap-0">
                        <FormLabel>Описание</FormLabel>
                        <Text className="text-sm">(необязательно)</Text>
                    </View>
                    <Controller
                        control={control}
                        name="channel_description"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                                className="w-full border min-h-24 border-border rounded-lg px-3 pt-2 pb-2 text-[16px] leading-5 text-foreground"
                                placeholder="Обсуждаем новости отдела и задачи"
                                placeholderTextColor={colors.grey}
                                placeholderClassName="leading-5"
                                textAlignVertical="top"
                                multiline
                                numberOfLines={6}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                value={value}
                            />
                        )}
                    />
                    <Text className="text-sm text-muted-foreground">О чём этот канал?</Text>
                    {errors?.channel_description && (
                        <ErrorText>{errors.channel_description?.message}</ErrorText>
                    )}
                </View>

                <View className="flex-col gap-3">
                    <FormLabel>Тип канала</FormLabel>
                    <Controller
                        control={control}
                        name="type"
                        render={({ field: { onChange, value } }) => (
                            <View className="flex-row flex-wrap gap-6">
                                {["Public", "Private", "Open"].map((option) => {
                                    const isSelected = value === option;
                                    return (
                                        <TouchableOpacity key={option} onPress={() => onChange(option)}>
                                            <View className="flex-row items-center gap-2">
                                                <View className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${isSelected ? "border-primary" : "border-border"}`}>
                                                    {isSelected && (
                                                        <View className="w-[8px] h-[8px] bg-primary rounded-full" />
                                                    )}
                                                </View>
                                                <Text className="text-sm">{capitalize(channelTypeLabel(option))}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )
                                })}
                            </View>
                        )}
                    />
                    <Text className="text-sm text-muted-foreground">{helperText}</Text>
                </View>

            </View>
        </KeyboardAwareScrollView>
    )
}

export default CreateChannelForm