# Design QA

- Source visual truth: `/Users/yijiehuang/.codex/generated_images/019ec441-9730-7fd1-816e-bc3a8d5cde3c/ig_08863ec4c3a7e46c016a2e26f0cf9c8191aa85572a43723989.png`
- Implementation screenshot: `/Users/yijiehuang/dev/workspace/short-link/qa/implementation.png`
- Full-view comparison: `/Users/yijiehuang/dev/workspace/short-link/qa/comparison.png`
- Mobile evidence: `/Users/yijiehuang/dev/workspace/short-link/qa/mobile.png`
- Mobile drawer evidence: `/Users/yijiehuang/dev/workspace/short-link/qa/mobile-drawer-viewport.png`
- Viewport: desktop `1440 x 1024`; mobile `390 x 844`
- State: authenticated mapping list with an enabled Mapping open in the edit drawer

**Findings**

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: system UI and Chinese fallbacks match the Ant Design target closely; hierarchy, weights, truncation, and form helper text remain readable.
- Spacing and layout: the global header, wide table workspace, toolbar, and fixed right drawer follow the selected mock. The drawer begins below the global header and the table contracts while editing.
- Colors and tokens: Ant Design blue, neutral surfaces, green status tags, and warning alert map cleanly to the source.
- Image quality and assets: the source contains no photographic or illustrative assets. All visible UI icons come from `@ant-design/icons`; no placeholder or custom-drawn assets are used.
- Copy and content: Chinese labels, validation help, status language, and destructive-action confirmation are coherent and complete.
- Responsiveness: the mobile layout stacks primary controls, retains a horizontally scrollable data table, and uses a full-width edit drawer with reachable footer actions.
- Accessibility and behavior: inputs have labels, semantic buttons/switches are keyboard reachable, focus states are provided by Ant Design, and loading/empty/success/error states are implemented.

**Patches Made**

- Removed the drawer mask and positioned the drawer below the global header to match the source.
- Contracted the table workspace while the drawer is open so operation controls remain visible.
- Added URL truncation and non-wrapping timestamps to prevent dense-table collisions.
- Made the drawer width responsive on mobile.
- Fixed stale search state by debouncing text changes and reading the submitted input value directly.
- Preserved edit state through the drawer closing animation to prevent title flicker.

**Focused Region Comparison**

- Reviewed the table header/row density, URL cells, status tags, operation controls, drawer form fields, switch, warning alert, metadata, and footer actions in the combined comparison image.

**Follow-up Polish**

- P3: dynamic local URLs are longer than the example-domain URLs in the mock, so the implementation intentionally truncates them earlier.

final result: passed
