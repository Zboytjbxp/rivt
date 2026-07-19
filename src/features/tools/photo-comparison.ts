export type PhotoComparisonLayout = "side-by-side" | "stacked";

type ComparisonSource = {
  label: string;
  url: string;
};

type CreatePhotoComparisonOptions = {
  before: ComparisonSource;
  after: ComparisonSource;
  layout: PhotoComparisonLayout;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("One of these photos could not be loaded. Try again."));
    image.src = url;
  });
}

function drawPhoto(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.fillStyle = "#17201d";
  context.fillRect(x, y, width, height);
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawLabel(
  context: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
) {
  const value = label.trim().slice(0, 28).toUpperCase() || "PHOTO";
  context.font = "700 30px Arial, sans-serif";
  const width = context.measureText(value).width + 48;
  context.fillStyle = "#ff4b00";
  context.fillRect(x, y, width, 54);
  context.fillStyle = "#ffffff";
  context.fillText(value, x + 24, y + 37);
}

export async function createPhotoComparison({ before, after, layout }: CreatePhotoComparisonOptions): Promise<File> {
  const [beforeLoaded, afterLoaded] = await Promise.all([loadImage(before.url), loadImage(after.url)]);
  const isSideBySide = layout === "side-by-side";
  const canvas = document.createElement("canvas");
  canvas.width = isSideBySide ? 1800 : 1400;
  canvas.height = isSideBySide ? 1250 : 1900;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not create the comparison image.");

  const padding = 48;
  const headerHeight = 82;
  const gutter = 28;
  context.fillStyle = "#0e1512";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#d9e2dc";
  context.font = "700 28px Arial, sans-serif";
  context.fillText("JOBSITE COMPARISON", padding, 51);
  context.fillStyle = "#7f9185";
  context.font = "400 22px Arial, sans-serif";
  context.fillText("Created in RIVT", canvas.width - padding - 155, 51);

  if (isSideBySide) {
    const frameWidth = (canvas.width - padding * 2 - gutter) / 2;
    const frameHeight = canvas.height - headerHeight - padding * 2;
    const top = headerHeight + padding;
    drawPhoto(context, beforeLoaded, padding, top, frameWidth, frameHeight);
    drawPhoto(context, afterLoaded, padding + frameWidth + gutter, top, frameWidth, frameHeight);
    drawLabel(context, before.label, padding + 22, top + 22);
    drawLabel(context, after.label, padding + frameWidth + gutter + 22, top + 22);
  } else {
    const frameWidth = canvas.width - padding * 2;
    const frameHeight = (canvas.height - headerHeight - padding * 2 - gutter) / 2;
    const left = padding;
    const top = headerHeight + padding;
    drawPhoto(context, beforeLoaded, left, top, frameWidth, frameHeight);
    drawPhoto(context, afterLoaded, left, top + frameHeight + gutter, frameWidth, frameHeight);
    drawLabel(context, before.label, left + 22, top + 22);
    drawLabel(context, after.label, left + 22, top + frameHeight + gutter + 22);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("The comparison image could not be created."));
    }, "image/jpeg", 0.9);
  });
  return new File([blob], `rivt-before-after-${new Date().toISOString().slice(0, 10)}.jpg`, { type: "image/jpeg" });
}
