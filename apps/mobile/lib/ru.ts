/**
 * Russian UI helpers. The app's strings are written in Russian in place;
 * this file holds what needs logic: plural forms and labels for values
 * that the server stores in English.
 */

/** Picks the form for n: [1 ответ, 2 ответа, 5 ответов] */
export const pluralRu = (n: number, forms: [string, string, string]) => {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod10 === 1 && mod100 !== 11) return forms[0]
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
    return forms[2]
}

/** "5 ответов" */
export const repliesRu = (n: number) => `${n} ${pluralRu(n, ['ответ', 'ответа', 'ответов'])}`

/** Channel type as stored in Raven Channel.type → adjective for "канал" */
export const CHANNEL_TYPE_LABELS: Record<string, string> = {
    Public: 'публичный',
    Private: 'закрытый',
    Open: 'открытый',
}

export const channelTypeLabel = (type?: string) => (type && CHANNEL_TYPE_LABELS[type]) || type || ''

/** Instrumental case: "сделать канал публичным" */
const CHANNEL_TYPE_INSTRUMENTAL: Record<string, string> = {
    Public: 'публичным',
    Private: 'закрытым',
    Open: 'открытым',
}

export const channelTypeInstrumental = (type?: string) => (type && CHANNEL_TYPE_INSTRUMENTAL[type]) || type || ''

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * The server writes system messages in English (raven_channel_member.py).
 * Known templates are shown in Russian; anything else is left as is.
 */
const SYSTEM_MESSAGE_TEMPLATES: [RegExp, (...names: string[]) => string][] = [
    [/^(.+) was removed by (.+) and (.+) is the new admin of this channel\.$/, (a, b, c) => `Пользователь ${b} удалил из канала: ${a}. Новый администратор канала: ${c}.`],
    [/^(.+) is no longer an admin\.$/, (a) => `Пользователь ${a} больше не администратор канала.`],
    [/^(.+) is now an admin\.$/, (a) => `Пользователь ${a} теперь администратор канала.`],
    [/^(.+) joined\.$/, (a) => `Пользователь ${a} присоединился к каналу.`],
    [/^(.+) left\.$/, (a) => `Пользователь ${a} покинул канал.`],
    [/^(.+) added (.+)\.$/, (b, a) => `Пользователь ${b} добавил в канал: ${a}.`],
    [/^(.+) removed (.+)\.$/, (b, a) => `Пользователь ${b} удалил из канала: ${a}.`],
]

export const systemMessageRu = (text?: string) => {
    if (!text) return ''
    for (const [pattern, format] of SYSTEM_MESSAGE_TEMPLATES) {
        const match = text.match(pattern)
        if (match) return format(...match.slice(1))
    }
    return text
}
