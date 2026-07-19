import { type CSSProperties, type ImgHTMLAttributes, type Touch as ReactTouch, type TouchEvent, useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import "./zoomable-image.css";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

type ZoomableImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "onClick" | "onKeyDown"> & {
  viewerLabel?: string;
};

interface Point {
  x: number;
  y: number;
}

interface PinchGesture {
  distance: number;
  zoom: number;
}

interface DragGesture extends Point {
  originX: number;
  originY: number;
}

function touchDistance(first: ReactTouch, second: ReactTouch) {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function clampPan(value: number, zoom: number) {
  const limit = Math.max(0, (zoom - 1) * 150);
  return Math.min(limit, Math.max(-limit, value));
}

export function ZoomableImage({ className, alt = "", src, viewerLabel, ...imageProps }: ZoomableImageProps) {
  const [open, setOpen] = useState(false);

  if (typeof src !== "string" || !src) return null;

  const label = viewerLabel ?? (alt ? `Open ${alt}` : "Open photo viewer");

  return (
    <>
      <img
        {...imageProps}
        src={src}
        alt={alt}
        className={["v2-zoomable-image-trigger", className].filter(Boolean).join(" ")}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      />
      {open ? <ImageViewer src={src} alt={alt} label={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ImageViewer({ src, alt, label, onClose }: { src: string; alt: string; label: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pinchRef = useRef<PinchGesture | null>(null);
  const dragRef = useRef<DragGesture | null>(null);
  const lastTapRef = useRef(0);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const updateZoom = (amount: number) => {
      setZoom((currentZoom) => {
        const nextZoom = clampZoom(currentZoom + amount);
        if (nextZoom === MIN_ZOOM) setPan({ x: 0, y: 0 });
        return nextZoom;
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "+" || event.key === "=") updateZoom(ZOOM_STEP);
      if (event.key === "-") updateZoom(-ZOOM_STEP);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function setZoomValue(value: number) {
    const nextZoom = clampZoom(value);
    setZoom(nextZoom);
    if (nextZoom === MIN_ZOOM) setPan({ x: 0, y: 0 });
  }

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2) {
      pinchRef.current = {
        distance: touchDistance(event.touches[0], event.touches[1]),
        zoom,
      };
      dragRef.current = null;
      return;
    }

    if (event.touches.length === 1 && zoom > MIN_ZOOM) {
      const touch = event.touches[0];
      dragRef.current = { x: touch.clientX, y: touch.clientY, originX: pan.x, originY: pan.y };
    }
  }

  function onTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length === 2 && pinchRef.current) {
      event.preventDefault();
      const currentDistance = touchDistance(event.touches[0], event.touches[1]);
      setZoomValue(pinchRef.current.zoom * (currentDistance / pinchRef.current.distance));
      return;
    }

    if (event.touches.length === 1 && dragRef.current && zoom > MIN_ZOOM) {
      event.preventDefault();
      const touch = event.touches[0];
      const x = clampPan(dragRef.current.originX + touch.clientX - dragRef.current.x, zoom);
      const y = clampPan(dragRef.current.originY + touch.clientY - dragRef.current.y, zoom);
      setPan({ x, y });
    }
  }

  function onTouchEnd() {
    pinchRef.current = null;
    dragRef.current = null;
  }

  function onStageClick() {
    const now = Date.now();
    if (now - lastTapRef.current < 280) setZoomValue(zoom > MIN_ZOOM ? MIN_ZOOM : 2);
    lastTapRef.current = now;
  }

  const transformStyle = {
    "--v2-image-zoom": String(zoom),
    "--v2-image-pan-x": `${pan.x}px`,
    "--v2-image-pan-y": `${pan.y}px`,
  } as CSSProperties;

  return (
    <div className="v2-image-viewer" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <button ref={closeButtonRef} type="button" className="v2-image-viewer-close" onClick={onClose} aria-label="Close photo viewer">
        <X size={22} />
      </button>
      <div
        className="v2-image-viewer-stage"
        onClick={(event) => {
          event.stopPropagation();
          onStageClick();
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <img className="v2-image-viewer-image" src={src} alt={alt} draggable={false} style={transformStyle} />
      </div>
      <div className="v2-image-viewer-controls" onClick={(event) => event.stopPropagation()} aria-label="Photo zoom controls">
        <button type="button" onClick={() => setZoomValue(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out"><Minus size={20} /></button>
          <output aria-live="polite">{Math.round(zoom * 100)}%</output>
        <button type="button" onClick={() => setZoomValue(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in"><Plus size={20} /></button>
        <button type="button" onClick={() => setZoomValue(MIN_ZOOM)} disabled={zoom === MIN_ZOOM && pan.x === 0 && pan.y === 0} aria-label="Reset photo zoom"><RotateCcw size={19} /></button>
      </div>
    </div>
  );
}
