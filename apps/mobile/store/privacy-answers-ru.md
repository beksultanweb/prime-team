# Prime Team: ответы о данных для App Store и Google Play

Сборка 6 и новее: вход по паролю и через eGov Mobile, согласия, фоновая геопозиция по
согласию сотрудника. Политика: https://primegc.kz/politic/prime-team.html (редакция от 14.10.2026).

Общее для обоих магазинов:
- Рекламы, отслеживания для рекламы и сторонней аналитики нет.
- Все данные передаются только по HTTPS на сервер Оператора (app.primegc.kz).
- Данные не продаются и не передаются третьим лицам (кроме SIGEX/eGov для проверки подписи и
  APNs/FCM для push, если включены).
- Удаление учётной записи и данных — через администратора платформы или info@primegc.kz.

## App Store Connect → App Privacy

«Do you or your third-party partners collect data from this app?» — **Yes**.
«Tracking» — **No** для всех типов.

| Тип данных (App Store) | Собирается | Связан с пользователем | Цель |
|---|---|---|---|
| Contact Info → Name | да | да | App Functionality |
| Contact Info → Email Address | да | да | App Functionality |
| Contact Info → Phone Number | да | да | App Functionality |
| User Content → Emails or Text Messages (сообщения чатов) | да | да | App Functionality |
| User Content → Photos or Videos | да | да | App Functionality |
| User Content → Other User Content (файлы, реакции, опросы) | да | да | App Functionality |
| Identifiers → User ID | да | да | App Functionality |
| Identifiers → Device ID (случайный ID установки) | да | да | App Functionality |
| **Location → Precise Location** | да | да | App Functionality |
| Other Data → Other Data Types (ИИН и сведения сертификата при входе через eGov) | да | да | App Functionality |

Не собирается: Health, Financial, Contacts (адресная книга), Browsing/Search History,
Purchases, Usage Data, Diagnostics, Sensitive Info.

### App Review Information → Notes

> Prime Team is the internal messaging app of Prime Green Clinic (Astana, Kazakhstan) for its
> employees. Accounts are created by the clinic administrator; there is no public sign-up.
>
> Demo account: use the "Логин и пароль" tab on the sign-in screen (the eGov Mobile tab requires a
> Kazakhstan digital ID and cannot be used for review).
>
> Background location: optional attendance feature. An employee turns it on in Profile →
> «Геопозиция», reads a separate notice and grants permission. Between 07:00 and 21:00
> Kazakhstan time the app sends its location about every 5 minutes so the clinic's server can
> record presence on the clinic premises. Only the latest location is kept, no route history.
> It can be turned off at any time; chat works without it.

## Google Play Console → Безопасность данных

«Собирает ли приложение данные…» — **Да**. «Все данные шифруются при передаче» — **Да**.
«Пользователь может запросить удаление данных» — **Да** (через администратора / info@primegc.kz).

| Категория → тип (Google Play) | Собирается | Передаётся третьим лицам | Обязательно? | Цель |
|---|---|---|---|---|
| Местоположение → Точное | да | нет | по выбору пользователя | Функции приложения |
| Личная информация → Имя | да | нет | обязательно | Функции приложения, Управление аккаунтом |
| Личная информация → Адрес эл. почты | да | нет | обязательно | Функции приложения, Управление аккаунтом |
| Личная информация → Номер телефона | да | нет | обязательно | Функции приложения, Управление аккаунтом |
| Личная информация → Идентификаторы пользователя | да | нет | обязательно | Функции приложения, Управление аккаунтом |
| Личная информация → Другая информация (ИИН, сведения сертификата) | да | нет | по выбору (только вход через eGov) | Управление аккаунтом, Защита от мошенничества и безопасность |
| Сообщения → Другие сообщения в приложении | да | нет | обязательно | Функции приложения |
| Фото и видео → Фото, Видео | да | нет | по выбору | Функции приложения |
| Файлы и документы | да | нет | по выбору | Функции приложения |
| Идентификаторы устройства или другие идентификаторы | да | нет | по выбору (только с геопозицией) | Функции приложения |

«Передача третьим лицам»: передача сервису SIGEX для проверки подписи по поручению Оператора
и сервисам push не считается передачей в смысле Google Play (поставщики услуг) — отвечать «нет».

### Разрешения на местоположение (декларация)

- Основное назначение: корпоративный мессенджер сотрудников клиники.
- Функция с фоновой геопозицией (до 500 знаков):

> Отметка прихода сотрудника на работу. Сотрудник сам включает функцию в профиле приложения после
> согласия с условиями. С 07:00 до 21:00 приложение раз в 5 минут отправляет местоположение на
> сервер клиники, а сервер отмечает присутствие на территории. Фоновый доступ нужен, потому что на
> работе приложение не открыто. Вне этого окна данные не собираются, хранится только последняя
> точка. Функцию можно выключить в любой момент.

- FOREGROUND_SERVICE_LOCATION: «Обновление данных о местоположении в фоновом режиме».
- Видео: Профиль → «Геопозиция» → условия → системное разрешение → «Разрешить всегда» → включено.
