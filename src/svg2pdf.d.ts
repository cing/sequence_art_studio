declare module 'svg2pdf.js' {
  import type { jsPDF } from 'jspdf';

  export function svg2pdf(
    svgElement: SVGElement,
    pdf: jsPDF,
    options?: {
      xOffset?: number;
      yOffset?: number;
      width?: number;
      height?: number;
      preserveAspectRatio?: string;
    },
  ): Promise<void>;
}
