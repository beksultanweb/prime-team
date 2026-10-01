import RenderHtml, { defaultFallbackFonts, defaultSystemFonts, TRenderEngineConfig } from 'react-native-render-html';
import { useWindowDimensions, View } from 'react-native';
import { useMemo } from 'react';
import { useColorScheme } from '@hooks/useColorScheme';
import { CustomMentionRenderer } from './MentionRenderer';
type Props = {
    text: string
}

/**
 * React 19 ignores defaultProps on function components, and
 * react-native-render-html sets its engine defaults that way. Without them
 * user agent styles (bold, italic, headings) and HTML entity decoding are off,
 * so the library's defaults are passed explicitly.
 */
const ENGINE_DEFAULTS = {
    htmlParserOptions: { decodeEntities: true },
    emSize: 14,
    ignoredDomTags: [],
    ignoredStyles: [],
    enableUserAgentStyles: true,
    enableCSSInlineProcessing: true,
    customHTMLElementModels: {},
    fallbackFonts: defaultFallbackFonts,
    systemFonts: defaultSystemFonts,
} satisfies Partial<TRenderEngineConfig>

const TAG_BASE_STYLES: TRenderEngineConfig['tagsStyles'] = {
    'blockquote': {
        borderLeftWidth: 2,
        paddingLeft: 10,
        paddingTop: 4,
        paddingBottom: 2,
        fontStyle: 'italic',
        marginLeft: 4,
        lineHeight: 24,
        fontSize: 16,
    },
    'code': {
        padding: 4,
        borderRadius: 4,
        lineHeight: 24,
        fontSize: 16,
    },
    'p': {
        marginBottom: 0,
        fontSize: 16,
        marginTop: 0,
        whiteSpace: 'pre',
        paddingBottom: 4,
        lineHeight: 24,
    },
    'ol': {
        marginTop: 2,
        marginBottom: 2,
        lineHeight: 24,
        fontSize: 16,
    },
    'ul': {
        marginTop: 2,
        marginBottom: 2,
        lineHeight: 24,
        fontSize: 16,
    },
    'img': {
        width: '200px',
        height: 'auto',
        display: 'flex',
        justifyContent: 'flex-start',
        margin: 0,
        padding: 0,
    },
    'a': {
        textDecorationLine: 'none',
        borderBottomWidth: 1,
        lineHeight: 24,
        fontSize: 16,
    },
    'pre': {
        padding: 8,
        marginTop: 2,
        marginBottom: 2,
        borderRadius: 4,
        lineHeight: 24,
        fontSize: 16,
    }
}

const lightThemeTagStyles = {
    'a': {
        color: 'rgb(17, 95, 77)',
        borderBottomWidth: 0,
    },
    'blockquote': {
        borderLeftColor: 'rgba(17, 95, 77, 0.5)',
    },
    'pre': {
        backgroundColor: 'rgb(248, 248, 248)',
    },
    'code': {
        backgroundColor: 'rgb(248, 248, 248)',
        color: '#C10030DB',
    },
    'mark': {
        backgroundColor: '#FFE629',
    }
}

const darkThemeTagStyles = {
    'a': {
        color: '#A5F5E2',
        borderBottomWidth: 0,
    },
    'blockquote': {
        borderLeftColor: '#2E8C74',
    },
    'pre': {
        backgroundColor: '#202020',
    },
    'code': {
        backgroundColor: '#202020',
        color: '#FF949D',
    },
    'mark': {
        backgroundColor: '#FFFF57',
    }
}

const lightThemeStyles: TRenderEngineConfig['tagsStyles'] = Object.keys(TAG_BASE_STYLES)?.reduce((acc, key) => {
    // @ts-ignore
    acc[key] = { ...TAG_BASE_STYLES[key], ...(lightThemeTagStyles?.[key] || {}) }
    return acc
}, {} as TRenderEngineConfig['tagsStyles'])

const darkThemeStyles: TRenderEngineConfig['tagsStyles'] = Object.keys(TAG_BASE_STYLES)?.reduce((acc, key) => {
    // @ts-ignore
    acc[key] = { ...TAG_BASE_STYLES[key], ...(darkThemeTagStyles?.[key] || {}) }
    return acc
}, {} as TRenderEngineConfig['tagsStyles'])

const renderers = {
    span: CustomMentionRenderer
}

const classesStylesLight = {
    'mention': {
        color: '#115F4D',
        backgroundColor: '#E3F1EC',
    }
}

const classesStylesDark = {
    'mention': {
        color: '#A5F5E2',
        backgroundColor: '#0E3B31',
    }
}

const MessageTextRenderer = ({ text }: Props) => {

    const { width } = useWindowDimensions()

    const { colorScheme } = useColorScheme()

    const { tagStyles, baseStyles, classesStyles } = useMemo(() => {
        if (colorScheme === 'light') {
            return {
                tagStyles: lightThemeStyles,
                baseStyles: {
                    fontSize: 16,
                    color: 'rgb(0, 0, 0)'
                },
                classesStyles: classesStylesLight
            }
        } else {
            return {
                tagStyles: darkThemeStyles,
                baseStyles: {
                    fontSize: 16,
                    color: 'rgb(255, 255, 255)'
                },
                classesStyles: classesStylesDark
            }
        }
    }, [colorScheme])

    const source = useMemo(() => ({ html: text }), [text])
    const paddingWidth = width - 160

    return (
        <View className='flex-1 pt-0.5'>
            <RenderHtml
                {...ENGINE_DEFAULTS}
                baseStyle={baseStyles}
                contentWidth={paddingWidth}
                source={source}
                classesStyles={classesStyles}
                tagsStyles={tagStyles}
                renderers={renderers}
            />
        </View>
    );
}

export default MessageTextRenderer