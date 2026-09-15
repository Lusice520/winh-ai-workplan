(/* 由 prepare_capture.py 绑定测量基线。只读取主文档，不导航、不操作页面。 */
(plan) => {
  const elements = plan.targets.map(({name, selector}) => {
    let matches;
    try { matches = document.querySelectorAll(selector); }
    catch { return {name, selector, status: 'invalid_selector', count: 0}; }
    if (matches.length !== 1) return {name, selector, count: matches.length, status: matches.length ? 'ambiguous' : 'missing'};
    const el = matches[0];
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    let hidden = ['hidden', 'collapse'].includes(style.visibility);
    for (let parent = el; parent; parent = parent.parentElement) {
      const s = getComputedStyle(parent);
      if (s.display === 'none' || Number(s.opacity) === 0) hidden = true;
    }
    const hasBox = el.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
    const result = {
      name, selector, count: 1,
      status: hidden ? 'hidden' : hasBox ? 'measured' : 'unmeasurable',
      box: [rect.left + scrollX, rect.top + scrollY, rect.width, rect.height],
      text: (el.textContent || '').trim().slice(0, 300),
      computed: {display: style.display, visibility: style.visibility, opacity: style.opacity, fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, fontWeight: style.fontWeight, color: style.color, backgroundColor: style.backgroundColor},
      viewport_intersects: rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth
    };
    if (el instanceof HTMLImageElement) result.asset = {src: el.currentSrc, natural_width: el.naturalWidth, natural_height: el.naturalHeight, version: el.dataset.version || null};
    return result;
  });
  return {
    measurement_sha256: plan.measurement_sha256,
    url: location.href, title: document.title,
    viewport: {width: innerWidth, height: innerHeight}, dpr: devicePixelRatio,
    scroll: {x: scrollX, y: scrollY}, document_height: document.documentElement.scrollHeight,
    fonts_ready: document.fonts.status === 'loaded',
    images_ready: [...document.images].every(im => im.complete && im.naturalWidth > 0),
    document_overflow_x: document.documentElement.scrollWidth > innerWidth,
    captured_at: new Date().toISOString(), elements,
    assets: Object.fromEntries(elements.filter(el => el.asset).map(el => [el.name, el.asset]))
  };
}
)({"measurement_sha256": "3e9ada9d4771eeb1a6a0c8442e4141691057d597bb39a98d2e962e9641d99e8c", "targets": [{"name": "sidebar", "selector": ".workspace-sider"}, {"name": "header", "selector": ".workspace-header"}, {"name": "project-heading", "selector": ".business-page-heading"}, {"name": "project-facts", "selector": ".business-page--project > .business-facts"}, {"name": "handover-table", "selector": ".handover-checklist"}, {"name": "readiness-panel", "selector": ".handover-workspace .business-split > .business-stack:nth-child(2) > .business-panel:first-child"}, {"name": "first-checklist-row", "selector": ".handover-checklist .ant-table-tbody tr.ant-table-row:nth-of-type(2)"}]})