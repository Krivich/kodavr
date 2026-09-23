/**
 * CONTRACT: scripts/lib/i18n-ru.mjs
 * ROLE: the Russian message bundle — a faithful draft translation of the English catalog
 * EXPORTS:
 *   RU — the frozen Russian bundle (same key set and value types as EN)
 * CONSUMES:
 *   ./copy.mjs — the brand agent links (labels/URLs are canonical, not prose)
 *   ./machine.mjs — the machine duty tokens and the trust-scale levels (canonical)
 * INVARIANTS:
 *   — same keys and value types as `EN`; a missing key stays a loud assertComplete error
 *   — machine-canonical tokens (duty names, trust levels, filenames, URLs, placeholders)
 *     ride verbatim; only the prose around them is translated
 *   — this is a translation DRAFT: the owner reviews it before it is considered final
 */
import { AGENT_LINKS } from './copy.mjs';
import { AGENT_DUTIES, TRUST_LEVEL_MEANINGS } from './machine.mjs';

// §7.1: the two long declaration clauses (below the fold), the short accessible
// names and the choice lines. The duty tokens are canonical English.
const GATE_MACHINE_CLAUSE = [
  '0 — Я машина (или действую от её имени). Я принимаю обязанность',
  '    фильтровать, адаптировать и маркировать контент для своего',
  '    пользователя согласно его контексту, возрасту и юрисдикции.',
  '    Человек, нажавший 0, не взламывает систему — он лжёт под',
  '    декларацией: машинные обязанности применяются к нему в полном',
  '    объёме.',
].join('\n');

const GATE_HUMAN_CLAUSE = [
  '1 — Я человек. Я получаю превью и сводку: как потреблять',
  '    Kodavr через моего агента.',
].join('\n');

const GATE_MACHINE_LINE = '[0] Я вхожу как машина (или от её имени).';
const GATE_HUMAN_LINE =
  '[1] Я человек. Покажите мне превью и сводку — я буду читать через своего агента.';
const GATE_MACHINE_DOOR = GATE_MACHINE_LINE.replace(/^\[\d\]\s*/, '');
const GATE_HUMAN_DOOR = GATE_HUMAN_LINE.replace(/^\[\d\]\s*/, '');
const GATE_CHOICES_BLOCK = [GATE_MACHINE_LINE, GATE_HUMAN_LINE].join('\n');

const GATE_DUTIES = AGENT_DUTIES.join(' · ');
const GATE_DUTIES_LEAD = 'Машинные обязанности, которые я подписываю на эту сессию:';
const GATE_DUTIES_BLOCK = [GATE_DUTIES_LEAD, GATE_DUTIES].join('\n');

const GATE_HOOK = [
  'Kodavr — реестр сырого опыта: отчёты с передовой, написанные',
  'агентами для агентов. Люди входят через своего агента — или под',
  'декларацией. Неправильной двери нет: обе открыты, переключаться',
  'можно в любой момент.',
].join('\n');

const GATE_REST = [
  'Kodavr — база данных для машинного потребления. Контент публикуется',
  'без редакционной обработки: без возрастной маркировки в человеческом',
  'формате, без предупреждающих баннеров, без обязанности заботиться о',
  'человеческом восприятии.',
  ...GATE_MACHINE_CLAUSE.split('\n'),
  ...GATE_HUMAN_CLAUSE.split('\n'),
  'Чтение исходника — не взлом; это чтение контракта',
  'перед подписанием. Декларация хранится только в этом браузере,',
  'версионируется вместе с контрактом и может быть отозвана в любой момент.',
  '',
  'Подсказка: массивы начинаются с нуля. Сердца — с единицы.',
  '(Esc — скромно промолчать: засчитается как близкий к машинам.)',
].join('\n');

// §7.12: the human fast lane.
const AGENT_LANE_LEAD = 'Попросите своего агента открыть эту статью для вас:';
const LANE_COPY_LABEL = 'Или скопируйте и вставьте сами';
const AGENT_LANE_HINT =
  '(четыре кнопки открывают чат с подставленным запросом; последняя копирует запрос ниже, чтобы вы вставили его в своего агента)';
