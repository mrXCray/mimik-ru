# Установка

Поставщик: **AFI Distribution**, dm@afi-d.ru

## Chrome, Brave, Edge

1. Распакуйте `mimik-1.2.0-ru-extra-chrome.zip` в папку, где она будет жить постоянно.
2. Откройте `chrome://extensions` (`brave://extensions`, `edge://extensions`), включите **«Режим разработчика»**, нажмите **«Загрузить распакованное расширение»** и выберите папку с `manifest.json`.
3. Закрепите значок Mimik через меню расширений 🧩. Клик по значку открывает боковую панель.

ID `iifnohaefakanhlkanmfmkdankejanek` постоянный, поэтому папку можно переносить: просто загрузите её заново с нового места. Карточку расширения не удаляйте: удаление стирает все инструкции.

## Firefox 128+

- **Developer Edition, Nightly, ESR:** в `about:config` задайте `xpinstall.signatures.required` = `false`, затем `about:addons` → ⚙ → «Установить дополнение из файла» → `mimik-1.2.0-ru-extra-firefox.xpi`.
- **Обычный Firefox:** `about:debugging#/runtime/this-firefox` → «Загрузить временное дополнение» → тот же `.xpi`. Работает до перезапуска браузера.

При первой записи разрешите доступ к сайтам. Если запрос не появился: `about:addons` → Mimik → «Разрешения». ID: `mimik-ru@afi-d.ru`.

## Обновление

- **Chrome, Brave, Edge:** замените файлы в папке новыми и нажмите ⟳ на карточке Mimik.
- **Firefox:** установите новый `.xpi` поверх старого.

Инструкции и настройки при обновлении сохраняются.
