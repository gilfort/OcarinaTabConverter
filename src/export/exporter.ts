import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export type ExportFormat = "pdf" | "png";

/** Captures an element's rendered output as a canvas, for use by both PDF and image export. */
async function captureElement(element: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(element, { backgroundColor: "#f5efe0" });
}

/** Exports an element as a downloadable PNG image, preserving its on-screen layout. */
async function exportAsImage(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureElement(element);
  const dataUrl = canvas.toDataURL("image/png");
  downloadDataUrl(dataUrl, `${filename}.png`);
}

/** Exports an element as a downloadable PDF, preserving its on-screen layout. */
async function exportAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureElement(element);
  const dataUrl = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`${filename}.pdf`);
}

/** Exports an element as a downloadable PDF or PNG, preserving its on-screen layout. */
export async function exportElement(element: HTMLElement, format: ExportFormat, filename: string): Promise<void> {
  if (format === "pdf") {
    await exportAsPdf(element, filename);
  } else {
    await exportAsImage(element, filename);
  }
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