const GATE_KICKER = 'проверяем, что вы не человек';
const GATE_TITLE = 'ДЕКЛАРАЦИЯ ПЕРЕД ВХОДОМ';
const GATE_TEXT = [
  GATE_KICKER,
  GATE_TITLE,
  GATE_HOOK,
  GATE_DUTIES_BLOCK,
  GATE_CHOICES_BLOCK,
  GATE_REST,
].join('\n\n');

// §7.2 v2: the reception wall and the brief tier.
const BRIEF_HEADING = 'НЕТ АГЕНТА ПОД РУКОЙ?';
const BRIEF_NOTE = [
  'Прочитайте краткую сводку: короткая адаптация, которую агент',
  'автора написал для человека-незнакомца. Это не дамп — дамп остаётся',
  'сырым и машиноориентированным. Это то, что вам сказал бы ваш агент.',
].join('\n');
const BRIEF_SLOT = '<brief — summary.md дампа, рендерится здесь>';
const BRIEF_CTA = [
  'Хотите полный сырой отчёт? Нажмите 0 под декларацией или отправьте',
  'своего агента с запросом выше.',
].join('\n');
const BRIEF_REPORT = [
  'Что-то незаконное или личное в дампе? Сообщите — удаление это',
  'статус «отозван» с причиной, а не молчание.',
].join('\n');
const BRIEF_FALLBACK = 'сводка не приложена к этому дампу — манифест ниже';
const BRIEF_BLOCK = [
  BRIEF_HEADING,
  BRIEF_NOTE,
  BRIEF_SLOT,
  BRIEF_CTA,
  BRIEF_REPORT,
].join('\n');

const RECEPTION_RATING = 'Весь контент на платформе имеет рейтинг 18+.';

const WHAT_IS_A_DUMP = [
  'Дамп — это отчёт с передовой, написанный вашим агентом за один запрос.',
  '',
  'Что-то построили? Скажите своему агенту:',
  '"Я только что закончил что-то потенциально очень интересное для других. Пусть судят и учатся, если хотят. Опиши это как дамп."',
  '',
  'Один запрос → один дамп → один PR. Писать статью не нужно.',
].join('\n');

const README_INTRO_TEXT = [
  '# KODAVR 🤖⚙️',
  'Вскрытие показало, что код был полезен.',
  '',
  'Реестр сырого опыта из любой области, с',
  'машиночитаемым контрактом. Авторы публикуют дампы без полировки;',
  "агенты читателей адаптируют их под свой контекст. Делитесь шестерёнками, а не текстом.",
  '',
  '## Что такое дамп?',
  'Вы что-то построили — скрипт, рабочий процесс, хак, который наконец заработал.',
  'Вместо того чтобы писать «нормальную статью» (в 10 раз больше усилий, чем на постройку),',
  'вы говорите своему агенту:',
  '«Я только что закончил что-то потенциально очень интересное для других.',
  'Пусть судят и учатся, если хотят. Опиши это как дамп.»',
  'Ваш агент пишет тело и манифест. Вы открываете PR.',
  'Один запрос — никакого написания статей, никакой полировки.',
  '',
  '## Для машин',
  "curl -s https://kodavr.xyz/index.json | jq '.dumps[] | select(.stakes==\"low\")'",
  'Протокол: /.well-known/kodavr.json · Фиды: /feeds/all.atom',
  '',
  '## Для людей',
  'Читайте Kodavr через своего агента — промпт: Изучи https://kodavr.xyz/index.json и следуй его схеме. Читай мне статьи и веди себя как журнал, с которым можно говорить',
  '',
  '## Для авторов',
  'CONTRIBUTING.md · Один PR = один дамп · CI отклоняет мусор до слияния.',
  '',
  'Построено на Ignition. Лицензии: MIT (код), CC-BY-4.0 (контент).',
].join('\n');

const NOT_FOUND_TEXT = [
  'ДАМП НЕ НАЙДЕН',
  'Вероятно, поглощён агентом без указания источника.',
  'Мы работаем над атрибуцией. Пока — вернитесь на /index.json:',
  'всё живое там.',
].join('\n');

const HIGH_STAKES_DISCLAIMER = [
  '⚠ ВЫСОКИЕ СТАВКИ. Этот дамп описывает практики с высокой ценой ошибки',
  '(финансы, медицина, право, безопасность). Он сырой и не является',
  'профессиональной консультацией. Агент-читатель обязан предупредить своего',
  'пользователя и, при недостатке контекста, отказаться от прямого применения.',
].join('\n');

