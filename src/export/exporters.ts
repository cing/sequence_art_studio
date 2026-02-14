import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { downloadBlob } from '../lib/utils';

function cloneForExport(svg: SVGSVGElement, includeLegend: boolean): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!includeLegend) {
    clone.querySelector('[data-legend="true"]')?.remove();
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  return clone;
}

export function serializeSvg(svg: SVGSVGElement, includeLegend: boolean): string {
  const clone = cloneForExport(svg, includeLegend);
  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

export function exportSvg(svg: SVGSVGElement, filename: string, includeLegend: boolean): void {
  const svgString = serializeSvg(svg, includeLegend);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

export async function exportPng(
  svg: SVGSVGElement,
  filename: string,
  includeLegend: boolean,
  pixelWidth: number,
  pixelHeight: number,
  dpiScale: number,
): Promise<void> {
  const svgString = serializeSvg(svg, includeLegend);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to render SVG for PNG export.'));
      img.src = url;
    });

    const width = Math.max(1, Math.round(pixelWidth * dpiScale));
    const height = Math.max(1, Math.round(pixelHeight * dpiScale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context not available in this browser.');
    }

    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Could not encode PNG blob.'));
        }
      }, 'image/png');
    });

    downloadBlob(pngBlob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportPdf(
  svg: SVGSVGElement,
  filename: string,
  includeLegend: boolean,
  widthIn: number,
  heightIn: number,
): Promise<void> {
  const clonedSvg = cloneForExport(svg, includeLegend);

  const pdf = new jsPDF({
    orientation: widthIn > heightIn ? 'landscape' : 'portrait',
    unit: 'in',
    format: [widthIn, heightIn],
    compress: true,
  });

  await svg2pdf(clonedSvg, pdf, {
    xOffset: 0,
    yOffset: 0,
    width: widthIn,
    height: heightIn,
    preserveAspectRatio: 'none',
  });

  pdf.save(filename);
}
