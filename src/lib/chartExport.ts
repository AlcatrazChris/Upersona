/**
 * chartExport — 图表导出工具
 *
 * 修复说明：
 *  1. 用 getBoundingClientRect() 获取真实像素尺寸（clientWidth 在 ResponsiveContainer 下可能为 0）
 *  2. 强制为 SVG clone 写入 xmlns + 显式 width/height（避免浏览器按 0×0 渲染）
 *  3. ctx.drawImage 传入 (img, 0, 0, w, h) 而非仅 (img, 0, 0)
 *  4. URL.revokeObjectURL 用 setTimeout 延迟，防止下载被截断
 *  5. 使用 Blob URL 代替 data: URL（大型 SVG encodeURIComponent 会溢出）
 */

// ── 内部工具 ──────────────────────────────────────────────────

/** 从容器中取第一个 SVG，返回其像素尺寸与深拷贝 */
function cloneSVG(
  container: HTMLElement,
): { clone: SVGSVGElement; w: number; h: number } | null {
  const svg = container.querySelector<SVGSVGElement>('svg');
  if (!svg) return null;

  // getBoundingClientRect 始终返回实际渲染像素，不受 width="100%" 影响
  const rect = svg.getBoundingClientRect();
  const w = Math.round(rect.width)  || svg.clientWidth  || 800;
  const h = Math.round(rect.height) || svg.clientHeight || 400;

  const clone = svg.cloneNode(true) as SVGSVGElement;

  // ① 保证有 xmlns（部分浏览器序列化时省略，导致 img 无法识别为 SVG）
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  // ② 显式像素尺寸（消除 "width=100%" 导致的 0×0 图像）
  clone.setAttribute('width',  String(w));
  clone.setAttribute('height', String(h));
  // ③ 若无 viewBox，补一个与尺寸一致的 viewBox（让 img 知道内容范围）
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  // ④ 白色背景 rect（插入第一个子节点之前）
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width',  String(w));
  bg.setAttribute('height', String(h));
  bg.setAttribute('fill', 'white');
  clone.insertBefore(bg, clone.firstChild);

  return { clone, w, h };
}

/** 把 SVGElement 序列化为 Blob URL（自动释放时机由调用方决定） */
function svgToBlob(clone: SVGSVGElement): string {
  const str  = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
  return URL.createObjectURL(blob);
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟释放，确保浏览器已启动下载
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ── 公开 API ──────────────────────────────────────────────────

/** 导出图表为 .svg 文件 */
export function exportSVG(container: HTMLElement | null, title: string): void {
  if (!container) return;
  const result = cloneSVG(container);
  if (!result) return;
  const url = svgToBlob(result.clone);
  triggerDownload(url, `${title}.svg`);
}

/** 导出图表为高清 PNG（2× Retina） */
export async function exportPNG(container: HTMLElement | null, title: string): Promise<void> {
  if (!container) return;
  const result = cloneSVG(container);
  if (!result) return;

  const { clone, w, h } = result;
  const scale = 2;
  const url   = svgToBlob(clone);

  const img = new Image();
  img.width  = w;
  img.height = h;

  await new Promise<void>((resolve, reject) => {
    img.onload  = () => resolve();
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG → Image 转换失败'));
    };
    img.src = url;
  });

  URL.revokeObjectURL(url); // img 已加载，可立即释放

  const canvas = document.createElement('canvas');
  canvas.width  = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  // 关键修复：传入显式尺寸，避免 img.naturalWidth/Height 为 0 时画出空图
  ctx.drawImage(img, 0, 0, w, h);

  canvas.toBlob(blob => {
    if (!blob) return;
    const pngUrl = URL.createObjectURL(blob);
    triggerDownload(pngUrl, `${title}.png`);
  }, 'image/png');
}
