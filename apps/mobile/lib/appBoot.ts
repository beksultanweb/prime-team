/**
 * Первый маршрут выбирает корневой _layout при запуске (сайт по умолчанию, вход или
 * чат из уведомления). Пока он этого не сделал, заглушка «/» сама никуда не уводит.
 */
let initialRouteResolved = false
export const markInitialRouteResolved = () => { initialRouteResolved = true }
export const isInitialRouteResolved = () => initialRouteResolved
