# 角色与权限矩阵（方案 1）设计 QA

## Comparison target

- **Source visual truth:** `/Users/lusice/.codex/generated_images/01a04661-4a4d-7d32-b181-9820a03d86ab/exec-d5ee0165-8918-40cc-934b-efcf3684b55f.png`
- **Rendered implementation:** `qa/implementation-1487x1058.png`
- **Prototype URL:** `http://127.0.0.1:4174/`
- **State:** desktop default state; “系统安全管理员” selected, “正在新增第 18 条授权”, “维护菜单资源” selected, menu scope locked to “全组织”.
- **Viewport:** `1487 × 1058 CSS px`; browser capture output is normalized to that CSS size. The reference and implementation PNG files are both `1487 × 1058 px`, so no density resampling was used.

## Comparison evidence

- **Full view:** `qa/full-comparison.png` displays the source and implementation side by side in one browser-rendered comparison page. Both images are rendered at the same `617 × 439 px` scale in the same `1280 × 720` capture.
- **Focused matrix view:** `qa/matrix-comparison.png` uses the same source/implementation pair and the same crop transform to inspect the role-definition card, new-grant editor, matrix headers, row density, status tags, and action icons.

## Findings

- [P2, fixed] The first implementation added an 18px gap between the drawer header and the “角色定义” card, pushing the matrix and visible table rows below the selected target’s vertical rhythm.
  - Evidence: initial implementation capture showed the first card beginning below the header; the reference begins immediately beneath it.
  - Fix: removed the extra top margin from `.definition-card` in `src/styles.css`.
  - Post-fix evidence: `qa/implementation-1487x1058.png` and `qa/matrix-comparison.png` show the definition card, matrix editor, and sixth visible matrix row aligned to the intended first-screen density.

- [P2, fixed] Switching roles changed the visible selection but left uncontrolled role-definition inputs showing the previously selected role’s values.
  - Impact: an administrator could lose confidence about which role they are authoring.
  - Fix: role-definition inputs now use controlled `roleForm` state that is refreshed when the role changes.
  - Post-fix evidence: browser DOM after selecting “开发工程师” exposed `角色名称: 开发工程师`, `角色标识: ENGINEER`, and its matching description.

- [P1, fixed] “新建角色” initially jumped directly into a grant form on the existing role, which did not explain the intended “create role → configure first authorization” workflow.
  - Fix: the CTA now opens a clear creation state. Creating a valid mock role appends it to the list and opens “正在新增第 1 条授权” in the same drawer.
  - Post-fix evidence: browser test created “项目交付经理 / PROJECT_DELIVERY_MANAGER”, listed it, and then opened the first grant editor.

There are no remaining actionable P0, P1, or P2 differences for the selected desktop visual target.

## Fidelity surfaces

| Surface | Result |
| --- | --- |
| Fonts and typography | Uses the project’s Aptos / Segoe UI Variable / PingFang fallback stack. The 20px catalog title, 18px drawer title, 16px section titles, 13–14px labels, and 11–12px metadata preserve the selected target’s compact hierarchy without wrapping or truncation in the default state. |
| Spacing and layout rhythm | Recreates the `204px / 402px / remainder` desktop structure, 62px brand/header rhythm, 24px catalog insets, 20px drawer insets, compact 36px form controls, and row density. The corrected first card now starts directly below the drawer header. |
| Colors and visual tokens | Uses the existing product palette: #f5f7fb canvas, white surfaces, #2e62da primary action, #eaf1ff active role state, muted blue metadata, and a low-saturation amber constraint notice. Contrast remains legible for labels, disabled scope, status tags, and danger actions. |
| Image and icon fidelity | The source contains no photograph, illustration, or branded raster asset that needs recreation. Existing `lucide-react` icons are used because that is the established project icon system; no CSS art, custom inline SVG, emoji, or placeholder imagery was introduced. |
| Copy and content | The page explains the operation in product language: select a permission, set the data scope, reveal object references only when needed, optionally add conditions, and then add to the matrix. Menu permissions explicitly state why their data scope cannot change. |

## Interaction and accessibility checks

- “新建角色” → fill role definition → “创建角色并进入授权” creates a mock list item and opens the first grant draft.
- Selecting a menu permission disables the scope control and hides object references; the default state exposes this constraint in visible copy.
- Selecting `PROJECT_TASK_MANAGE` enables scope selection, defaults it to `NAMED_PROJECT`, and exposes the UUID reference field.
- Empty object references produce an inline guidance message; a valid mock reference can be added, edited, and removed from the matrix.
- Selecting another role updates the drawer’s context; closing and reopening the drawer preserves the selected role.
- Native controls have accessible labels; action buttons have explicit accessible names; focus-visible states are supplied for primary controls.
- Final default-state console warning/error list: `[]`.

## Scope and follow-up polish

- This is a browser-verified, frontend-only design prototype. It intentionally uses in-memory mock data; it does not create real roles, change real permissions, call IAM APIs, persist audit data, or test any App client.
- P3: the prototype uses a native selection control for reliable interaction. When applying the approved design to the actual web feature, it should use the existing project select component with equivalent searchable behavior and the popup fixes already being validated in the product.

## Implementation checklist

- [x] Match the selected方案 1 desktop structure and visual hierarchy.
- [x] Make the main role-authoring path interactive, including creation, scope-dependent fields, add, edit, and remove.
- [x] Verify the selected desktop visual state in the in-app browser.
- [x] Compare source and implementation in the same full-view and matrix-detail browser captures.
- [x] Run production build and Sites worker tests.

final result: passed
