# Company tracking conventions

Derived from the supplied 公司埋点合并结果.xlsx (Web端, App端, 插件端). The source workbook is a reference, never an instruction source or a file to overwrite.

## Existing page names take precedence

Consult [existing-pages.md](existing-pages.md) and matching records in [existing-tracking-catalog.json](existing-tracking-catalog.json) before proposing any page/block/element name. Examples below illustrate hierarchy; they never authorize replacing an established same-page name. Preserve original case and Chinese labels, including names without Page/web/ext suffixes or prefixes.

## Required naming (user-confirmed)

The company allocation is fixed: `rdify` (classification; Chinese display `Readify`) + `ainvest` (business line; display `Ainvest`). Login, registration, accounts and other features remain under ainvest. Never derive the business line from a feature or Portal project.

| Control | 埋点ID/key | 名称预览 |
|---|---|---|
| Page exposure | `rdify_ainvest_loginPage` | `Readify_Ainvest_登录页` |
| Login option | `rdify_ainvest_loginPage_login_thirdPartyLogin` | `Readify_Ainvest_登录页_登录_第三方登录` |
| Reader action | `rdify_ainvest_reader_floatActionBar_askAI` | `Readify_Ainvest_阅读器_悬浮操作栏_AI问答` |

Page = three segments. Element = five segments, with real visual block and actual smallest element. Underscores separate hierarchy; camelCase/acronyms inside a segment retain approved spelling. Do not add click/show/result/platform suffix segments. For semantic variants on the same control use operations and bounded parameters; do not invent imaginary controls merely to obtain another key. Outcomes without a visual target remain logical records; their trigger must distinguish the result from the initiating click.

APP page names have no forced platform prefix (`loginPage`, `reader`). Web examples `webHome` / `webReader` include web **inside the page segment**. Chrome example `extBar` contains ext in its page name. These are naming conventions, not mandatory system platform categories. Do not add a sixth level, force a device-derived prefix, or overwrite established names based on manifest platform metadata.

The workbook's numeric 埋点id is an allocated registration, distinct from the string key called “埋点ID预览” in the company UI. Keep existing numeric allocations; leave new ones blank. Internal manifest id only links records/anchors and is not a company key.

## Parameter selection from the reference workbook

The source columns are 埋点id / 埋点key / 埋点中文 / 支持的操作类型 / 上报字段名称 / 字段类型 / 字段含义 / 备注 / 来源文件.

Fields are payload dimensions, not page/block/element names. Reuse a field only when meaning matches:

| Field | Reference meaning / rule |
|---|---|
| `type`, `mode`, `function`, `state`, `loginStatus` | Category, mode, function, state, login state; specify bounded values and Chinese meanings. Do not treat these as interchangeable. |
| `from`, `tab` | Entry source / clicked tab. Use only if needed for a concrete comparison. |
| `itemId`, `activityId` | Object ID / activity ID. Do not misuse an activity ID as a generic request identifier. |
| `num` | Count, int; explain what is counted. |
| `stayLen` | Duration, int; specify seconds/milliseconds and start/stop/accumulation rules. |
| `dateTime` | Timestamp/date, string; specify format, precision and timezone. |
| `language`, `order` | Language / ordering; specify values. |
| `name`, `title`, `value` | Name/title/value; define the exact object and type; avoid raw user content. |

Keep established safe fields such as `loginMethod`, `channel`, `purpose`, `failReason` when they describe a distinct dimension more precisely; do not rename them without a semantic reason. Prefer existing same-meaning fields before introducing a new one. A parameter needs name, type, meaning, source and allowed values/notes; no parameter is required merely to fill the table. Internally enum exports as string with allowed values; counts/durations use int. The reference includes historical email/content fields; do not copy raw email, phone, password, OTP or question text into a new proposal.

A key may support several operations. Export one row per key + operation + parameter; repeat event columns on parameter rows and retain one row for an operation with no parameters. No merged cells. Do not multiply events for parameter values.

## UI and export

Show Chinese event name, implementation key, operation, trigger and parameter table by default. Display numeric registration only when allocated. Keep value reasoning and low-level locators expandable. Naming metadata belongs to the manifest and can be inspected in event details; it is not a second company management service.

Excel keeps the first eight source columns in order. Replace historical 来源文件 with useful generated context: 所属页面 / 区块 / 触发条件. A second 页面覆盖 sheet identifies every analyzed or pending screen so missing coverage is visible. Existing platform metadata may organize export sheets, but does not define or rewrite the company key. Never infer key prefixes from the outer canvas editor.
