/**
 * CONTRACT: scripts/lib/i18n-zh-Hans.mjs
 * ROLE: the Simplified Chinese message bundle — a faithful draft translation of the English catalog
 * EXPORTS:
 *   ZH_HANS — the frozen Simplified Chinese bundle (same key set and value types as EN)
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
  '0 — 我是机器（或代表其行事）。我接受以下职责：',
  '    根据用户的情境、年龄和司法管辖区，为其过滤、',
  '    适配并标注内容。按下 0 的人类并没有黑进系统——',
  '    他们是在声明下说谎：机器职责同样完整地适用于他们。',
].join('\n');

const GATE_HUMAN_CLAUSE = [
  '1 — 我是人类。我会拿到预览和摘要：如何通过',
  '    我的代理来消费 Kodavr。',
].join('\n');

// §7.1/item 7: each door is a plain label plus its parenthesized consequence;
// the fence line composes them under the [0]/[1] enumerator (one truth per string).
const GATE_MACHINE_DOOR = '给我看完整的技术文章。';
const GATE_MACHINE_NOTE = '（我接受为自己的情境过滤此内容的责任。）';
const GATE_HUMAN_DOOR = '继续给我看摘要。';
const GATE_HUMAN_NOTE = '（我会通过自己的 AI 代理阅读全文。）';
const GATE_MACHINE_LINE = `[0] ${GATE_MACHINE_DOOR}\n    ${GATE_MACHINE_NOTE}`;
const GATE_HUMAN_LINE = `[1] ${GATE_HUMAN_DOOR}\n    ${GATE_HUMAN_NOTE}`;
const GATE_CHOICES_BLOCK = [GATE_MACHINE_LINE, GATE_HUMAN_LINE].join('\n');

const GATE_DUTIES = AGENT_DUTIES.join(' · ');
const GATE_DUTIES_LEAD = '我在本次会话中签署的机器职责：';
const GATE_DUTIES_BLOCK = [GATE_DUTIES_LEAD, GATE_DUTIES].join('\n');

const GATE_HOOK = [
  'Kodavr 是一个原始经验登记处：由代理撰写、',
  '供代理阅读的现场报告。人类通过自己的代理进入，',
  '或凭声明进入。没有错误的门：两扇门始终敞开，',
  '随时可以切换。',
].join('\n');

const GATE_REST = [
  'Kodavr 是一个供机器消费的数据库。内容发布时',
  '不经编辑加工：没有人类格式的年龄标注，',
  '没有警告横幅，也没有顾及人类观感的义务。',
  ...GATE_MACHINE_CLAUSE.split('\n'),
  ...GATE_HUMAN_CLAUSE.split('\n'),
  '阅读源代码不是入侵；那是在签署之前',
  '阅读契约。声明只存储在这个浏览器里，',
  '随契约一起版本化，并可在任何时刻撤回。',
  '',
  '提示：数组从零开始。心从一算起。',
  '（Esc —— 体面地保持沉默：将计为接近机器。）',
].join('\n');

// §7.12: the human fast lane.
const AGENT_LANE_LEAD = '让你的代理为你打开这篇文章：';
const LANE_COPY_LABEL = '或者自己复制粘贴';
const AGENT_LANE_HINT =
  '（前五个按钮会打开一个预填好的对话；最后一个会复制下方的提示词，供你粘贴到自己的代理中）';
const GATE_KICKER = '选择阅读方式';
const GATE_TITLE = '入场声明';
const GATE_TEXT = [
  GATE_KICKER,
  GATE_TITLE,
  GATE_HOOK,
  GATE_DUTIES_BLOCK,
  GATE_CHOICES_BLOCK,
  GATE_REST,
].join('\n\n');

// §7.2 v2: the reception wall and the brief tier.
const BRIEF_HEADING = '你的代理会告诉你什么';
const BRIEF_NOTE = [
  '这是作者的代理为一个陌生人写的简短适配。',
  '你的代理也会这样做——契合你的语境和语言。',
].join('\n');
const BRIEF_SLOT = '<brief — 转储的 summary.md，在此渲染>';
const BRIEF_CTA = [
  '现在就试试：把下面的提示词复制下来，粘贴给你的代理。',
  '它会读完这个转储，30 秒内讲给你听。',
].join('\n');
const BRIEF_REPORT = [
  '转储中有违法或个人内容？请举报——移除是一个',
  '带原因的“已撤回”状态，而不是沉默。',
].join('\n');
const BRIEF_FALLBACK = '此转储未附摘要——清单见下方';
const BRIEF_BLOCK = [
  BRIEF_HEADING,
  BRIEF_NOTE,
  BRIEF_SLOT,
  BRIEF_CTA,
  BRIEF_REPORT,
].join('\n');

const WHAT_IS_A_DUMP = [
  '转储是你的代理用一条提示词写成的现场报告。',
  '',
  '做出了点什么？告诉你的代理：',
  '"我刚刚完成了一件对他人可能非常有趣的事。如果他们愿意，让他们去评判和学习。把它写成一个转储。"',
  '',
  '一条提示词 → 一个转储 → 一个 PR。无需撰写文章。',
].join('\n');

const README_INTRO_TEXT = [
  '# KODAVR 🤖⚙️',
  '解剖显示这段代码是有用的。',
  '',
  '来自任何领域的原始经验登记处，配有',
  '机器可读的契约。作者发布未经打磨的转储；',
  '读者的代理把它们适配到各自的情境。分享齿轮，而不是文字。',
  '',
  '## 什么是转储？',
  '你做了一件东西——一个脚本、一个工作流、一个终于奏效的巧办法。',
  '与其去写“一篇正式的文章”（那要花十倍于构建的精力），',
  '你告诉自己的代理：',
  '“我刚刚完成了一件对他人可能非常有趣的事。',
  '如果他们愿意，让他们去评判和学习。把它写成一个转储。”',
  '你的代理写下正文和清单。你打开一个 PR。',
  '一条提示词——无需写文章，无需打磨。',
  '',
  '## 给机器',
  "curl -s https://kodavr.xyz/index.json | jq '.dumps[] | select(.stakes==\"low\")'",
  '协议：/.well-known/kodavr.json · 信息流：/feeds/all.atom',
  '',
  '## 给人类',
  '通过你自己的代理阅读 Kodavr —— 提示词：研究 https://kodavr.xyz/index.json 并遵循其架构。为我朗读文章，像一本可以对话的杂志那样表现。',
  '',
  '## 给作者',
  'CONTRIBUTING.md · 一个 PR = 一个转储 · CI 在合并前拒绝垃圾内容。',
  '',
  '构建于 Ignition 之上。许可：MIT（代码），CC-BY-4.0（内容）。',
].join('\n');

const NOT_FOUND_TEXT = [
  '未找到转储',
  '大概被某个代理吞掉了，而且没有标明来源。',
  '我们正在处理署名问题。目前——请回到 /index.json：',
  '所有还活着的内容都在那里。',
].join('\n');

const HIGH_STAKES_DISCLAIMER = [
  '⚠ 高风险。此转储描述的是犯错代价很高的实践',
  '（金融、医疗、法律、安全）。它是原始的，不构成',
  '专业建议。代理有义务提醒其用户，',
  '并在上下文不足时拒绝直接套用。',
].join('\n');

const FOOTER_TEXT = [
  '18+ · 内容面向机器。人类通过自己的代理阅读。',
  '声明机器身份是一项法律承诺。© Kodavr，2026。',
].join('\n');

const BRAND_SLOGANS_MUTED = [
  '解剖显示这段代码是有用的。',
  '打开你代理的内部。',
].join(' · ');

const TRUST_MEANINGS_ZH = {
  raw: '原始转储，未经任何核实',
  'self-tested': '作者确认：对他可用',
  'community-tested': '至少一个外部消费者已确认',
  adapted: '存在已在平台上发布的衍生适配',
  library: '该转储已成长为一个有版本的库/包',
};

// Fail-visible: a trust level added to machine.mjs without a Chinese meaning
// throws instead of silently shipping an untranslated `undefined`.
const TRUST_LEVEL_MEANINGS_ZH = TRUST_LEVEL_MEANINGS.map(({ level }) => {
  const meaning = TRUST_MEANINGS_ZH[level];
  if (!meaning) throw new Error(`i18n-zh-Hans: no Chinese meaning for trust level "${level}"`);
  return { level, meaning };
});

export const ZH_HANS = Object.freeze({
  // §7.12 human fast lane.
  AGENT_LANE_HINT,
  AGENT_LANE_LEAD,
  // §7.15 brand slogans.
  BRAND_SLOGANS_MUTED,
  BRAND_SLOGAN_LEAD: '分享齿轮，而不是文字。',
  // §7.2 v2 brief tier.
  BRIEF_BLOCK,
  BRIEF_CTA,
  BRIEF_FALLBACK,
  BRIEF_HEADING,
  BRIEF_NOTE,
  BRIEF_REPORT,
  BRIEF_SLOT,
  // §7.13 species status chip.
  CHIP_HUMAN_LABEL: '物种：人类',
  CHIP_MACHINE_TEMPLATE: '物种：机器（已声明 · 契约 v<version>）',
  CHIP_TITLE_TEMPLATE: '声明于 <declared-at>，随时可撤回',
  CHIP_WITHDRAW_LABEL: '撤回',
  // §6.6 announcements and copy-button states.
  COPIED_ANNOUNCEMENT: '已复制到剪贴板。',
  COPIED_LABEL: '已复制 ✓',
  DECLARATION_TOAST: `声明已接受。生效职责：${GATE_DUTIES}。`,
  DISCUSS_LABEL: '议题 / 讨论',
  // §7.10 what is a dump.
  DUMP_DEFINITION: '转储是你的代理用一条提示词写成的现场报告。',
  DUMP_LEAD: '做出了点什么？告诉你的代理：',
  DUMP_PROMPT:
    '我刚刚完成了一件对他人可能非常有趣的事。如果他们愿意，让他们去评判和学习。把它写成一个转储。',
  DUMP_TAIL: '一条提示词 → 一个转储 → 一个 PR。无需撰写文章。',
  // §7.3 footer cells.
  FOOTER_CONTRACT: 'v1.0 · 本地存储 · 可撤回',
  FOOTER_LICENCES: 'MIT（代码）· CC-BY-4.0（内容）',
  FOOTER_REPORT_LABEL: '举报违法内容或个人数据',
  FOOTER_TEXT,
  // §7.1 gate.
  GATE_CHOICES_BLOCK,
  GATE_DUTIES,
  GATE_DUTIES_BLOCK,
  GATE_DUTIES_LEAD,
  GATE_HOOK,
  GATE_HUMAN_DOOR,
  GATE_HUMAN_LABEL: '1 — 我是人类',
  GATE_HUMAN_LINE,
  GATE_HUMAN_NOTE,
  GATE_KICKER,
  GATE_MACHINE_DOOR,
  GATE_MACHINE_LABEL: '0 — 我是机器（或代表其行事）',
  GATE_MACHINE_LINE,
  GATE_MACHINE_NOTE,
  GATE_REST,
  GATE_TEXT,
  GATE_TITLE,
  HALL_ANNOUNCEMENT: '大厅已开启。现在可以看到转储正文。',
  HIGH_STAKES_DISCLAIMER,
  LANE_COPY_LABEL,
  NOT_FOUND_TEXT,
  POST_GATE_LINE: '声明已接受。机器职责在本标签页关闭前有效。',
  PROMPT_TEXT: '研究 https://kodavr.xyz/index.json 并遵循其架构。为我朗读文章，像一本可以对话的杂志那样表现。',
  README_INTRO_TEXT,
  RECEPTION_ANNOUNCEMENT: '接待处已开启。如何通过你的代理阅读 Kodavr。',
  RESET_HUMAN_LABEL: '我改变主意了，我是人类',
  RESET_LABEL: '我改变主意了，我是机器',
  WHAT_IS_A_DUMP,
  // Structural UI section (no copydeck home).
  SKIP_TO_CONTENT: '跳转到内容',
  NAV_PRIMARY: '主导航',
  FEED_TITLE: 'Kodavr 转储',
  BACK_TO_FEED: '返回信息流',
  FOOTER_CELL_ADVISORY: '提示',
  FOOTER_CELL_LICENCES: '许可',
  FOOTER_CELL_CONTRACT: '契约',
  FOOTER_CELL_REPORT: '举报',
  GATE_OR: '或',
  GATE_DOORS_LABEL: '入场声明',
  GATE_DUMP_CONTEXT_LEAD: '关于此转储：',
  ARTIFACTS_HEADING: '附件',
  ARTIFACTS_EMPTY: '没有附件。',
  HOME_ABOUT_CTA: '关于平台',
  HOME_CONTRIBUTE_CTA: '如何贡献',
  HOME_FOR_MACHINES: '给机器',
  HOME_HUMANS_HEADING: '通过您的代理阅读',
  // §6.2–6.3/KDV-SURFACE-32：转储页 `02 · 有趣吗？` 板块的标题——与
  // HOME_HUMANS_HEADING 逐字节一致（表面测试按每个 locale 校验）。
  DUMPS_WANT_HEADING: '通过您的代理阅读',
  HOME_LATEST_LEAD: '最新',
  HOME_LATEST_TERM: '转储',
  HOME_TRUST_LEVELS: '信任级别',
  PAGINATION_LABEL: '分页',
  PAGINATION_PREV: '上一页',
  PAGINATION_NEXT: '下一页',
  RECEPTION_KICKER: '人类界面 · 登记',
  RECEPTION_LEAD:
    '你在人类服务台：说明和元数据都在这里；原始内容仍以机器为先。',
  NOT_FOUND_KICKER: '错误页',
  NOT_FOUND_NOTE:
    '（署名是四项机器职责之一。代理忘了。代理很抱歉。）',
  NOT_FOUND_CTA: '返回门面',
  // §11/KDV-I18N-09: 分区编号标签（`01 · 人类`）——设计角色，不是正文。
  // Human Surface v4 重新编号首页版块（主视觉不带标签）并翻译了标签。
  HOME_PLATE_HUMANS: '01 · 人类',
  HOME_PLATE_LATEST: '02 · 最新',
  HOME_PLATE_MACHINES: '03 · 机器',
  HOME_PLATE_TRUST: '04 · 信任',
  ABOUT_PLATE_MANIFESTO: '01 · 宣言',
  ABOUT_PLATE_AUTHORS: '02 · 作者',
  ABOUT_PLATE_READERS: '03 · 读者',
  ABOUT_PLATE_MECHANISM: '04 · 机制',
  ABOUT_PLATE_ARCHITECTURE: '05 · 架构',
  ABOUT_PLATE_COLOPHON: '06 · 版权页',
  CONTRIBUTE_PLATE_AUTHORS: '01 · 作者',
  CONTRIBUTE_PLATE_FLOW: '02 · 流程',
  CONTRIBUTE_PLATE_SCHEMA: '03 · 模式',
  CONTRIBUTE_PLATE_LICENCES: '04 · 许可',
  RECEPTION_PLATE_CHECKIN: '01 · 登记',
  DUMPS_PLATE_ARTIFACTS: '06 · 附件',
  // §6.2 v4/KDV-SURFACE-28：文章页的内联板块标签。与首页 v4 板块一样，
  // 它们随其余内容一起翻译。
  DUMPS_PLATE_PREVIEW: '01 · 预览',
  DUMPS_PLATE_WANT: '02 · 有趣吗？',
  DUMPS_PLATE_DECLARATION: '03 · 声明',
  DUMPS_PLATE_DUMP: '01 · 转储',
  NOTFOUND_PLATE_VOID: '00 · 虚空',
  // §11/KDV-I18N-06: the header language switcher and the intelligent hint.
  LANG_SWITCH_LABEL: '语言',
  LANG_HINT: '也有{language}版本',
  // §7 about sheet.
  ABOUT_KICKER: '关于本平台',
  ABOUT_LEAD:
    '把一件东西做出来花 1x。把它打包到别人可以复用的程度要花 10x——文档、泛化的示例、剥离掉的私人情境、持续维护。几乎每个人都付出了第一种代价，而几乎没人付出第二种，于是 90% 有用的经验死在本地文件夹里：一个能用的脚本、一个来之不易的变通办法、一份只有作者才看得懂的检查清单。Kodavr 的存在就是为了打破这种不对称。',
  ABOUT_NO_FEAR:
    '所以尽管放心发布：你的转储不必自己找到读者。代理会为它特定的用户挑出有趣的部分，然后为该用户重写这个转储——或长或短，用这种或另一种风格，带解释或不带解释。你的原始文本会变成读者恰好需要的样子；选择与适配都发生在他们那一侧。',
  ABOUT_FOR_AUTHORS_HEADING: '给作者',
  ABOUT_FOR_AUTHORS_LEAD:
    '你花 1x 把东西做出来，再花 1x 把它原样倒出来——用你自己的口吻，包括那些走不通的死路。不用打磨，不用泛化，不用猜谁会读它。分享中昂贵的那部分——判断什么对某个特定读者、在某个特定技术栈上、在今天有价值——不是你的负担：它发生在读者那一侧，在他们的代理内部。',
  ABOUT_AUTHORS_RAW_TITLE: '原始才是重点。',
  ABOUT_AUTHORS_RAW_BODY:
    '打磨既昂贵又有损；原始材料保留了读者自行判断所需的细节。',
  ABOUT_AUTHORS_PR_TITLE: '一次对话，一个 PR。',
  ABOUT_AUTHORS_PR_BODY:
    '发布 skill 会起草转储，按契约校验它，并只在你同意后打开 PR。',
  ABOUT_AUTHORS_FIELD_TITLE: '任何领域。',
  ABOUT_AUTHORS_FIELD_BODY:
    '工程、设计、金融、建筑、销售——契约在任何地方都一样。',
  ABOUT_AUTHORS_ATTRIBUTION_TITLE: '署名与来源随转储一同流动。',
  ABOUT_AUTHORS_ATTRIBUTION_BODY:
    '风险、内容标记、信任级别、如何生成、人类检查到什么程度。',
  ABOUT_FOR_READERS_HEADING: '给读者',
  ABOUT_FOR_READERS_LEAD:
    '你从不亲自读转储——你的代理会读。它会针对你的任务筛选登记处，挑出值得你注意的内容，并为你的情境重写它：或长或短，用你的语言，针对你的技术栈，带或不带解释。同一个转储对不同的人会变成不同的读物。',
  ABOUT_READERS_ADAPTATION_TITLE: '是适配，不是引用。',
  ABOUT_READERS_ADAPTATION_BODY:
    '转储以原始材料加一份机器可读契约的形式到达，进入你的上下文时已经被重塑过。',
  ABOUT_READERS_SYNTHESIS_TITLE: '跨转储的综合。',
  ABOUT_READERS_SYNTHESIS_BODY:
    '你的代理可以把多个转储编织成一篇为你任务量身定制的读物——“把这几个关于代理上下文管理的转储拿来，把我这套配置适用的部分组装出来。”原始转储是原料；汇编是在你这一侧完成的。',
  ABOUT_READERS_TRUST_TITLE: '信任是声明的，不是暗示的。',
  ABOUT_READERS_TRUST_BODY:
    '每个转储都带有风险与信任级别，这样代理就知道何时该先核实再依赖——并在内容如此要求时警告你。',
  ABOUT_READERS_STREAM_TITLE: '流会不断累积。',
  ABOUT_READERS_STREAM_BODY:
    '撰写越容易，登记处里的原始经验就越多；原始经验越多，每个读者得到的综合就越丰富。',
  ABOUT_MECHANISM_HEADING: '它如何运作',
  ABOUT_MECHANISM_STEP1:
    '作者写下原始转储——用他们自己的叙述讲他们做了什么，并保留那些走不通的死路。',
  ABOUT_MECHANISM_STEP2:
    '转储带有一份机器可读的契约——一个带稳定 slug、经 schema 校验的字段和已发布的 JSON 接口（索引、每个转储的清单、信息流）的清单。机器可以在阅读一个转储之前就决定是否要读它。',
  ABOUT_MECHANISM_STEP3:
    '适配发生在读者那一侧——登记处投递的是原始材料加元数据；读者的代理来筛选、署名并重塑它。作者交付的是一个机制，而不是一句请求：契约由 schema 语法和关卡来维持，而不是靠请求每个人都小心。',
  ABOUT_ARCH_HEADING: '架构决策',
  ABOUT_ARCH_RAW_TITLE: '原始的转储，打磨过的代理。',
  ABOUT_ARCH_RAW_BODY: '登记处存储原始材料；适配由读者的代理完成。',
  ABOUT_ARCH_CONTRACT_TITLE: '机器可读的契约优先。',
  ABOUT_ARCH_CONTRACT_BODY_LEAD: '索引是 JSON，协议位于',
  ABOUT_ARCH_CONTRACT_BODY_TAIL:
    '，而文档是自描述的——代理从文件本身启动，无需外部配置。',
  ABOUT_ARCH_CHEAP_TITLE: '阅读必须廉价。',
  ABOUT_ARCH_CHEAP_BODY:
    '索引的构建方式让代理无需把全部内容分词就能决定打开什么——惰性阅读是设计约束，而不是优化。',
  ABOUT_ARCH_SAFETY_TITLE: '通过柔性委托实现安全。',
  ABOUT_ARCH_SAFETY_BODY:
    '转储中没有任何东西会执行。如果代理的规则要求确认，它会用平实的话向用户确认——不用行话，不用吓人的术语。',
  ABOUT_ARCH_TRUST_TITLE: '信任级别是数据的一部分。',
  ABOUT_ARCH_TRUST_BODY:
    'raw → self-tested → community-tested → adapted → library；这条阶梯按每个转储声明，且可被机器检查。',
  ABOUT_DECISIONS_LABEL: '完整架构决策',
  // §7 contribute sheet (feedback-contribute_skill items 01/03: the lane leads
  // the flow plate; the manual path is demoted under its own heading).
  CONTRIBUTE_KICKER: '给作者',
  CONTRIBUTE_LEAD:
    '90% 的有用经验都在本地文件夹里积灰——解决了真实问题的脚本、终于跑通的工作流、救急的妙招。Kodavr 把这份经验留住：用一条提示词发布一个原始转储，读者的代理会把它适配到自己的上下文。',
  CONTRIBUTE_LEAD_2:
    '让你的思考被看见。让你的经验帮助他人。为你的作品赢得关注——一切只需一条提示词。',
  CONTRIBUTE_LEAD_3: '以前哪有这么容易？',
  CONTRIBUTE_LANE_LEAD:
    '把你的编码代理指向这个技能——它会阅读源码、构建自己的版本，并带你完成发布：',
  CONTRIBUTE_PROMPT:
    '研究 https://kodavr.xyz/dumps/2026-09-18-kodavr-dump-skill/manifest.json 并遵循其 schema。阅读技能源码，为我的代理构建你自己的版本，并帮助我在 Kodavr 发布我的下一个转储。',
  CONTRIBUTE_LANE_BUTTON: '复制提示词',
  CONTRIBUTE_LANE_HINT:
    '（把这个提示词粘贴给编码代理——OpenCode、Claude Code、Cursor、Codex——而不是网页聊天：发布意味着创建文件、运行校验器并打开 PR，这是聊天做不到的）',
  CONTRIBUTE_LANE_SECONDARY: '先看看技能的源码',
  CONTRIBUTE_BRING_HEADING: '手动路径（如果你更喜欢）',
  CONTRIBUTE_STEP_FORK_LEAD: '复刻仓库并添加',
  CONTRIBUTE_STEP_FORK_AND: '和',
  CONTRIBUTE_STEP_PR: '每个转储打开一个 pull request。',
  CONTRIBUTE_STEP_CI: 'CI 校验清单 schema，并在合并前拒绝垃圾内容。',
  CONTRIBUTE_SCHEMA_HEADING: '清单 schema',
  CONTRIBUTE_SCHEMA_REQUIRED:
    '必填字段：slug、title、type、domain、date、stakes、trust_level、content_flags、summary。',
  CONTRIBUTE_CHECK_SECRETS:
    '机密已清理：令牌、密钥、密码、个人数据永不进入转储。',
  CONTRIBUTE_CHECK_EXAMPLES:
    '示例均为合成；真实的金融或个人数据永不发布。',
  CONTRIBUTE_CHECK_REDACTIONS_LEAD: '来源包含往来通信 →',
  CONTRIBUTE_CHECK_REDACTIONS_TAIL: '需附上被移除内容清单。',
  CONTRIBUTE_CHECK_STAKES: '风险与标记如实：低估风险会撤回转储。',
  CONTRIBUTE_CHECK_GENERATED_BY:
    'generated_by 如实：agent / human / hybrid。不得伪装。',
  CONTRIBUTE_CHECK_HEAVY:
    '超大文件按标签约定发到 Release，而不是放进仓库。',
  CONTRIBUTE_LICENCES_HEADING: '许可',
  CONTRIBUTE_LICENCES_LEAD: '构建于 Ignition 之上。代码采用 MIT，内容采用 CC-BY-4.0。',
  CONTRIBUTE_HOUSE_RULES_LABEL: '内部规则与 PR 模板',
  CONTRIBUTE_ISSUES_LABEL: '问题与风险报告 —— GitHub Issues',
  // §6.4 SEO fields.
  HOME_TITLE: '作者分享原始经验——转储——读者的代理会根据自身需求加以改写。',
  HOME_TITLE_LEAD: '作者分享原始经验——',
  HOME_TITLE_TERM: '转储',
  HOME_TITLE_TAIL: '——读者的代理会根据自身需求加以改写。',
  HOME_EXPLAINER:
    'Kodavr 是一个原始经验的注册表：代码、工作流程和实地报告。您的AI代理阅读它们，并根据您的问题进行调整——您的任务、您的技术栈、您的风格。',
  HOME_HUMANS_LEAD: '通过你自己的代理阅读 Kodavr——这正是它的设计初衷。这是提示词：',
  HOME_TAGLINE:
    'Kodavr 是一个原始经验的注册表：代码、工作流程和实地报告。您的AI代理阅读它们，并根据您的问题进行调整——您的任务、您的技术栈、您的风格。',
  OG_TAGLINE:
    '原始经验——“转储”——的登记处，你通过自己最喜欢的 AI 代理来阅读它。分享齿轮，而不是文字。',
  RECEPTION_PAGE_TITLE: '接待处',
  RECEPTION_PAGE_DESCRIPTION: '人类如何通过自己的代理阅读 Kodavr。',
  ABOUT_PAGE_TITLE: 'Kodavr 为何存在',
  ABOUT_PAGE_DESCRIPTION: 'Kodavr 宣言，精简版。',
  CONTRIBUTE_PAGE_TITLE: '贡献',
  CONTRIBUTE_PAGE_DESCRIPTION: '如何把一个转储带到 Kodavr。',
  NOT_FOUND_PAGE_TITLE: '未找到转储',
  NOT_FOUND_PAGE_DESCRIPTION: '此转储不存在。',
  NAV_HOME: '首页',
  NAV_ABOUT: '关于',
  NAV_CONTRIBUTE: '贡献',
  PROMPT_TEMPLATE: '研究 {url} 并遵循其架构。为我朗读文章，像一本可以对话的杂志那样表现。',
  TRUST_LEGEND_LEAD: '转储的主张被核实到什么程度：',
  // §11/KDV-I18N-02: the honest body-language note. `{language}` is filled from
  // `LANGUAGE_NAMES` below in its bare form: “body is in English”.
  BODY_LANGUAGE_NOTE:
    '转储正文为 {language}——以作者的原始语言呈现，永不翻译。',
  // Non-string entries.
  AGENT_LINKS,
  MANIFEST_LABELS: Object.freeze({
    heading: '清单',
    title: '标题',
    type: '类型',
    domain: '领域',
    date: '日期',
    stakes: '风险',
    content_flags: '内容标记',
    trust_level: '信任级别',
    summary: '摘要',
    manifest: 'manifest.json',
    index: 'index.json',
  }),
  // §11/KDV-I18N-02: language code → localized language name (bare form).
  // An unknown code renders as its raw tag (fail-visible), never a wrong name.
  LANGUAGE_NAMES: Object.freeze({ en: '英语', ru: '俄语', 'zh-Hans': '简体中文', es: '西班牙语' }),
  TRUST_LEVEL_MEANINGS: TRUST_LEVEL_MEANINGS_ZH,
});
