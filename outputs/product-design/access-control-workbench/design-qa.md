# 菜单资源与角色矩阵工作台：设计 QA

## Comparison target

| Page | Source visual truth | Browser-rendered implementation |
| --- | --- | --- |
| 菜单资源 | `/Users/lusice/.codex/generated_images/01a04661-4a4d-7d32-b181-9820a03d86ab/exec-e30ec166-2765-47d8-af6c-0116c8803f38.png` | `qa-menu-resources-1487x1058.png` |
| 角色与矩阵 | `/Users/lusice/.codex/generated_images/01a04661-4a4d-7d32-b181-9820a03d86ab/exec-a2858771-4a5b-4a6e-8a19-5047ab55442d.png` | `qa-role-matrix-1487x1058.png` |

- **Prototype URL:** `http://127.0.0.1:4175/`
- **Viewport and state:** `1487 × 1058 CSS px`, desktop Web. Menu page is on “菜单资源”, with “工作台” selected. Role page is on “角色与矩阵”, with “系统安全管理员” and one permission row selected.
- **Density normalization:** each source and corresponding implementation capture is `1487 × 1058 px` at the same CSS viewport. No resampling was used.
- **Full-view comparison evidence:** `qa-menu-comparison.png` and `qa-role-comparison.png` are browser-rendered pages containing the source and implementation in the same comparison input.
- **Focused comparison evidence:** the full-page captures remain readable at native dimensions in `qa-menu-resources-1487x1058.png` and `qa-role-matrix-1487x1058.png`; the review specifically inspected table headers, first/last visible rows, selection bands, unified pagination, role list, right-side inspector, and action icons.

## Comparison history

- **[P2, fixed] Role totals did not initially preserve the selected design’s semantic count.** The first render showed the visible mock rows (`9`) in the left role list and inspector, while the approved role design communicates a current total of `17` permissions for “系统安全管理员”. This weakened the connection between the table’s visible slice and the role impact summary.
  - **Fix:** `src/App.jsx` now renders the role’s semantic authorization total and increments that total when a new in-memory grant is added.
  - **Post-fix evidence:** `qa-role-matrix-1487x1058.png` shows `17 个权限` in the selected role and `17 个` in the inspector, matching the approved visual hierarchy.

No actionable P0, P1, or P2 differences remain for the approved desktop targets.

## Findings

### Accepted intentional differences

- The generated role-matrix visual had the page heading “受控资源目录”. The implementation uses the corrected product name **“角色与矩阵”**. This is intentional and matches the approved information architecture.
- The prototype uses the project’s existing Lucide-style icon language and native accessible select controls. The design has no bespoke raster/illustration assets; no custom SVG, CSS art, emoji, or placeholder imagery was introduced.
- The prototype adds a concise next-step note after menu-resource registration. It makes the approved dependency explicit: resource registration → permission-item registration → role matrix → user assignment. It is not a competing action surface.

### Follow-up polish (P3)

- The QA target is a desktop Web workbench; no mobile-app testing was performed, per the user’s explicit Web-only constraint. A future production implementation should still validate its actual responsive breakpoints against its own approved states.
- The prototype uses in-memory test data. It demonstrates the intended interactions but is not a replacement for the existing server-authorized API, audit, or persistent end-to-end acceptance path.

## Fidelity surfaces

| Surface | Result |
| --- | --- |
| Fonts and typography | Uses the product-aligned Aptos / Segoe UI Variable / PingFang fallback stack. The 22px context heading, compact 13px table UI, 12px metadata, and 10–11px permission codes preserve the dense, scannable hierarchy without default-state wrapping. |
| Spacing and layout rhythm | Menu resources use the approved app shell, 260px resource tree, table frame, contextual selection band, and footer pagination. Roles use the approved left catalog / central matrix / right inspector triad with matching 14px inter-panel gaps. |
| Colors and visual tokens | White working surfaces, low-saturation blue-gray canvas, #2864db primary actions, #eaf2ff selected rows, semantic green enabled pills, and restrained red destructive actions are consistent across both pages. |
| Image quality and asset fidelity | The targets contain no photographs, illustrations, or bespoke brand artwork. Standard iconography is supplied by the installed icon library; no image placeholder or handcrafted artwork is present. |
| Copy and content | “菜单资源” clearly separates controlled entry registration from permission-item registration. “角色与矩阵” explains that a grant consists of a permission item plus data scope, with an object reference only when the scope requires one. |
| States and interactions | Selection, search, status/scope filters, pagination, action overflow, create/edit drawers, fixed menu scope, named-object validation, success feedback, role selection, grant creation/edit/removal, and system-role assignment are implemented with realistic local state. |
| Accessibility | Native controls have names or wrapped labels, buttons have accessible names, visible focus styles are supplied, status is not colour-only, table controls use checkbox labels, and comparison images have alt text. |

## Interaction verification

- **Menu resources:** status filter selected a zero-row disabled state and returned to all resources; page `2` became active; a resource named “演示项目看板” was created through the standard resource drawer and appeared in the table.
- **Role workflow:** created “交付测试角色” with a stable role code; it became the selected role; added “维护项目任务” with `指定项目` scope and an object reference; the resulting role showed one grant; assigned the role to the local mock account and the inspector updated from `0` to `1` assigned user.
- **Constraint behavior:** menu permissions lock the data scope to “全组织”; project scope exposes and requires object reference input.
- **Console:** browser warning/error list after the interaction suite was `[]`.
- **Build and package checks:** `npm run build` passed; `npm run test:sites` passed all 4 tests; Prettier check passed for the prototype and comparison files.

## Implementation checklist

- [x] Build the selected menu-resource tree + table desktop workbench.
- [x] Build the selected role-directory + authorization-table + inspector desktop workbench.
- [x] Unify table pagination and management-drawer interaction language.
- [x] Make the primary resource → role → grant → user-role-assignment path interactive.
- [x] Compare both default screens against their chosen visual targets in a combined browser view.
- [x] Verify core interactions, browser console, production build, packaging tests, and formatting.

final result: passed
