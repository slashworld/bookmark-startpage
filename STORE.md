# Chrome Web Store Listing

## Store Information (English)

### Extension Name
Bookmark Startpage

### Short Description (max 132 chars)
Replace new tab with a customizable bookmark-powered start page. Organize into tabs, customize cards, drag-and-drop, and search.

### Detailed Description (English)
Transform your Chrome new tab page into a fast, customizable bookmark dashboard with Bookmark Startpage.

**Key Features:**

- **Tab-Based Organization**
  - Create multiple tabs from your bookmark folders (via context menu or drag-and-drop)
  - Pin important tabs and color-code tabs for quick visual grouping
  - Reorder tabs by dragging

- **Two View Modes**
  - Explorer: Navigate your hierarchical bookmark folder tree with persistent open/closed folder state per tab
  - All Links: Grouped flat view of all bookmarks inside a tab

- **Customizable Cards & High-Res Icons**
  - Adjust icon size from 16x16 up to 256x256 with standard presets
  - Choose label position: Right, Bottom (speed-dial tile), Left, or Top
  - Show or hide bookmark titles and URLs independently
  - Multi-tier icon resolution: high-resolution favicons, direct site SVG/Apple Touch Icon extraction, local cache for intranet/self-hosted URLs, custom icon URLs, and letter avatar fallbacks

- **Drag-and-Drop & Multi-Select**
  - Drag bookmarks and folders directly into folders or tabs
  - Enable Move mode for multi-selection, Shift-click ranges, and level-by-level selection
  - Auto-expanding tree folders when moving items

- **Powerful Search**
  - Search across all tabs or filter only the current tab
  - Match by bookmark title, URL, or folder path

- **Light & Dark Themes**
  - Catppuccin Mocha (dark) and Catppuccin Latte (light)
  - 3-state switcher: Auto (system), Light, Dark

- **Easy Backup & Sync**
  - Auto-backup last 20 configurations to synced Chrome bookmarks with silent auto-restore on fresh install
  - Export and import configurations as JSON files or shareable URLs

- **Multi-Language**
  - English and Russian with automatic browser language detection

**Why does v1.1.0 request website access ("Read and change all your data on all websites")?**
Chrome displays this standard warning whenever an extension requests access to website URLs. Bookmark Startpage **never modifies web pages, never injects scripts, and never reads your browsing activity or personal data**. This permission is used solely so your browser can directly fetch the HTML of your bookmarked sites to find crisp vector (SVG) or high-resolution Apple Touch Icons when standard favicon caches only provide blurry 16x16 icons (or when you click "Refresh icon from site"). Everything runs locally in your browser.

**Permissions Explained:**
- Bookmarks: Read and manage your bookmarks and store optional config backups
- Storage: Save your settings, theme, tree state, and icon cache locally
- Favicon: Display locally cached website icons (including intranet/local URLs)
- Website access (`http://*/*`, `https://*/*`): Fetch bookmarked pages directly from your browser to extract high-resolution/SVG site icons

**Privacy first** - no personal data collection, no analytics, no ads.
**Open source** - full source code is available on GitHub.

---

## Информация для магазина (Русский)

### Название расширения
Bookmark Startpage

### Краткое описание (до 132 символов)
Настраиваемая стартовая страница из закладок Chrome: табы, темы, карточки, перетаскивание и быстрый поиск.

### Подробное описание (Русский)
Превратите страницу новой вкладки Chrome в удобную и настраиваемую стартовую панель на основе ваших закладок.

**Основные возможности:**

- **Организация по вкладкам (табам)**
  - Создавайте отдельные табы из любых папок закладок (через контекстное меню или перетаскиванием)
  - Закрепляйте важные табы и выделяйте их цветом
  - Меняйте порядок табов перетаскиванием

- **Два режима отображения**
  - Проводник: дерево папок с автоматическим сохранением открытых и закрытых узлов для каждого таба
  - Все ссылки: плоский список всех закладок таба, сгруппированный по папкам

- **Настройка карточек и чёткие иконки**
  - Настраиваемый размер иконок от 16x16 до 256x256 со стандартными пресетами
  - 4 варианта расположения подписи: справа, снизу (плитка), слева или сверху
  - Независимое отображение или скрытие названия и URL на карточках
  - Многоуровневая загрузка иконок: высокое разрешение, прямое извлечение векторных SVG и Apple Touch Icon с сайта, локальный кеш браузера для локальных/внутренних сервисов, пользовательский URL иконки и буквенные аватары

- **Перетаскивание (Drag-and-Drop) и мультивыбор**
  - Перетаскивайте закладки и папки напрямую в другие папки и табы
  - Режим перемещения (Move) с выбором диапазона через Shift, пошаговым выбором уровня и автораскрытием дерева

- **Быстрый поиск**
  - Поиск по всем табам или только в текущем табе
  - Поиск по названию, URL и пути папки

- **Светлая и тёмная темы**
  - Catppuccin Mocha (тёмная) и Catppuccin Latte (светлая)
  - Переключатель из 3 режимов: Авто (как в системе), Светлая, Тёмная

- **Резервное копирование и синхронизация**
  - Автосохранение последних 20 версий настроек в закладки Chrome с автоматическим восстановлением на новом устройстве
  - Экспорт и импорт конфигурации в JSON-файл или по ссылке

- **Языки интерфейса**
  - Русский и английский с автоопределением языка браузера

**Зачем в версии 1.1.0 нужно новое разрешение «Чтение и изменение данных на всех сайтах»?**
Chrome показывает это стандартное системное предупреждение для любого расширения, которому нужен доступ к загрузке страниц сайтов. Bookmark Startpage **не изменяет веб-страницы, не внедряет скрипты и не собирает историю посещений или личные данные**. Это разрешение используется исключительно для того, чтобы ваш браузер мог напрямую прочитать HTML-код страницы из ваших закладок и найти чёткую векторную (SVG) или качественную иконку (Apple Touch Icon), когда стандартные источники возвращают размытую иконку 16x16 (или при нажатии «Обновить иконку с сайта»). Вся обработка происходит локально в вашем браузере.

**Пояснение разрешений:**
- Закладки (`bookmarks`): отображение и управление закладками, а также хранение резервных копий настроек
- Хранилище (`storage`): локальное сохранение настроек, темы, состояния дерева папок и кеша иконок
- Иконки (`favicon`): отображение локально закешированных иконок сайтов (включая локальные и внутренние адреса)
- Доступ к сайтам (`http://*/*`, `https://*/*`): прямое получение качественных и SVG-иконок со страниц ваших закладок

**Приватность** — без сбора персональных данных, без аналитики и рекламы.
**Открытый исходный код** — весь код доступен на GitHub.

---

### Category
Productivity

### Language
English, Russian

### Screenshots Required
- Screenshot 1: Main view with tabs and bookmark grid (1280x800)
- Screenshot 2: Explorer view showing folder tree and card view popover (1280x800)
- Screenshot 3: Light theme (Catppuccin Latte) view (1280x800)
- Screenshot 4: Settings page (1280x800)
- Screenshot 5: Context menu / drag-and-drop move mode (1280x800)

### Icons Required
- Icon 128x128 (for store display)
- Icon 48x48 (for extension management page)

### Privacy Policy URL
https://github.com/slashworld/bookmark-startpage/blob/master/PRIVACY.md

### Support URL
https://github.com/slashworld/bookmark-startpage/issues

### Website
https://github.com/slashworld/bookmark-startpage
