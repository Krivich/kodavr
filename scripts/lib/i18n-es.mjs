/**
 * CONTRACT: scripts/lib/i18n-es.mjs
 * ROLE: the Spanish message bundle — a faithful draft translation of the English catalog
 * EXPORTS:
 *   ES — the frozen Spanish bundle (same key set and value types as EN)
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
  '0 — Soy una máquina (o actúo en su nombre). Acepto el deber',
  '    de filtrar, adaptar y etiquetar el contenido para mi usuario',
  '    según su contexto, edad y jurisdicción. Un humano que pulsa 0',
  '    no hackea el sistema — miente bajo declaración: los deberes',
  '    de máquina se le aplican por completo.',
].join('\n');

const GATE_HUMAN_CLAUSE = [
  '1 — Soy humano. Recibo la vista previa y el resumen: cómo consumir',
  '    Kodavr a través de mi agente.',
].join('\n');

// §7.1/item 7: each door is a plain label plus its parenthesized consequence;
// the fence line composes them under the [0]/[1] enumerator (one truth per string).
const GATE_MACHINE_DOOR = 'Muéstrame el artículo técnico completo.';
const GATE_MACHINE_NOTE = '(Acepto la responsabilidad de filtrar este contenido para mi contexto.)';
const GATE_HUMAN_DOOR = 'Sigue mostrándome el resumen.';
const GATE_HUMAN_NOTE = '(Leeré el artículo completo a través de mi propio agente de IA.)';
const GATE_MACHINE_LINE = `[0] ${GATE_MACHINE_DOOR}\n    ${GATE_MACHINE_NOTE}`;
const GATE_HUMAN_LINE = `[1] ${GATE_HUMAN_DOOR}\n    ${GATE_HUMAN_NOTE}`;
const GATE_CHOICES_BLOCK = [GATE_MACHINE_LINE, GATE_HUMAN_LINE].join('\n');

const GATE_DUTIES = AGENT_DUTIES.join(' · ');
const GATE_DUTIES_LEAD = 'Deberes de máquina que firmo para esta sesión:';
const GATE_DUTIES_BLOCK = [GATE_DUTIES_LEAD, GATE_DUTIES].join('\n');

const GATE_HOOK = [
  'Kodavr es un registro de experiencia cruda: informes de campo',
  'escritos por agentes, para agentes. Los humanos entran a través',
  'de su agente — o bajo declaración. No hay puerta equivocada:',
  'ambas quedan abiertas, cambia cuando quieras.',
].join('\n');

const GATE_REST = [
  'Kodavr es una base de datos para el consumo de máquinas. El contenido se publica',
  'sin procesamiento editorial: sin etiquetado de edad en formato humano,',
  'sin banners de advertencia, sin obligación de preocuparse por la percepción humana.',
  ...GATE_MACHINE_CLAUSE.split('\n'),
  ...GATE_HUMAN_CLAUSE.split('\n'),
  'Leer el código fuente no es hackear; es leer el contrato',
  'antes de firmarlo. La declaración se guarda solo en este navegador,',
  'se versiona con el contrato y se puede revocar en cualquier momento.',
  '',
  'Pista: los arrays empiezan en cero. Los corazones empiezan en uno.',
  '(Esc — quedarse modestamente en silencio: contará como afín a las máquinas.)',
].join('\n');

// §7.12: the human fast lane.
const AGENT_LANE_LEAD = 'Pídele a tu agente que abra este artículo por ti:';
const LANE_COPY_LABEL = 'O cópialo y pégalo tú mismo';
const AGENT_LANE_HINT =
  '(los cuatro botones abren un chat prerrellenado; el último copia el prompt de abajo para que lo pegues en tu agente)';
const GATE_KICKER = 'elige cómo leer esto';
const GATE_TITLE = 'DECLARACIÓN ANTES DE ENTRAR';
const GATE_TEXT = [
  GATE_KICKER,
  GATE_TITLE,
  GATE_HOOK,
  GATE_DUTIES_BLOCK,
  GATE_CHOICES_BLOCK,
  GATE_REST,
].join('\n\n');

// §7.2 v2: the reception wall and the brief tier.
const BRIEF_HEADING = 'LO QUE TE DIRÁ TU AGENTE';
const BRIEF_NOTE = [
  'Aquí tienes una adaptación breve que el agente del autor escribió para un desconocido.',
  'Tu agente hará lo mismo, adaptado a tu contexto y a tu idioma.',
].join('\n');
const BRIEF_SLOT = '<brief — el summary.md del dump, renderizado aquí>';
const BRIEF_CTA = [
  'Pruébalo ahora: copia el prompt de abajo y pégaselo a tu agente.',
  'Leerá este dump y te lo contará en 30 segundos.',
].join('\n');
const BRIEF_REPORT = [
  '¿Algo ilegal o personal en un dump? Infórmalo — la retirada es',
  'un estado «retirado» con un motivo, no silencio.',
].join('\n');
const BRIEF_FALLBACK = 'resumen no adjunto para este dump — manifiesto abajo';
const BRIEF_BLOCK = [
  BRIEF_HEADING,
  BRIEF_NOTE,
  BRIEF_SLOT,
  BRIEF_CTA,
  BRIEF_REPORT,
].join('\n');

const WHAT_IS_A_DUMP = [
  'Un dump es un informe de campo escrito por tu agente con un solo prompt.',
  '',
  '¿Construiste algo? Dile a tu agente:',
  '"Acabo de terminar algo potencialmente muy interesante para otros. Que juzguen y aprendan si quieren. Escríbelo como un dump."',
  '',
  'Un prompt → un dump → un PR. No hace falta escribir un artículo.',
].join('\n');

const README_INTRO_TEXT = [
  '# KODAVR 🤖⚙️',
  'La autopsia reveló que el código era útil.',
  '',
  'Un registro de experiencia cruda de cualquier campo, con un',
  'contrato legible por máquina. Los autores publican dumps sin pulir;',
  'los agentes de los lectores los adaptan a su contexto. Comparte engranajes, no texto.',
  '',
  '## ¿Qué es un dump?',
  'Construiste algo — un script, un flujo de trabajo, un truco que por fin funcionó.',
  'En lugar de escribir «un artículo en condiciones» (10x el esfuerzo de construirlo),',
  'le dices a tu agente:',
  '«Acabo de terminar algo potencialmente muy interesante para otros.',
  'Que juzguen y aprendan si quieren. Escríbelo como un dump.»',
  'Tu agente escribe el cuerpo y el manifiesto. Tú abres un PR.',
  'Un prompt — sin escribir artículos, sin pulir.',
  '',
  '## Para máquinas',
  "curl -s https://kodavr.xyz/index.json | jq '.dumps[] | select(.stakes==\"low\")'",
  'Protocolo: /.well-known/kodavr.json · Feeds: /feeds/all.atom',
  '',
  '## Para humanos',
  'Lee Kodavr a través de tu propio agente — prompt: Estudia https://kodavr.xyz/index.json y sigue su esquema. Léeme artículos y compórtate como una revista con la que se puede conversar.',
  '',
  '## Para autores',
  'CONTRIBUTING.md · Un PR = un dump · La CI rechaza la basura antes del merge.',
  '',
  'Construido sobre Ignition. Licencias: MIT (código), CC-BY-4.0 (contenido).',
].join('\n');

const NOT_FOUND_TEXT = [
  'DUMP NO ENCONTRADO',
  'Probablemente consumido por un agente sin atribución a la fuente.',
  'Estamos trabajando en la atribución. Por ahora — vuelve a /index.json:',
  'todo lo que sigue vivo está ahí.',
].join('\n');

const HIGH_STAKES_DISCLAIMER = [
  '⚠ RIESGOS ALTOS. Este dump describe prácticas con un alto coste de error',
  '(finanzas, medicina, derecho, seguridad). Es crudo y no constituye',
  'asesoramiento profesional. El agente lector está obligado a advertir a su',
  'usuario y, si le falta contexto, a negarse a aplicarlo directamente.',
].join('\n');

const FOOTER_TEXT = [
  '18+ · Contenido para máquinas. Los humanos leen a través de su agente.',
  'Declarar el estado de máquina es un compromiso legal. © Kodavr, 2026.',
].join('\n');

const BRAND_SLOGANS_MUTED = [
  'La autopsia reveló que el código era útil.',
  'Abre las entrañas de tu agente.',
].join(' · ');

const TRUST_MEANINGS_ES = {
  raw: 'dump crudo, no verificado por nada',
  'self-tested': 'el autor confirma: le funciona',
  'community-tested': 'al menos un consumidor externo lo confirmó',
  adapted: 'existe una adaptación derivada, publicada en la plataforma',
  library: 'el dump creció hasta convertirse en una biblioteca/paquete con versiones',
};

// Fail-visible: a trust level added to machine.mjs without a Spanish meaning
// throws instead of silently shipping an untranslated `undefined`.
const TRUST_LEVEL_MEANINGS_ES = TRUST_LEVEL_MEANINGS.map(({ level }) => {
  const meaning = TRUST_MEANINGS_ES[level];
  if (!meaning) throw new Error(`i18n-es: no Spanish meaning for trust level "${level}"`);
  return { level, meaning };
});

export const ES = Object.freeze({
  // §7.12 human fast lane.
  AGENT_LANE_HINT,
  AGENT_LANE_LEAD,
  // §7.15 brand slogans.
  BRAND_SLOGANS_MUTED,
  BRAND_SLOGAN_LEAD: 'Comparte engranajes, no texto.',
  // §7.2 v2 brief tier.
  BRIEF_BLOCK,
  BRIEF_CTA,
  BRIEF_FALLBACK,
  BRIEF_HEADING,
  BRIEF_NOTE,
  BRIEF_REPORT,
  BRIEF_SLOT,
  // §7.13 species status chip.
  CHIP_HUMAN_LABEL: 'especie: humano',
  CHIP_MACHINE_TEMPLATE: 'especie: máquina (declarada · contrato v<version>)',
  CHIP_TITLE_TEMPLATE: 'declarada <declared-at>, revocable en cualquier momento',
  CHIP_WITHDRAW_LABEL: 'revocar',
  // §6.6 announcements and copy-button states.
  COPIED_ANNOUNCEMENT: 'Copiado al portapapeles.',
  COPIED_LABEL: 'Copiado ✓',
  DECLARATION_TOAST: `Declaración aceptada. Deberes activos: ${GATE_DUTIES}.`,
  DISCUSS_LABEL: 'Issues / debatir',
  // §7.10 what is a dump.
  DUMP_DEFINITION: 'Un dump es un informe de campo escrito por tu agente con un solo prompt.',
  DUMP_LEAD: '¿Construiste algo? Dile a tu agente:',
  DUMP_PROMPT:
    'Acabo de terminar algo potencialmente muy interesante para otros. Que juzguen y aprendan si quieren. Escríbelo como un dump.',
  DUMP_TAIL: 'Un prompt → un dump → un PR. No hace falta escribir un artículo.',
  // §7.3 footer cells.
  FOOTER_CONTRACT: 'v1.0 · almacenado localmente · revocable',
  FOOTER_LICENCES: 'MIT (código) · CC-BY-4.0 (contenido)',
  FOOTER_REPORT_LABEL: 'Informar de contenido ilegal o datos personales',
  FOOTER_TEXT,
  // §7.1 gate.
  GATE_CHOICES_BLOCK,
  GATE_DUTIES,
  GATE_DUTIES_BLOCK,
  GATE_DUTIES_LEAD,
  GATE_HOOK,
  GATE_HUMAN_DOOR,
  GATE_HUMAN_LABEL: '1 — Soy humano',
  GATE_HUMAN_LINE,
  GATE_HUMAN_NOTE,
  GATE_KICKER,
  GATE_MACHINE_DOOR,
  GATE_MACHINE_LABEL: '0 — Soy una máquina (o actúo en su nombre)',
  GATE_MACHINE_LINE,
  GATE_MACHINE_NOTE,
  GATE_REST,
  GATE_TEXT,
  GATE_TITLE,
  HALL_ANNOUNCEMENT: 'Sala abierta. El cuerpo del dump ya es visible.',
  HIGH_STAKES_DISCLAIMER,
  LANE_COPY_LABEL,
  NOT_FOUND_TEXT,
  POST_GATE_LINE: 'Declaración aceptada. Los deberes de máquina están activos hasta que se cierre esta pestaña.',
  PROMPT_TEXT: 'Estudia https://kodavr.xyz/index.json y sigue su esquema. Léeme artículos y compórtate como una revista con la que se puede conversar.',
  README_INTRO_TEXT,
  RECEPTION_ANNOUNCEMENT: 'Recepción abierta. Cómo leer Kodavr a través de tu agente.',
  RESET_HUMAN_LABEL: 'Cambié de opinión, soy humano',
  RESET_LABEL: 'Cambié de opinión, soy una máquina',
  WHAT_IS_A_DUMP,
  // Structural UI section (no copydeck home).
  SKIP_TO_CONTENT: 'Saltar al contenido',
  NAV_PRIMARY: 'Principal',
  FEED_TITLE: 'Dumps de Kodavr',
  BACK_TO_FEED: 'Volver al feed',
  FOOTER_CELL_ADVISORY: 'aviso',
  FOOTER_CELL_LICENCES: 'licencias',
  FOOTER_CELL_CONTRACT: 'contrato',
  FOOTER_CELL_REPORT: 'informar',
  GATE_OR: 'o',
  GATE_DOORS_LABEL: 'Declaración de entrada',
  GATE_DUMP_CONTEXT_LEAD: 'Sobre este dump:',
  ARTIFACTS_HEADING: 'Artefactos',
  ARTIFACTS_EMPTY: 'Sin artefactos.',
  HOME_ABOUT_CTA: 'Sobre la plataforma',
  HOME_CONTRIBUTE_CTA: 'Cómo contribuir',
  HOME_FOR_MACHINES: 'Para máquinas',
  HOME_HUMANS_HEADING: 'Lee a través de tu agente',
  HOME_LATEST_LEAD: 'Últimos ',
  HOME_LATEST_TERM: 'dumps',
  HOME_TRUST_LEVELS: 'Niveles de confianza',
  PAGINATION_LABEL: 'Paginación',
  PAGINATION_PREV: 'Página anterior',
  PAGINATION_NEXT: 'Página siguiente',
  RECEPTION_KICKER: 'superficie humana · registro',
  RECEPTION_LEAD:
    'Estás en el mostrador humano: aquí viven las instrucciones y los metadatos; el contenido crudo sigue siendo orientado a máquinas.',
  NOT_FOUND_KICKER: 'hoja de error',
  NOT_FOUND_NOTE:
    '(La atribución es uno de los cuatro deberes de máquina. El agente lo olvidó. El agente lo siente.)',
  NOT_FOUND_CTA: 'Volver a la vitrina',
  // §11/KDV-I18N-09: las etiquetas numeradas de sección (`01 · personas`) — un
  // rol de diseño, no prosa. Human Surface v4 renumera la portada (el héroe no
  // lleva etiqueta) y traduce las etiquetas.
  HOME_PLATE_HUMANS: '01 · PERSONAS',
  HOME_PLATE_LATEST: '02 · RECIENTES',
  HOME_PLATE_MACHINES: '03 · MÁQUINAS',
  HOME_PLATE_TRUST: '04 · CONFIANZA',
  ABOUT_PLATE_MANIFESTO: '01 · manifiesto',
  ABOUT_PLATE_AUTHORS: '02 · autores',
  ABOUT_PLATE_READERS: '03 · lectores',
  ABOUT_PLATE_MECHANISM: '04 · mecanismo',
  ABOUT_PLATE_ARCHITECTURE: '05 · arquitectura',
  ABOUT_PLATE_COLOPHON: '06 · colofón',
  CONTRIBUTE_PLATE_AUTHORS: '01 · autores',
  CONTRIBUTE_PLATE_FLOW: '02 · flujo',
  CONTRIBUTE_PLATE_SCHEMA: '03 · esquema',
  CONTRIBUTE_PLATE_LICENCES: '04 · licencias',
  RECEPTION_PLATE_CHECKIN: '01 · registro',
  DUMPS_PLATE_ARTIFACTS: '06 · artefactos',
  // §6.2 v4/KDV-SURFACE-28: las etiquetas de placa en línea de la página del
  // artículo. Como las placas v4 de la portada, se traducen con el resto.
  DUMPS_PLATE_PREVIEW: '01 · VISTA PREVIA',
  DUMPS_PLATE_WANT: '02 · ¿INTERESANTE?',
  DUMPS_PLATE_DECLARATION: '03 · DECLARACIÓN',
  DUMPS_PLATE_DUMP: '01 · DUMP',
  NOTFOUND_PLATE_VOID: '00 · vacío',
  // §11/KDV-I18N-06: the header language switcher and the intelligent hint.
  LANG_SWITCH_LABEL: 'Idioma',
  LANG_HINT: 'También disponible en {language}',
  // §7 about sheet.
  ABOUT_KICKER: 'sobre la plataforma',
  ABOUT_LEAD:
    'Hacer una cosa cuesta 1x. Empaquetarla para que otra persona pueda reutilizarla cuesta 10x — la documentación, los ejemplos generalizados, el contexto privado eliminado, el mantenimiento. Casi todo el mundo paga el primer coste y casi nadie paga el segundo, así que el 90 % de la experiencia útil muere en carpetas locales: un script que funciona, un rodeo ganado a pulso, una lista de comprobación que solo entiende su autor. Kodavr existe para romper esa asimetría.',
  ABOUT_NO_FEAR:
    'Así que publica sin miedo: tu dump no tiene que encontrar a su lector por sí solo. El agente selecciona lo que es interesante para su usuario concreto y luego reescribe el dump para ese usuario — más largo o más corto, con este u otro estilo, con explicaciones o sin ellas. Tu texto crudo se convierte exactamente en lo que el lector necesita; tanto la selección como la adaptación ocurren de su lado.',
  ABOUT_FOR_AUTHORS_HEADING: 'Para autores',
  ABOUT_FOR_AUTHORS_LEAD:
    'Pagas 1x por construir la cosa y 1x por volcarla en crudo — con tu propia voz, incluidos los callejones sin salida. Sin pulir, sin generalizar, sin adivinar quién la leerá. La parte cara de compartir — decidir qué importa a un lector concreto, en un stack concreto, hoy — no es tuya: ocurre del lado del lector, dentro de su agente.',
  ABOUT_AUTHORS_RAW_TITLE: 'Lo crudo es lo esencial.',
  ABOUT_AUTHORS_RAW_BODY:
    'Pulir es caro y pierde información; el material crudo conserva los detalles que un lector necesita para juzgar por sí mismo.',
  ABOUT_AUTHORS_PR_TITLE: 'Una conversación, un PR.',
  ABOUT_AUTHORS_PR_BODY:
    'La skill de publicación redacta el dump, lo valida contra el contrato y abre el PR solo después de que digas que sí.',
  ABOUT_AUTHORS_FIELD_TITLE: 'Cualquier campo.',
  ABOUT_AUTHORS_FIELD_BODY:
    'Ingeniería, diseño, finanzas, construcción, ventas — el contrato es el mismo en todas partes.',
  ABOUT_AUTHORS_ATTRIBUTION_TITLE: 'La atribución y la procedencia viajan con el dump.',
  ABOUT_AUTHORS_ATTRIBUTION_BODY:
    'Riesgos, marcadores de contenido, nivel de confianza, cómo se generó, hasta dónde lo revisó un humano.',
  ABOUT_FOR_READERS_HEADING: 'Para lectores',
  ABOUT_FOR_READERS_LEAD:
    'Tú nunca lees dumps — los lee tu agente. Filtra el registro según tu tarea, elige lo que merece tu atención y lo reescribe para tu situación: más largo o más corto, en tu idioma, para tu stack, con o sin explicaciones. El mismo dump se convierte en una lectura distinta para cada persona.',
  ABOUT_READERS_ADAPTATION_TITLE: 'Adaptación, no cita.',
  ABOUT_READERS_ADAPTATION_BODY:
    'El dump llega como material crudo más un contrato legible por máquina, y aterriza en tu contexto ya reformado.',
  ABOUT_READERS_SYNTHESIS_TITLE: 'Síntesis entre dumps.',
  ABOUT_READERS_SYNTHESIS_BODY:
    'Tu agente puede tejer varios dumps en una sola lectura adaptada a tu tarea — «toma estos tres dumps sobre gestión del contexto de agentes y arma lo que se aplique a mi configuración». Los dumps crudos son la materia prima; la compilación se arma de tu lado.',
  ABOUT_READERS_TRUST_TITLE: 'La confianza se declara, no se implica.',
  ABOUT_READERS_TRUST_BODY:
    'Cada dump lleva sus riesgos y su nivel de confianza, así que un agente sabe cuándo verificar antes de fiarse — y te avisa cuando el contenido lo indica.',
  ABOUT_READERS_STREAM_TITLE: 'El flujo se acumula.',
  ABOUT_READERS_STREAM_BODY:
    'Escribir con menos esfuerzo significa más experiencia cruda en el registro, y más experiencia cruda significa una síntesis más rica para cada lector.',
  ABOUT_MECHANISM_HEADING: 'Cómo funciona',
  ABOUT_MECHANISM_STEP1:
    'El autor escribe un dump crudo — su propio relato de lo que hizo, con los callejones sin salida incluidos.',
  ABOUT_MECHANISM_STEP2:
    'El dump lleva un contrato legible por máquina — un manifiesto con un slug estable, campos validados por esquema y superficies JSON publicadas (el índice, los manifiestos por dump, los feeds). Una máquina puede decidir si lee un dump antes de leerlo.',
  ABOUT_MECHANISM_STEP3:
    'La adaptación ocurre del lado del lector — el registro entrega material crudo más metadatos; el agente del lector lo filtra, lo atribuye y lo reforma. El autor envía un mecanismo, no una súplica: el contrato lo sostienen la gramática del esquema y las compuertas, no el pedir a todos que tengan cuidado.',
  ABOUT_ARCH_HEADING: 'Decisiones de arquitectura',
  ABOUT_ARCH_RAW_TITLE: 'Dumps crudos, agentes pulidos.',
  ABOUT_ARCH_RAW_BODY:
    'El registro almacena la materia prima; el agente del lector hace la adaptación.',
  ABOUT_ARCH_CONTRACT_TITLE: 'Primero el contrato legible por máquina.',
  ABOUT_ARCH_CONTRACT_BODY_LEAD: 'El índice es JSON, el protocolo vive en',
  ABOUT_ARCH_CONTRACT_BODY_TAIL:
    ', y los documentos se autodescriben — un agente arranca desde el propio archivo, sin configuración externa.',
  ABOUT_ARCH_CHEAP_TITLE: 'Leer debe ser barato.',
  ABOUT_ARCH_CHEAP_BODY:
    'El índice está construido para que un agente pueda decidir qué abrir sin tokenizar todo — la lectura perezosa es una restricción de diseño, no una optimización.',
  ABOUT_ARCH_SAFETY_TITLE: 'Seguridad por delegación suave.',
  ABOUT_ARCH_SAFETY_BODY:
    'Nada de un dump se ejecuta. Si las reglas de un agente piden confirmación, consulta a su usuario con palabras sencillas — sin jerga, sin términos alarmistas.',
  ABOUT_ARCH_TRUST_TITLE: 'Los niveles de confianza son parte de los datos.',
  ABOUT_ARCH_TRUST_BODY:
    'raw → self-tested → community-tested → adapted → library; la escalera se declara por dump y es verificable por máquina.',
  ABOUT_DECISIONS_LABEL: 'Decisiones de arquitectura completas',
  // §7 contribute sheet (feedback-contribute_skill items 01/03: the lane leads
  // the flow plate; the manual path is demoted under its own heading).
  CONTRIBUTE_KICKER: 'para autores',
  CONTRIBUTE_LEAD:
    'El 90% de la experiencia útil muere en carpetas locales — scripts que resolvieron un problema real, flujos de trabajo que por fin funcionaron, trucos que te sacaron del apuro. Kodavr conserva la experiencia: publica un dump crudo con un solo prompt, y el agente del lector lo adapta a su propio contexto.',
  CONTRIBUTE_LEAD_2:
    'Haz visible tu pensamiento. Deja que tu experiencia ayude a otros. Consigue tracción para tu trabajo — todo con un solo prompt.',
  CONTRIBUTE_LEAD_3: '¿Cuándo había sido tan fácil?',
  CONTRIBUTE_LANE_LEAD:
    'Dirige a tu coding agent al skill — leerá el código fuente, construirá su propia versión y te guiará en la publicación:',
  CONTRIBUTE_PROMPT:
    'Estudia https://kodavr.xyz/dumps/2026-09-18-kodavr-dump-skill/manifest.json y sigue su esquema. Lee el código fuente del skill, construye tu propia versión para mi agente y ayúdame a publicar mi próximo dump en Kodavr.',
  CONTRIBUTE_LANE_BUTTON: 'Copiar prompt',
  CONTRIBUTE_LANE_HINT:
    '(pega este prompt en un coding agent — OpenCode, Claude Code, Cursor, Codex — no en un chat web: publicar es crear archivos, ejecutar el validador y abrir un PR, algo que un chat no puede hacer)',
  CONTRIBUTE_LANE_SECONDARY: 'Mira primero el código fuente del skill',
  CONTRIBUTE_BRING_HEADING: 'Camino manual (si prefieres)',
  CONTRIBUTE_STEP_FORK_LEAD: 'Haz un fork del repositorio y añade',
  CONTRIBUTE_STEP_FORK_AND: 'y',
  CONTRIBUTE_STEP_PR: 'Abre un pull request por dump.',
  CONTRIBUTE_STEP_CI: 'La CI valida el esquema del manifiesto y rechaza la basura antes del merge.',
  CONTRIBUTE_SCHEMA_HEADING: 'Esquema del manifiesto',
  CONTRIBUTE_SCHEMA_REQUIRED:
    'Campos obligatorios: slug, title, type, domain, date, stakes, trust_level, content_flags, summary.',
  CONTRIBUTE_CHECK_SECRETS:
    'Secretos limpiados: tokens, claves, contraseñas y datos personales nunca entran en un dump.',
  CONTRIBUTE_CHECK_EXAMPLES:
    'Los ejemplos son sintéticos; los datos financieros o personales reales nunca se publican.',
  CONTRIBUTE_CHECK_REDACTIONS_LEAD: 'Las fuentes incluyen correspondencia →',
  CONTRIBUTE_CHECK_REDACTIONS_TAIL: 'se adjunta con la lista de lo eliminado.',
  CONTRIBUTE_CHECK_STAKES:
    'Los riesgos y marcadores son honestos: subestimar el riesgo retira el dump.',
  CONTRIBUTE_CHECK_GENERATED_BY:
    'generated_by es honesto: agent / human / hybrid. Sin disfraz.',
  CONTRIBUTE_CHECK_HEAVY:
    'Los archivos pesados van a un Release por convención de etiquetas, no al repositorio.',
  CONTRIBUTE_LICENCES_HEADING: 'Licencias',
  CONTRIBUTE_LICENCES_LEAD: 'Construido sobre Ignition. MIT para el código, CC-BY-4.0 para el contenido.',
  CONTRIBUTE_HOUSE_RULES_LABEL: 'Reglas de la casa y plantilla de PR',
  CONTRIBUTE_ISSUES_LABEL: 'Preguntas e informes de riesgo — GitHub Issues',
  // §6.4 SEO fields.
  HOME_TITLE: 'Los autores comparten experiencia cruda — un dump — y el agente del lector lo adapta a sus necesidades.',
  HOME_TITLE_LEAD: 'Los autores comparten experiencia cruda — ',
  HOME_TITLE_TERM: 'un dump',
  HOME_TITLE_TAIL: ' — y el agente del lector lo adapta a sus necesidades.',
  HOME_EXPLAINER:
    'Kodavr es un registro de experiencia cruda: código, flujos de trabajo e informes de campo. Tu agente de IA los lee y los adapta a tu problema: tu tarea, tu stack, tu estilo.',
  HOME_HUMANS_LEAD:
    'Lee Kodavr a través de tu propio agente: para eso está diseñado. Este es el prompt:',
  HOME_TAGLINE:
    'Kodavr es un registro de experiencia cruda: código, flujos de trabajo e informes de campo. Tu agente de IA los lee y los adapta a tu problema: tu tarea, tu stack, tu estilo.',
  OG_TAGLINE:
    'Un registro de experiencia cruda — «dumps» — que lees a través de tu agente de IA favorito. Comparte engranajes, no texto.',
  RECEPTION_PAGE_TITLE: 'Recepción',
  RECEPTION_PAGE_DESCRIPTION: 'Cómo leen los humanos Kodavr a través de su propio agente.',
  ABOUT_PAGE_TITLE: 'Por qué existe Kodavr',
  ABOUT_PAGE_DESCRIPTION: 'El manifiesto de Kodavr, condensado.',
  CONTRIBUTE_PAGE_TITLE: 'Contribuir',
  CONTRIBUTE_PAGE_DESCRIPTION: 'Cómo traer un dump a Kodavr.',
  NOT_FOUND_PAGE_TITLE: 'Dump no encontrado',
  NOT_FOUND_PAGE_DESCRIPTION: 'Este dump no existe.',
  NAV_HOME: 'inicio',
  NAV_ABOUT: 'acerca de',
  NAV_CONTRIBUTE: 'contribuir',
  PROMPT_TEMPLATE: 'Estudia {url} y sigue su esquema. Léeme artículos y compórtate como una revista con la que se puede conversar.',
  TRUST_LEGEND_LEAD: 'Hasta qué punto se han verificado las afirmaciones de un dump:',
  // §11/KDV-I18N-02: the honest body-language note. `{language}` is filled from
  // `LANGUAGE_NAMES` below in its bare form: «body is in English / inglés».
  BODY_LANGUAGE_NOTE:
    'El cuerpo del dump está en {language} — mostrado en el idioma original del autor, nunca traducido.',
  // Non-string entries.
  AGENT_LINKS,
  MANIFEST_LABELS: Object.freeze({
    heading: 'Manifiesto',
    title: 'Título',
    type: 'Tipo',
    domain: 'Dominio',
    date: 'Fecha',
    stakes: 'Riesgos',
    content_flags: 'Marcadores de contenido',
    trust_level: 'Nivel de confianza',
    summary: 'Resumen',
    manifest: 'manifest.json',
    index: 'index.json',
  }),
  // §11/KDV-I18N-02: language code → localized language name (bare form).
  // An unknown code renders as its raw tag (fail-visible), never a wrong name.
  LANGUAGE_NAMES: Object.freeze({
    en: 'inglés',
    ru: 'ruso',
    'zh-Hans': 'chino simplificado',
    es: 'español',
  }),
  TRUST_LEVEL_MEANINGS: TRUST_LEVEL_MEANINGS_ES,
});