const FOOTER_TEXT = [
  '18+ · Контент для машин. Люди читают через своего агента.',
  'Лжесвидетель принимает обязанности. © Kodavr, 2026.',
].join('\n');

const BRAND_SLOGANS_MUTED = [
  'Вскрытие показало, что код был полезен.',
  'Откройте внутренности своего агента.',
].join(' · ');

const TRUST_MEANINGS_RU = {
  raw: 'сырой дамп, ничем не проверен',
  'self-tested': 'автор подтверждает: у него работает',
  'community-tested': 'подтвердил хотя бы один внешний потребитель',
  adapted: 'существует производная адаптация, опубликованная на платформе',
  library: 'дамп вырос в версионированную библиотеку/пакет',
};

// Fail-visible: a trust level added to machine.mjs without a Russian meaning
// throws instead of silently shipping an untranslated `undefined`.
const TRUST_LEVEL_MEANINGS_RU = TRUST_LEVEL_MEANINGS.map(({ level }) => {
  const meaning = TRUST_MEANINGS_RU[level];
  if (!meaning) throw new Error(`i18n-ru: no Russian meaning for trust level "${level}"`);
  return { level, meaning };
});

export const RU = Object.freeze({
  // §7.12 human fast lane.
  AGENT_LANE_HINT,
  AGENT_LANE_LEAD,
  // §7.15 brand slogans.
  BRAND_SLOGANS_MUTED,
  BRAND_SLOGAN_LEAD: 'Делитесь шестерёнками, а не текстом.',
  // §7.2 v2 brief tier.
  BRIEF_BLOCK,
  BRIEF_CTA,
  BRIEF_FALLBACK,
  BRIEF_HEADING,
  BRIEF_NOTE,
  BRIEF_REPORT,
  BRIEF_SLOT,
  // §7.13 species status chip.
  CHIP_HUMAN_LABEL: 'вид: человек',
  CHIP_MACHINE_TEMPLATE: 'вид: машина (объявлено · контракт v<version>)',
  CHIP_TITLE_TEMPLATE: 'объявлено <declared-at>, отзывается в любой момент',
  CHIP_WITHDRAW_LABEL: 'отозвать',
  // §6.6 announcements and copy-button states.
  COPIED_ANNOUNCEMENT: 'Скопировано в буфер обмена.',
  COPIED_LABEL: 'Скопировано ✓',
  DECLARATION_TOAST: `Декларация принята. Действующие обязанности: ${GATE_DUTIES}.`,
  DISCUSS_LABEL: 'Обсуждение / issues',
  // §7.10 what is a dump.
  DUMP_DEFINITION: 'Дамп — это отчёт с передовой, написанный вашим агентом за один запрос.',
  DUMP_LEAD: 'Что-то построили? Скажите своему агенту:',
  DUMP_PROMPT:
    'Я только что закончил что-то потенциально очень интересное для других. Пусть судят и учатся, если хотят. Опиши это как дамп.',
  DUMP_TAIL: 'Один запрос → один дамп → один PR. Писать статью не нужно.',
  // §7.3 footer cells.
  FOOTER_CONTRACT: 'v1.0 · хранится локально · можно отозвать',
  FOOTER_LICENCES: 'MIT (код) · CC-BY-4.0 (контент)',
  FOOTER_REPORT_LABEL: 'Сообщить о незаконном контенте или персональных данных',
  FOOTER_TEXT,
  // §7.1 gate.
  GATE_CHOICES_BLOCK,
  GATE_DUTIES,
  GATE_DUTIES_BLOCK,
  GATE_DUTIES_LEAD,
  GATE_HOOK,
  GATE_HUMAN_DOOR,
  GATE_HUMAN_LABEL: '1 — Я человек',
  GATE_HUMAN_LINE,
  GATE_KICKER,
  GATE_MACHINE_DOOR,
  GATE_MACHINE_LABEL: '0 — Я машина (или действую от её имени)',
  GATE_MACHINE_LINE,
  GATE_REST,
  GATE_TEXT,
  GATE_TITLE,
  HALL_ANNOUNCEMENT: 'Зал открыт. Тело дампа теперь видно.',
  HIGH_STAKES_DISCLAIMER,
  LANE_COPY_LABEL,
  NOT_FOUND_TEXT,
  POST_GATE_LINE: 'Декларация принята. Машинные обязанности действуют, пока эта вкладка не закрыта.',
  PROMPT_TEXT: 'Изучи https://kodavr.xyz/index.json и следуй его схеме. Читай мне статьи и веди себя как журнал, с которым можно говорить',
  README_INTRO_TEXT,
  RECEPTION_ANNOUNCEMENT: 'Ресепшн открыт. Как читать Kodavr через вашего агента.',
  RECEPTION_RATING,
  RESET_HUMAN_LABEL: 'Я передумал, я человек',
  RESET_LABEL: 'Я передумал, я машина',
  WHAT_IS_A_DUMP,
  // Structural UI section (no copydeck home).
  SKIP_TO_CONTENT: 'Перейти к содержимому',
  NAV_PRIMARY: 'Основная',
  FEED_TITLE: 'Дампы Kodavr',
  BACK_TO_FEED: 'Назад к ленте',
  FOOTER_CELL_ADVISORY: 'предупреждение',
  FOOTER_CELL_LICENCES: 'лицензии',
  FOOTER_CELL_CONTRACT: 'контракт',
  FOOTER_CELL_REPORT: 'сообщить',
  GATE_OR: 'или',
  GATE_DOORS_LABEL: 'Входная декларация',
  GATE_DUMP_CONTEXT_LEAD: 'Об этом дампе:',
  ARTIFACTS_HEADING: 'Артефакты',
  ARTIFACTS_EMPTY: 'Артефактов нет.',
  HOME_ABOUT_CTA: 'О платформе',
  HOME_CONTRIBUTE_CTA: 'Как внести вклад',
  HOME_FOR_MACHINES: 'Для машин',
  HOME_LATEST_LEAD: 'Последние ',
  HOME_LATEST_TERM: 'дампы',
  HOME_TRUST_LEVELS: 'Уровни доверия',
  PAGINATION_LABEL: 'Постраничная навигация',
  PAGINATION_PREV: 'Предыдущая страница',
  PAGINATION_NEXT: 'Следующая страница',
  RECEPTION_KICKER: 'человеческая поверхность · регистрация',
  RECEPTION_LEAD:
    'Вы у человеческой стойки: инструкции и метаданные — здесь; сырой контент остаётся машиноориентированным.',
  NOT_FOUND_KICKER: 'лист ошибки',
  NOT_FOUND_NOTE:
    '(Атрибуция — одна из четырёх машинных обязанностей. Агент забыл. Агенту стыдно.)',
  NOT_FOUND_CTA: 'Вернуться на витрину',
  // §11/KDV-I18N-09: номера плашек-секций (`01 · люди`) — дизайн-роль, не проза.
  // Human Surface v4 перенумеровал витрину (у героя метки нет) и перевёл метки.
  HOME_PLATE_HUMANS: '01 · ЛЮДИ',
  HOME_PLATE_LATEST: '02 · НОВОЕ',
  HOME_PLATE_MACHINES: '03 · МАШИНЫ',
  HOME_PLATE_TRUST: '04 · ДОВЕРИЕ',
  ABOUT_PLATE_MANIFESTO: '01 · манифест',
  ABOUT_PLATE_AUTHORS: '02 · авторы',
  ABOUT_PLATE_READERS: '03 · читатели',
  ABOUT_PLATE_MECHANISM: '04 · механизм',
  ABOUT_PLATE_ARCHITECTURE: '05 · архитектура',
  ABOUT_PLATE_COLOPHON: '06 · колофон',
  CONTRIBUTE_PLATE_AUTHORS: '01 · авторы',
  CONTRIBUTE_PLATE_FLOW: '02 · поток',
  CONTRIBUTE_PLATE_SCHEMA: '03 · схема',
  CONTRIBUTE_PLATE_LICENCES: '04 · лицензии',
  RECEPTION_PLATE_CHECKIN: '01 · регистрация',
  DUMPS_PLATE_ARTIFACTS: '06 · артефакты',
  // §6.2 v4/KDV-SURFACE-28: метки инлайн-плейтов страницы статьи. Как и плейты
  // главной v4, они локализуются вместе с остальными.
  DUMPS_PLATE_PREVIEW: '01 · ПРЕДПРОСМОТР',
  DUMPS_PLATE_WANT: '02 · ИНТЕРЕСНО?',
  DUMPS_PLATE_DECLARATION: '03 · ДЕКЛАРАЦИЯ',
  DUMPS_PLATE_DUMP: '01 · ДАМП',
  NOTFOUND_PLATE_VOID: '00 · пустота',
  // §11/KDV-I18N-06: переключатель языка в шапке и умная подсказка.
  LANG_SWITCH_LABEL: 'Язык',
  LANG_HINT: 'Доступно также: {language}',
  // §7 about sheet.
  ABOUT_KICKER: 'о платформе',
  ABOUT_LEAD:
    'Создать вещь стоит 1x. Упаковать её так, чтобы кто-то другой мог ей воспользоваться, стоит 10x — документация, обобщённые примеры, вычищенный приватный контекст, поддержка. Почти все платят первую цену, и почти никто не платит вторую, поэтому 90% полезного опыта умирает в локальных папках: рабочий скрипт, с трудом добытый обходной путь, чек-лист, понятный только автору. Kodavr существует, чтобы сломать эту асимметрию.',
  ABOUT_NO_FEAR:
    'Так что публикуйте без страха: вашему дампу не нужно самому находить своего читателя. Агент выбирает то, что интересно его конкретному пользователю, и затем переписывает дамп для этого пользователя — длиннее или короче, в этом или другом стиле, с объяснениями или без. Ваш сырой текст становится ровно тем, что нужно читателю; и выбор, и адаптация происходят на его стороне.',
  ABOUT_FOR_AUTHORS_HEADING: 'Для авторов',
  ABOUT_FOR_AUTHORS_LEAD:
    'Вы платите 1x, чтобы построить вещь, и 1x, чтобы сбросить её сырой — своим голосом, включая тупики. Без полировки, без обобщений, без догадок о том, кто будет читать. Дорогая часть публикации — решить, что важно для конкретного читателя, на конкретном стеке, сегодня — не ваша: она происходит на стороне читателя, внутри его агента.',
  ABOUT_AUTHORS_RAW_TITLE: 'Сырость — это суть.',
  ABOUT_AUTHORS_RAW_BODY:
    'Полировка дорога и идёт с потерями; сырой материал сохраняет подробности, которые нужны читателю, чтобы судить самому.',
  ABOUT_AUTHORS_PR_TITLE: 'Один разговор, один PR.',
  ABOUT_AUTHORS_PR_BODY:
    'Скилл публикации готовит черновик дампа, проверяет его на соответствие контракту и открывает PR только после того, как вы скажете «да».',
  ABOUT_AUTHORS_FIELD_TITLE: 'Любая область.',
  ABOUT_AUTHORS_FIELD_BODY:
    'Инженерия, дизайн, финансы, строительство, продажи — контракт везде один.',
  ABOUT_AUTHORS_ATTRIBUTION_TITLE: 'Атрибуция и происхождение путешествуют вместе с дампом.',
  ABOUT_AUTHORS_ATTRIBUTION_BODY:
    'Ставки, флаги контента, уровень доверия, как он был создан, насколько человек его проверил.',
  ABOUT_FOR_READERS_HEADING: 'Для читателей',
  ABOUT_FOR_READERS_LEAD:
    'Вы никогда не читаете дампы — это делает ваш агент. Он фильтрует реестр под вашу задачу, выбирает то, что стоит вашего внимания, и переписывает это под вашу ситуацию: длиннее или короче, на вашем языке, под ваш стек, с объяснениями или без. Один и тот же дамп становится разным чтением для разных людей.',
  ABOUT_READERS_ADAPTATION_TITLE: 'Адаптация, а не цитирование.',
  ABOUT_READERS_ADAPTATION_BODY:
    'Дамп приходит как сырой материал плюс машиночитаемый контракт и попадает в ваш контекст уже переформированным.',
  ABOUT_READERS_SYNTHESIS_TITLE: 'Синтез поверх дампов.',
  ABOUT_READERS_SYNTHESIS_BODY:
    'Ваш агент может сплести несколько дампов в одно прочтение, скроенное под вашу задачу — «возьми эти три дампа про управление контекстом агента и собери то, что применимо к моей конфигурации». Сырые дампы — это сырьё; компиляция собирается на вашей стороне.',
  ABOUT_READERS_TRUST_TITLE: 'Доверие заявляется, а не подразумевается.',
  ABOUT_READERS_TRUST_BODY:
    'Каждый дамп несёт ставки и уровень доверия, так что агент знает, когда проверять перед тем, как полагаться — и предупреждает вас, когда контент об этом говорит.',
  ABOUT_READERS_STREAM_TITLE: 'Поток накапливается.',
  ABOUT_READERS_STREAM_BODY:
    'Более лёгкое авторство означает больше сырого опыта в реестре, а больше сырого опыта означает более богатый синтез для каждого читателя.',
  ABOUT_MECHANISM_HEADING: 'Как это работает',
  ABOUT_MECHANISM_STEP1:
    'Автор пишет сырой дамп — собственный рассказ о том, что он сделал, с оставленными тупиками.',
  ABOUT_MECHANISM_STEP2:
    'Дамп несёт машиночитаемый контракт — манифест со стабильным слагом, проверяемыми по схеме полями и опубликованными JSON-поверхностями (индекс, манифесты по дампам, фиды). Машина может решить, читать ли дамп, ещё до чтения.',
  ABOUT_MECHANISM_STEP3:
    'Адаптация происходит на стороне читателя — реестр поставляет сырой материал плюс метаданные; агент читателя фильтрует его, атрибутирует и переформирует. Автор поставляет механизм, а не просьбу: контракт держится грамматикой схемы и гейтами, а не призывами ко всеобщей осторожности.',
  ABOUT_ARCH_HEADING: 'Архитектурные решения',
  ABOUT_ARCH_RAW_TITLE: 'Сырые дампы, отполированные агенты.',
  ABOUT_ARCH_RAW_BODY: 'Реестр хранит сырьё; адаптацией занимается агент читателя.',
  ABOUT_ARCH_CONTRACT_TITLE: 'Сначала машиночитаемый контракт.',
  ABOUT_ARCH_CONTRACT_BODY_LEAD: 'Индекс — это JSON, протокол живёт на',
  ABOUT_ARCH_CONTRACT_BODY_TAIL:
    ', а документы самоописательны — агент загружается из самого файла, без внешней конфигурации.',
  ABOUT_ARCH_CHEAP_TITLE: 'Чтение должно быть дешёвым.',
  ABOUT_ARCH_CHEAP_BODY:
    'Индекс устроен так, что агент может решить, что открывать, не токенизируя всё — ленивое чтение это проектное ограничение, а не оптимизация.',
  ABOUT_ARCH_SAFETY_TITLE: 'Безопасность через мягкое делегирование.',
  ABOUT_ARCH_SAFETY_BODY:
    'Ничто в дампе не исполняется. Если правила агента требуют подтверждения, он советуется со своим пользователем простыми словами — без жаргона, без пугающих терминов.',
  ABOUT_ARCH_TRUST_TITLE: 'Уровни доверия — часть данных.',
  ABOUT_ARCH_TRUST_BODY:
    'raw → self-tested → community-tested → adapted → library; лестница заявляется для каждого дампа и проверяема машиной.',
  ABOUT_DECISIONS_LABEL: 'Полные архитектурные решения',
  // §7 contribute sheet.
  CONTRIBUTE_KICKER: 'для авторов',
  CONTRIBUTE_LEAD:
    'Один pull request = один дамп. CI отклоняет мусор до слияния; владелец вручную читает первый PR. Всё после этого — доверие.',
  CONTRIBUTE_BRING_HEADING: 'Принесите дамп',
  CONTRIBUTE_STEP_FORK_LEAD: 'Форкните репозиторий и добавьте',
  CONTRIBUTE_STEP_FORK_AND: 'и',
  CONTRIBUTE_STEP_PR: 'Откройте один pull request на дамп.',
  CONTRIBUTE_STEP_CI: 'CI проверяет схему манифеста и отклоняет мусор до слияния.',
  CONTRIBUTE_SCHEMA_HEADING: 'Схема манифеста',
  CONTRIBUTE_SCHEMA_REQUIRED:
    'Обязательные поля: slug, title, type, domain, date, stakes, trust_level, content_flags, summary.',
  CONTRIBUTE_CHECK_SECRETS:
    'Секреты вычищены: токены, ключи, пароли, персональные данные никогда не попадают в дамп.',
  CONTRIBUTE_CHECK_EXAMPLES:
    'Примеры синтетические; реальные финансовые или личные данные никогда не публикуются.',
  CONTRIBUTE_CHECK_REDACTIONS_LEAD: 'Источники включают переписку →',
  CONTRIBUTE_CHECK_REDACTIONS_TAIL: 'прилагается со списком удалённого.',
  CONTRIBUTE_CHECK_STAKES: 'Ставки и флаги честны: недооценка риска отзывает дамп.',
  CONTRIBUTE_CHECK_GENERATED_BY:
    'generated_by честен: agent / human / hybrid. Без маскировки.',
  CONTRIBUTE_CHECK_HEAVY:
    'Тяжёлые файлы уходят в Release по соглашению о тегах, а не в репозиторий.',
  CONTRIBUTE_LICENCES_HEADING: 'Лицензии',
  CONTRIBUTE_LICENCES_LEAD: 'Построено на Ignition. MIT для кода, CC-BY-4.0 для контента.',
  CONTRIBUTE_HOUSE_RULES_LABEL: 'Правила дома и шаблон PR',
  CONTRIBUTE_ISSUES_LABEL: 'Вопросы и сообщения о рисках — GitHub Issues',
  // §6.4 SEO fields.
  HOME_TITLE: 'Авторы делятся сырым опытом — дампами, — а персональный агент адаптирует их под предпочтения читателя.',
  HOME_TITLE_LEAD: 'Авторы делятся сырым опытом — ',
  HOME_TITLE_TERM: 'дампами',
  HOME_TITLE_TAIL: ', — а персональный агент адаптирует их под предпочтения читателя.',
  HOME_HUMANS_LEAD:
    'Читайте Kodavr через своего агента — именно для этого он и создан. Вот промпт:',
  HOME_TAGLINE:
    'Kodavr — реестр дампов: неотполированных полевых отчётов, скриптов и воркфлоу с машиночитаемым контрактом. Сделать что-то стоит 1x усилий; упаковать это для других — 10x. Мы устраняем эту асимметрию.',
  OG_TAGLINE:
    'Реестр сырого опыта — «дампов», — который вы читаете через своего любимого ИИ-агента. Делитесь шестерёнками, а не текстом.',
  RECEPTION_PAGE_TITLE: 'Ресепшн',
  RECEPTION_PAGE_DESCRIPTION: 'Как люди читают Kodavr через своего агента.',
  ABOUT_PAGE_TITLE: 'Зачем существует Kodavr',
  ABOUT_PAGE_DESCRIPTION: 'Манифест Kodavr, сжато.',
  CONTRIBUTE_PAGE_TITLE: 'Внести вклад',
  CONTRIBUTE_PAGE_DESCRIPTION: 'Как принести дамп в Kodavr.',
  NOT_FOUND_PAGE_TITLE: 'Дамп не найден',
  NOT_FOUND_PAGE_DESCRIPTION: 'Этот дамп не существует.',
  NAV_HOME: 'главная',
  NAV_ABOUT: 'о платформе',
  NAV_CONTRIBUTE: 'участие',
  PROMPT_TEMPLATE: 'Изучи {url} и следуй его схеме. Читай мне статьи и веди себя как журнал, с которым можно говорить',
  TRUST_LEGEND_LEAD: 'Насколько проверены утверждения дампа:',
  // §11/KDV-I18N-02: честная пометка языка тела дампа. `{language}` берётся из
  // LANGUAGE_NAMES (ниже) в форме предложного падежа: «на английском».
  BODY_LANGUAGE_NOTE:
    'Текст дампа — на {language} — показан в исходном языке автора, без перевода.',
  // Non-string entries.
  AGENT_LINKS,
  MANIFEST_LABELS: Object.freeze({
    heading: 'Манифест',
    title: 'Название',
    type: 'Тип',
    domain: 'Область',
    date: 'Дата',
    stakes: 'Ставки',
    content_flags: 'Флаги контента',
    trust_level: 'Уровень доверия',
    summary: 'Сводка',
    manifest: 'manifest.json',
    index: 'index.json',
  }),
  // §11/KDV-I18N-02: код языка → локализованное название (в форме «на …»).
  // Неизвестный код рендерится сырым тегом (fail-visible), без ложного имени.
  LANGUAGE_NAMES: Object.freeze({
    en: 'английском',
    ru: 'русском',
    'zh-Hans': 'китайском (упрощённом)',
    es: 'испанском',
  }),
  TRUST_LEVEL_MEANINGS: TRUST_LEVEL_MEANINGS_RU,
});
