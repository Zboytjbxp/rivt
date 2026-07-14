import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Download, FileUp, FolderOpen, Image, Loader2, RefreshCw } from "lucide-react";
import type { CanonicalActiveWork } from "../work/job-api";
import {
  getProject,
  openProjectForActiveWork,
  ProjectApiError,
  uploadProjectMedia,
  type ProjectMedia,
  type ProjectRecord,
} from "./project-api";
import {
  AlbumApiError,
  createAlbum,
  getAlbum,
  listAlbums,
  uploadAlbumPhoto,
  type AlbumDetail,
  type AlbumPhoto,
  type PhotoAlbum,
} from "./album-api";
import type { StandaloneProject } from "./standalone-project-api";

type PhotoView = "gallery" | "detail" | "compare-a" | "compare-b" | "compare-view";
type JobPhotosMode = "home" | "album-detail" | "active-job";
type CaptureIntent = "progress" | "before" | "after" | "issue" | "material" | "closeout";
type PhotoFilter = "all" | CaptureIntent;

interface UnifiedPhoto {
  id: string;
  originalName: string;
  sizeBytes: number;
  createdAt: string;
  signedUrl: string | null;
  note: string;
  captureIntent: CaptureIntent | null;
}

type PhotoGalleryLayout = "grid" | "timeline";

interface UploadBatchResult {
  failedFiles: File[];
  message: string;
}

const CAPTURE_INTENTS: Array<{
  value: CaptureIntent;
  label: string;
  shortLabel: string;
  description: string;
  note: string;
}> = [
  { value: "progress", label: "Progress", shortLabel: "Prog", description: "Routine progress shot", note: "Progress photo" },
  { value: "before", label: "Before", shortLabel: "Before", description: "Existing condition", note: "Before photo" },
  { value: "after", label: "After", shortLabel: "After", description: "Finished result", note: "After photo" },
  { value: "issue", label: "Issue", shortLabel: "Issue", description: "Problem or change needed", note: "Issue photo" },
  { value: "material", label: "Material", shortLabel: "Mat", description: "Delivery or material proof", note: "Material photo" },
  { value: "closeout", label: "Closeout", shortLabel: "Close", description: "Final punch or handoff proof", note: "Closeout photo" },
];

function formatNumber(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0";
}

function fileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${formatNumber(sizeBytes / 1024, 1)} KB`;
  return `${formatNumber(sizeBytes / 1024 / 1024, 1)} MB`;
}

function relativeTime(iso: string) {
  const createdAt = new Date(iso).getTime();
  if (!Number.isFinite(createdAt)) return "Just now";
  const minutes = Math.max(0, Math.round((Date.now() - createdAt) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function photoDayLabel(iso: string) {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "Earlier";
  const date = new Date(timestamp);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfPhotoDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const deltaDays = Math.round((startOfToday - startOfPhotoDay) / 86400000);
  if (deltaDays <= 0) return "Today";
  if (deltaDays === 1) return "Yesterday";
  if (deltaDays < 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function photoFilterCount(photos: UnifiedPhoto[], filter: PhotoFilter) {
  if (filter === "all") return photos.length;
  return photos.filter((photo) => photo.captureIntent === filter).length;
}

function captureIntentLabel(intent: CaptureIntent | null) {
  return CAPTURE_INTENTS.find((option) => option.value === intent)?.label ?? "Photo";
}

function captureIntentNote(intent: CaptureIntent | null) {
  return CAPTURE_INTENTS.find((option) => option.value === intent)?.note ?? "";
}

function detectCaptureIntent(note: string): CaptureIntent | null {
  const normalized = note.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("before")) return "before";
  if (normalized.startsWith("after")) return "after";
  if (normalized.startsWith("issue")) return "issue";
  if (normalized.startsWith("material")) return "material";
  if (normalized.startsWith("closeout")) return "closeout";
  if (normalized.startsWith("progress")) return "progress";
  return null;
}

function captureLabel(photo: UnifiedPhoto) {
  if (photo.note.trim()) return photo.note.trim();
  const name = photo.originalName.replace(/\.[a-z0-9]+$/i, "");
  const compactName = name.replace(/[-_]+/g, " ").trim();
  return compactName || "Jobsite photo";
}

function projectErrorMessage(error: unknown) {
  if (error instanceof ProjectApiError) return error.message;
  return error instanceof Error ? error.message : "RIVT could not complete the camera request.";
}

function albumErrorMessage(error: unknown) {
  if (error instanceof AlbumApiError) return error.message;
  return error instanceof Error ? error.message : "RIVT could not complete the camera request.";
}

function newestFirst<T extends { createdAt: string }>(rows: T[]) {
  return [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function mergeById<T extends { id: string }>(incoming: T[], existing: T[]) {
  const seen = new Set(incoming.map((item) => item.id));
  return [...incoming, ...existing.filter((item) => !seen.has(item.id))];
}

function projectPhotoNotes(project: ProjectRecord | null) {
  const notesByUploadId = new Map<string, string>();
  if (!project) return notesByUploadId;
  for (const entry of project.entries) {
    if (entry.entryType !== "media") continue;
    const uploadId = typeof entry.metadata?.uploadId === "string" ? entry.metadata.uploadId : null;
    if (!uploadId) continue;
    const body = String(entry.body ?? "").trim();
    if (!body || /^uploaded\s/i.test(body)) continue;
    notesByUploadId.set(uploadId, body);
  }
  return notesByUploadId;
}

function photoFromProjectMedia(media: ProjectMedia, note = ""): UnifiedPhoto {
  return {
    id: media.id,
    originalName: media.originalName,
    sizeBytes: media.sizeBytes,
    createdAt: media.createdAt,
    signedUrl: media.signedUrl ?? null,
    note,
    captureIntent: detectCaptureIntent(note),
  };
}

function photoFromAlbumPhoto(photo: AlbumPhoto): UnifiedPhoto {
  return {
    id: photo.id,
    originalName: photo.originalName,
    sizeBytes: photo.sizeBytes,
    createdAt: photo.createdAt,
    signedUrl: photo.signedUrl,
    note: photo.caption ?? "",
    captureIntent: detectCaptureIntent(photo.caption ?? ""),
  };
}

function photoFromAlbumCover(album: PhotoAlbum): UnifiedPhoto | null {
  return album.coverPhoto ? photoFromAlbumPhoto(album.coverPhoto) : null;
}

function CameraCapture({
  onCapture,
  onClose,
  contextLabel,
  captureIntent,
  onCaptureIntentChange,
}: {
  onCapture: (blob: Blob) => Promise<void>;
  onClose: () => void;
  contextLabel: string;
  captureIntent: CaptureIntent | null;
  onCaptureIntentChange?: (intent: CaptureIntent) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [captureCount, setCaptureCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [lastSnapUrl, setLastSnapUrl] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [failedCapture, setFailedCapture] = useState<Blob | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const lastSnapRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (lastSnapRef.current) URL.revokeObjectURL(lastSnapRef.current);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    void navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).then((nextStream) => {
      stream = nextStream;
      if (videoRef.current) videoRef.current.srcObject = nextStream;
    }).catch((err: unknown) => {
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access was denied. Check your browser or app settings."
          : "Camera could not be started.",
      );
    });

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facingMode]);

  async function saveCapture(blob: Blob) {
    setSaveState("saving");
    setSaveMessage(`Saving to ${contextLabel}...`);
    try {
      await onCapture(blob);
      setFailedCapture(null);
      setCaptureCount((current) => current + 1);
      setSaveState("saved");
      setSaveMessage(`Saved to ${contextLabel}.`);
    } catch (err) {
      setFailedCapture(blob);
      setSaveState("failed");
      setSaveMessage(projectErrorMessage(err));
    }
  }

  function shoot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !ready) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (lastSnapRef.current) URL.revokeObjectURL(lastSnapRef.current);
      const nextUrl = URL.createObjectURL(blob);
      lastSnapRef.current = nextUrl;
      setLastSnapUrl(nextUrl);
      setFailedCapture(null);
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
      void saveCapture(blob);
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="v2-camera-overlay">
      {flash ? <div className="v2-camera-flash" aria-hidden="true" /> : null}
      <header className="v2-camera-topbar">
        <button type="button" className="v2-camera-close" onClick={onClose} disabled={saveState === "saving"} aria-label="Back to camera photos">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <strong className="v2-camera-topbar-title">Camera</strong>
      </header>
      {error ? (
        <div className="v2-camera-error">
          <strong>Camera unavailable</strong>
          <p>{error}</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="v2-camera-feed"
          playsInline
          muted
          autoPlay
          onLoadedMetadata={() => setReady(true)}
        />
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />
      <div className="v2-camera-bottom-controls">
        <div className="v2-camera-bottom-context" aria-label={`Saving photos to ${contextLabel}`}>
          <span>
            <small>Saving to</small>
            <strong>{contextLabel}</strong>
          </span>
          <button type="button" onClick={onClose} disabled={saveState === "saving"}>Photos</button>
        </div>
        {onCaptureIntentChange ? (
          <div className="v2-camera-intent-strip" role="group" aria-label="Capture type">
            {CAPTURE_INTENTS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === captureIntent ? "is-active" : ""}
                onClick={() => onCaptureIntentChange(option.value)}
                aria-pressed={option.value === captureIntent}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
        ) : null}
        {saveState !== "idle" ? (
          <span className={`v2-camera-save-status is-${saveState}`} role={saveState === "failed" ? "alert" : "status"}>
            {saveMessage}
          </span>
        ) : null}
        {failedCapture && saveState === "failed" ? (
          <button type="button" className="v2-camera-retry" onClick={() => void saveCapture(failedCapture)}>
            <RefreshCw size={15} /> Retry upload
          </button>
        ) : null}
        <div className="v2-camera-controls">
          <button type="button" className="v2-camera-last-capture" onClick={onClose} disabled={saveState === "saving"} aria-label={captureCount ? `View ${captureCount} photos saved in this camera session` : "View camera photos"}>
            {lastSnapUrl ? <img key={lastSnapUrl} src={lastSnapUrl} alt="Latest captured photo" /> : <span><Image size={18} /></span>}
          </button>
          <button
            type="button"
            className="v2-camera-shutter"
            onClick={shoot}
            disabled={!ready || Boolean(error) || saveState === "saving"}
            aria-label="Take photo"
          />
          <button
            type="button"
            className="v2-camera-switch"
            onClick={() => {
              setReady(false);
              setError("");
              setFacingMode((current) => current === "environment" ? "user" : "environment");
            }}
            disabled={saveState === "saving"}
            aria-label="Switch camera"
          >
            <RefreshCw size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoGallery({
  title,
  subtitle,
  photos,
  uploading,
  uploadError,
  onBack,
  backLabel = "Camera",
  onUploadFiles,
  onFileRef,
  initialShowCameraToken = 0,
  layout = "grid",
  captureIntent = null,
  onCaptureIntentChange,
}: {
  title: string;
  subtitle: string;
  photos: UnifiedPhoto[];
  uploading: boolean;
  uploadError: string;
  onBack: () => void;
  backLabel?: string;
  onUploadFiles: (files: File[], note?: string) => Promise<UploadBatchResult>;
  onFileRef: (ref: HTMLInputElement | null) => void;
  initialShowCameraToken?: number;
  layout?: PhotoGalleryLayout;
  captureIntent?: CaptureIntent | null;
  onCaptureIntentChange?: (intent: CaptureIntent) => void;
}) {
  const [photoView, setPhotoView] = useState<PhotoView>("gallery");
  const [selectedPhoto, setSelectedPhoto] = useState<UnifiedPhoto | null>(null);
  const [compareA, setCompareA] = useState<UnifiedPhoto | null>(null);
  const [compareB, setCompareB] = useState<UnifiedPhoto | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [showCamera, setShowCamera] = useState(initialShowCameraToken > 0);
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("all");
  const [retryBatch, setRetryBatch] = useState<{ files: File[]; note: string; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const visiblePhotos = useMemo(() => (
    photoFilter === "all"
      ? photos
      : photos.filter((photo) => photo.captureIntent === photoFilter)
  ), [photoFilter, photos]);
  const timelineGroups = useMemo(() => {
    const groups = new Map<string, UnifiedPhoto[]>();
    for (const photo of visiblePhotos) {
      const label = photoDayLabel(photo.createdAt);
      groups.set(label, [...(groups.get(label) ?? []), photo]);
    }
    return Array.from(groups.entries());
  }, [visiblePhotos]);

  useEffect(() => {
    onFileRef(fileRef.current);
  }, [onFileRef]);

  async function runUpload(files: File[], note = captureIntentNote(captureIntent)) {
    if (!files.length) return;
    const count = files.length;
    setPendingCount((current) => current + count);
    try {
      return await onUploadFiles(files, note);
    } catch (error) {
      return {
        failedFiles: files,
        message: error instanceof Error ? error.message : `${files.length} photos did not upload.`,
      };
    } finally {
      setPendingCount((current) => Math.max(0, current - count));
    }
  }

  async function handleUpload(files: FileList | null, note = captureIntentNote(captureIntent)) {
    const selectedFiles = files ? Array.from(files) : [];
    const result = await runUpload(selectedFiles, note);
    if (!result) return;
    setRetryBatch(result.failedFiles.length ? { files: result.failedFiles, note, message: result.message } : null);
  }

  async function handleCapturePhoto(blob: Blob) {
    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    const note = captureIntentNote(captureIntent);
    const result = await runUpload([file], note);
    if (result?.failedFiles.length) {
      setRetryBatch({ files: result.failedFiles, note, message: result.message });
      throw new Error(result.message);
    }
    setRetryBatch(null);
  }

  async function retryFailedBatch() {
    if (!retryBatch) return;
    const result = await runUpload(retryBatch.files, retryBatch.note);
    if (!result) return;
    setRetryBatch(result.failedFiles.length
      ? { files: result.failedFiles, note: retryBatch.note, message: result.message }
      : null);
  }

  function startCompare() {
    setCompareA(null);
    setCompareB(null);
    setPhotoView("compare-a");
  }

  function pickForCompare(photo: UnifiedPhoto) {
    if (photoView === "compare-a") {
      setCompareA(photo);
      setPhotoView("compare-b");
      return;
    }
    setCompareB(photo);
    setPhotoView("compare-view");
  }

  if (photoView === "detail" && selectedPhoto) {
    return (
      <div className="v2-job-photos-workbench">
        <div className="v2-job-photos-toolbar">
          <button type="button" onClick={() => { setPhotoView("gallery"); setSelectedPhoto(null); }}>
            <ArrowLeft size={15} />All photos
          </button>
          <div className="v2-job-photos-toolbar-meta">
            <strong>{selectedPhoto.originalName}</strong>
            <small>{new Date(selectedPhoto.createdAt).toLocaleString()} - {fileSize(selectedPhoto.sizeBytes)}</small>
          </div>
          {selectedPhoto.signedUrl ? (
            <a href={selectedPhoto.signedUrl} download={selectedPhoto.originalName} className="v2-btn-secondary" rel="noreferrer">
              <Download size={15} />Download
            </a>
          ) : null}
        </div>
        {selectedPhoto.note ? <p className="v2-job-photo-detail-note">{selectedPhoto.note}</p> : null}
        {selectedPhoto.signedUrl ? (
          <figure className="v2-job-photo-full">
            <img src={selectedPhoto.signedUrl} alt={selectedPhoto.originalName} />
          </figure>
        ) : null}
      </div>
    );
  }

  if (photoView === "compare-a" || photoView === "compare-b") {
    const label = photoView === "compare-a" ? "Pick the before photo" : "Now pick the after photo";
    const excludeId = photoView === "compare-b" ? compareA?.id : undefined;
    return (
      <div className="v2-job-photos-workbench">
        <div className="v2-job-photos-toolbar">
          <button type="button" onClick={() => setPhotoView("gallery")}><ArrowLeft size={15} />Back</button>
          <span className="v2-job-photos-pick-label">{label}</span>
        </div>
        <div className="v2-job-photos-grid">
          {photos.filter((photo) => photo.id !== excludeId).map((photo) => (
            <button key={photo.id} type="button" className="v2-job-photo-thumb" onClick={() => pickForCompare(photo)}>
              {photo.signedUrl ? <img src={photo.signedUrl} alt={photo.originalName} loading="lazy" /> : <span className="v2-job-photo-placeholder"><Camera size={18} /></span>}
              <span className="v2-job-photo-meta"><small>{new Date(photo.createdAt).toLocaleDateString()}</small></span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (photoView === "compare-view" && compareA && compareB) {
    return (
      <div className="v2-job-photos-workbench">
        <div className="v2-job-photos-toolbar">
          <button type="button" onClick={() => setPhotoView("gallery")}><ArrowLeft size={15} />All photos</button>
          <span>Before / after</span>
          <button type="button" onClick={startCompare}><RefreshCw size={14} />New compare</button>
        </div>
        <div className="v2-job-photos-compare-grid">
          {([["Before", compareA], ["After", compareB]] as const).map(([label, photo]) => (
            <figure key={label} className="v2-job-photo-compare-frame">
              <span className="v2-job-photo-compare-label">{label}</span>
              {photo.signedUrl ? <img src={photo.signedUrl} alt={photo.originalName} /> : null}
              <figcaption>{new Date(photo.createdAt).toLocaleDateString()}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="v2-job-photos-workbench">
      {showCamera ? (
        <CameraCapture
          onCapture={handleCapturePhoto}
          onClose={() => setShowCamera(false)}
          contextLabel={title}
          captureIntent={captureIntent}
          onCaptureIntentChange={onCaptureIntentChange}
        />
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        aria-hidden="true"
        onChange={(event) => {
          const files = event.target.files;
          event.target.value = "";
          void handleUpload(files);
        }}
      />

      <div className="v2-job-photos-actions-bar">
        <div className="v2-job-photos-stats">
          <button type="button" className="v2-job-photos-back-link" onClick={onBack}><ArrowLeft size={14} />{backLabel}</button>
          <span className="v2-job-photos-separator">-</span>
          <strong>{visiblePhotos.length}</strong>
          <span>{visiblePhotos.length === 1 ? "photo" : "photos"}</span>
          <span className="v2-job-photos-separator">-</span>
          <span className="v2-job-photos-job-name">{title}</span>
        </div>
        <div className="v2-tool-action-row">
          <button type="button" className="v2-primary-button" onClick={() => setShowCamera(true)}>
            <Camera size={15} />Shoot
          </button>
          <button type="button" className="v2-primary-button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <FileUp size={15} />Upload
          </button>
          {visiblePhotos.length >= 2 ? (
            <button type="button" onClick={startCompare}><Image size={15} />Before / after</button>
          ) : null}
        </div>
      </div>

      {onCaptureIntentChange ? (
        <section className="v2-camera-mode-bar" aria-label="Capture type">
          <div className="v2-camera-mode-copy">
            <strong>Filter field photos</strong>
            <small>New captures are labeled in the camera.</small>
          </div>
          <div className="v2-camera-filter-strip" aria-label="View filter">
            <button
              type="button"
              className={photoFilter === "all" ? "v2-camera-filter-pill is-active" : "v2-camera-filter-pill"}
              onClick={() => setPhotoFilter("all")}
              aria-pressed={photoFilter === "all"}
            >
              All
              <span>{photoFilterCount(photos, "all")}</span>
            </button>
            {CAPTURE_INTENTS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={photoFilter === option.value ? "v2-camera-filter-pill is-active" : "v2-camera-filter-pill"}
                onClick={() => setPhotoFilter(option.value)}
                aria-pressed={photoFilter === option.value}
              >
                {option.shortLabel}
                <span>{photoFilterCount(photos, option.value)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {subtitle ? <p className="v2-job-photos-subtitle">{subtitle}</p> : null}
      {retryBatch ? (
        <div className="v2-record-notice v2-job-photos-upload-error" role="alert">
          <span>{retryBatch.message}</span>
          <button type="button" onClick={() => void retryFailedBatch()} disabled={uploading}>
            <RefreshCw size={15} /> Retry {retryBatch.files.length === 1 ? "photo" : `${retryBatch.files.length} photos`}
          </button>
        </div>
      ) : uploadError ? <p className="v2-record-notice v2-job-photos-upload-error" role="alert">{uploadError}</p> : null}

      {visiblePhotos.length === 0 && pendingCount === 0 ? (
        <div className="v2-job-photos-empty">
          <Camera size={28} />
          <strong>{photoFilter === "all" ? "No photos yet" : `No ${captureIntentLabel(photoFilter)} photos yet`}</strong>
          <p>{photoFilter === "all" ? "Take a photo on site or upload from your device." : "Switch filters or shoot the next proof photo from the field."}</p>
          <div className="v2-tool-action-row">
            <button type="button" className="v2-primary-button" onClick={() => setShowCamera(true)}>
              <Camera size={15} />Take first photo
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <FileUp size={15} />Upload
            </button>
          </div>
        </div>
      ) : layout === "timeline" ? (
        <div className="v2-job-photo-timeline">
          {timelineGroups.map(([dayLabel, dayPhotos], dayIndex) => (
            <section key={`${dayLabel}-${dayIndex}`} className="v2-job-photo-day-group">
              <header className="v2-job-photo-day-header">{dayLabel}</header>
              {dayPhotos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  className="v2-job-photo-timeline-row"
                  onClick={() => {
                    setSelectedPhoto(photo);
                    setPhotoView("detail");
                  }}
                >
                  <span className="v2-job-photo-timeline-index">{index + 1}</span>
                  <span className="v2-job-photo-timeline-thumb">
                    {photo.signedUrl ? <img src={photo.signedUrl} alt={photo.originalName} loading="lazy" /> : <span className="v2-job-photo-placeholder"><Camera size={18} /></span>}
                  </span>
                  <span className="v2-job-photo-timeline-copy">
                    <strong>{captureLabel(photo)}</strong>
                    <small>{relativeTime(photo.createdAt)} - {new Date(photo.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small>
                    <span>{fileSize(photo.sizeBytes)}</span>
                  </span>
                  {photo.captureIntent ? <span className="v2-job-photo-kind-pill">{captureIntentLabel(photo.captureIntent)}</span> : null}
                  <ArrowRight size={15} />
                </button>
              ))}
            </section>
          ))}
          {Array.from({ length: pendingCount }).map((_, index) => (
            <div key={`pending-${index}`} className="v2-job-photo-timeline-row v2-job-photo-pending">
              <span className="v2-job-photo-timeline-index">...</span>
              <span className="v2-job-photo-timeline-thumb v2-job-photo-placeholder"><Loader2 size={18} className="v2-photo-spinner" /></span>
              <span className="v2-job-photo-timeline-copy">
                <strong>Uploading photo</strong>
                <small>Saving to the live timeline</small>
                <span>In progress</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="v2-job-photos-grid">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="v2-job-photo-thumb"
              onClick={() => {
                setSelectedPhoto(photo);
                setPhotoView("detail");
              }}
            >
              {photo.signedUrl ? <img src={photo.signedUrl} alt={photo.originalName} loading="lazy" /> : <span className="v2-job-photo-placeholder"><Camera size={18} /></span>}
              <span className="v2-job-photo-meta">
                <small>{new Date(photo.createdAt).toLocaleDateString()}</small>
              </span>
            </button>
          ))}
          {Array.from({ length: pendingCount }).map((_, index) => (
            <div key={`pending-${index}`} className="v2-job-photo-thumb v2-job-photo-pending">
              <span className="v2-job-photo-placeholder"><Loader2 size={18} className="v2-photo-spinner" /></span>
              <span className="v2-job-photo-meta"><small>Uploading...</small></span>
            </div>
          ))}
        </div>
      )}

      <nav className="v2-camera-gallery-dock" aria-label="Photo actions">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>{backLabel}</span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <FileUp size={18} />
          <span>Upload</span>
        </button>
        <button type="button" className="v2-primary-button" onClick={() => setShowCamera(true)} disabled={uploading}>
          <Camera size={19} />
          <span>Take photo</span>
        </button>
      </nav>
    </div>
  );
}

export function JobPhotosTool({ activeWork, focusedActiveWorkId = null, standaloneProject = null, selectedPrivateAlbum = null, autoOpenActiveJob = false, contextLabel = null, onRequestContext }: {
  activeWork: CanonicalActiveWork[];
  focusedActiveWorkId?: string | null;
  standaloneProject?: StandaloneProject | null;
  selectedPrivateAlbum?: PhotoAlbum | null;
  autoOpenActiveJob?: boolean;
  contextLabel?: string | null;
  onRequestContext?: () => void;
}) {
  const focusedWork = focusedActiveWorkId
    ? activeWork.find((work) => work.id === focusedActiveWorkId) ?? null
    : null;
  const recordWork = focusedWork;
  const recordWorkId = recordWork?.id ?? null;

  const [mode, setMode] = useState<JobPhotosMode>("home");
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [albumsError, setAlbumsError] = useState("");
  const [openAlbum, setOpenAlbum] = useState<AlbumDetail | null>(null);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumUploading, setAlbumUploading] = useState(false);
  const [albumUploadError, setAlbumUploadError] = useState("");
  const albumFileRef = useRef<HTMLInputElement | null>(null);

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(() => Boolean(recordWorkId));
  const [projectError, setProjectError] = useState("");
  const [jobUploading, setJobUploading] = useState(false);
  const [jobUploadError, setJobUploadError] = useState("");
  const jobFileRef = useRef<HTMLInputElement | null>(null);
  const [cameraLaunchToken, setCameraLaunchToken] = useState(0);
  const [captureIntent, setCaptureIntent] = useState<CaptureIntent>("progress");
  const currentProject = project?.activeWorkId === recordWorkId ? project : null;
  const photoNotes = useMemo(() => projectPhotoNotes(currentProject), [currentProject]);
  const autoOpenedActiveJobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!autoOpenActiveJob || !recordWorkId) return;
    if (autoOpenedActiveJobRef.current === recordWorkId) return;
    autoOpenedActiveJobRef.current = recordWorkId;
    setMode("active-job");
  }, [autoOpenActiveJob, recordWorkId]);

  useEffect(() => {
    let cancelled = false;
    void listAlbums()
      .then((items) => {
        if (!cancelled) setAlbums(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setAlbumsError(albumErrorMessage(err));
      })
      .finally(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!recordWorkId) {
      const resetTimer = setTimeout(() => {
        setProject(null);
        setProjectError("");
        setProjectLoading(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    let cancelled = false;
    const startTimer = setTimeout(() => {
      if (cancelled) return;
      setProjectLoading(true);
      setProjectError("");
    }, 0);

    void openProjectForActiveWork(recordWorkId)
      .then((nextProject) => {
        if (!cancelled) setProject(nextProject);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setProject(null);
          setProjectError(projectErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setProjectLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
    };
  }, [recordWorkId]);

  async function openAlbumById(albumId: string) {
    setAlbumLoading(true);
    try {
      const detail = await getAlbum(albumId);
      setOpenAlbum(detail);
      setMode("album-detail");
    } catch (err) {
      setAlbumsError(albumErrorMessage(err));
    } finally {
      setAlbumLoading(false);
    }
  }

  async function openStandaloneProject(options?: { launchCamera?: boolean }) {
    if (!standaloneProject) return;
    setAlbumLoading(true);
    setAlbumsError("");
    try {
      let album = albums.find((item) => item.standaloneProjectId === standaloneProject.id) ?? null;
      if (!album) {
        album = await createAlbum(standaloneProject.title, standaloneProject.id);
        setAlbums((current) => [album!, ...current.filter((item) => item.id !== album!.id)]);
      }
      const detail = await getAlbum(album.id);
      setOpenAlbum(detail);
      if (options?.launchCamera) setCameraLaunchToken((current) => current + 1);
      setMode("album-detail");
    } catch (error) {
      setAlbumsError(albumErrorMessage(error));
    } finally {
      setAlbumLoading(false);
    }
  }

  async function handleAlbumFiles(files: File[], note?: string): Promise<UploadBatchResult> {
    if (!files.length) return { failedFiles: [], message: "" };
    if (!openAlbum) throw new Error("Open an album before adding photos.");
    setAlbumUploading(true);
    setAlbumUploadError("");
    const newPhotos: AlbumPhoto[] = [];
    const failedFiles: File[] = [];
    for (const file of files) {
      try {
        newPhotos.push(await uploadAlbumPhoto(openAlbum.id, file, note ?? ""));
      } catch (err) {
        failedFiles.push(file);
        setAlbumUploadError(albumErrorMessage(err));
      }
    }
    if (newPhotos.length) {
      setOpenAlbum((current) => current ? {
        ...current,
        photoCount: current.photoCount + newPhotos.length,
        photos: [...current.photos, ...newPhotos],
      } : current);
      const newestPhoto = newPhotos.at(-1) ?? null;
      setAlbums((current) => current.map((album) => album.id === openAlbum.id
        ? {
            ...album,
            photoCount: album.photoCount + newPhotos.length,
            updatedAt: newestPhoto?.createdAt ?? new Date().toISOString(),
            coverPhoto: newestPhoto ?? album.coverPhoto,
          }
        : album));
    }
    setAlbumUploading(false);
    if (albumFileRef.current) albumFileRef.current.value = "";
    const message = failedFiles.length
      ? `${failedFiles.length} of ${files.length} didn't upload - retry the failed ${failedFiles.length === 1 ? "photo" : "photos"}.`
      : "";
    if (message) setAlbumUploadError(message);
    return { failedFiles, message };
  }

  async function openActiveJob(options?: { launchCamera?: boolean }) {
    if (!recordWork) return;
    if (options?.launchCamera) setCameraLaunchToken((current) => current + 1);
    if (currentProject && currentProject.activeWorkId === recordWork.id) {
      setMode("active-job");
      return;
    }
    setProjectLoading(true);
    setProjectError("");
    try {
      setProject(await openProjectForActiveWork(recordWork.id));
      setMode("active-job");
    } catch (err) {
      setProjectError(projectErrorMessage(err));
    } finally {
      setProjectLoading(false);
    }
  }

  async function handleJobFiles(files: File[], note?: string): Promise<UploadBatchResult> {
    if (!files.length) return { failedFiles: [], message: "" };
    if (!project) throw new Error("Open the live job project feed before adding photos.");
    setJobUploading(true);
    setJobUploadError("");
    const failedFiles: File[] = [];
    const uploadedMedia: ProjectMedia[] = [];
    const uploadedEntries: ProjectRecord["entries"] = [];
    for (const file of files) {
      try {
        const uploaded = await uploadProjectMedia(project.id, file, note ?? captureIntentNote(captureIntent));
        if (uploaded?.media) uploadedMedia.push(uploaded.media);
        if (uploaded?.entry) uploadedEntries.push(uploaded.entry);
      } catch (err) {
        failedFiles.push(file);
        setJobUploadError(projectErrorMessage(err));
      }
    }
    if (uploadedMedia.length || uploadedEntries.length) {
      setProject((current) => current && current.id === project.id
        ? {
            ...current,
            media: mergeById(uploadedMedia, current.media),
            entries: mergeById(uploadedEntries, current.entries),
            updatedAt: new Date().toISOString(),
          }
        : current);
    }
    try {
      setProject(await getProject(project.id));
    } catch {
      // Best effort refresh after upload.
    }
    setJobUploading(false);
    if (jobFileRef.current) jobFileRef.current.value = "";
    const message = failedFiles.length
      ? `${failedFiles.length} of ${files.length} didn't upload - retry the failed ${failedFiles.length === 1 ? "photo" : "photos"}.`
      : "";
    if (message) setJobUploadError(message);
    return { failedFiles, message };
  }

  if (mode === "active-job" && currentProject) {
    const jobPhotos = newestFirst(
      currentProject.media
        .filter((media) => media.mediaKind === "photo" && media.status !== "removed" && media.signedUrl)
        .map((media) => photoFromProjectMedia(media, photoNotes.get(media.uploadId) ?? "")),
    );
    return (
      <PhotoGallery
        title={recordWork?.job?.title ?? "Active job"}
        subtitle="Live project feed"
        photos={jobPhotos}
        uploading={jobUploading}
        uploadError={jobUploadError}
        onBack={() => setMode("home")}
        backLabel="Camera"
        onUploadFiles={handleJobFiles}
        onFileRef={(ref) => { jobFileRef.current = ref; }}
        initialShowCameraToken={cameraLaunchToken}
        layout="timeline"
        captureIntent={captureIntent}
        onCaptureIntentChange={setCaptureIntent}
      />
    );
  }

  if (mode === "album-detail" && openAlbum) {
    const albumPhotos = newestFirst(openAlbum.photos.map(photoFromAlbumPhoto));
    return (
      <PhotoGallery
        title={openAlbum.name}
        subtitle={openAlbum.standaloneProjectId ? "Standalone project" : "Private album"}
        photos={albumPhotos}
        uploading={albumUploading}
        uploadError={albumUploadError}
        onBack={() => { setMode("home"); setOpenAlbum(null); }}
        backLabel="Camera"
        onUploadFiles={handleAlbumFiles}
        onFileRef={(ref) => { albumFileRef.current = ref; }}
        initialShowCameraToken={cameraLaunchToken}
      />
    );
  }

  const projectPhotos = newestFirst(
    (currentProject?.media ?? [])
      .filter((media) => media.mediaKind === "photo" && media.status !== "removed" && media.signedUrl)
      .map((media) => photoFromProjectMedia(media, photoNotes.get(media.uploadId) ?? "")),
  );
  const recentProjectPhotos = projectPhotos.slice(0, 4);
  const latestProjectPhoto = projectPhotos[0] ?? null;
  const selectedAlbum = selectedPrivateAlbum
    ? albums.find((album) => album.id === selectedPrivateAlbum.id) ?? selectedPrivateAlbum
    : null;
  const standaloneAlbum = standaloneProject
    ? albums.find((album) => album.standaloneProjectId === standaloneProject.id) ?? null
    : null;
  const contextAlbum = selectedAlbum ?? standaloneAlbum;
  const contextPhoto = recordWork ? latestProjectPhoto : contextAlbum ? photoFromAlbumCover(contextAlbum) : null;
  const isScopedWorkContext = Boolean(recordWork || standaloneProject);
  const photoAlbums = albums.filter((album) => !album.standaloneProjectId);
  const recentAlbumCaptures = newestFirst(
    albums.flatMap((album) => {
      const photo = photoFromAlbumCover(album);
      return photo ? [{ album, photo, createdAt: photo.createdAt }] : [];
    }),
  ).slice(0, 4);

  function openAlbumFromHome(album: PhotoAlbum) {
    void openAlbumById(album.id);
  }

  return (
    <div className="v2-job-photos-workbench v2-camera-home">
      {albumsError ? <p className="v2-record-notice v2-job-photos-upload-error" role="alert">{albumsError}</p> : null}

      {recordWork ? (
        <section className="v2-camera-home-panel v2-camera-live-command v2-camera-context-card">
          <div className="v2-job-photos-active-job-info">
            <span className="v2-job-photos-active-badge">Active job</span>
            <h2>{recordWork.job?.title ?? "Accepted work"}</h2>
            <small>
              {recordWork.job?.publicLocation.city ?? "Project"} - {projectPhotos.length} {projectPhotos.length === 1 ? "photo" : "photos"}
            </small>
          </div>
          <p className="v2-camera-live-command-copy">Live job · every capture appears in this workspace.</p>
          {projectError ? <p className="v2-record-notice v2-job-photos-upload-error" role="alert">{projectError}</p> : null}
        </section>
      ) : standaloneProject ? (
        <section className="v2-camera-home-panel v2-camera-live-command v2-camera-context-card">
          <div className="v2-job-photos-active-job-info">
            <span className="v2-job-photos-active-badge">Standalone project</span>
            <h2>{standaloneProject.title}</h2>
            <small>{standaloneProject.clientName || standaloneProject.locationText || "Private off-platform work"} - {standaloneProject.photoCount} {standaloneProject.photoCount === 1 ? "photo" : "photos"}</small>
          </div>
          <p className="v2-camera-live-command-copy">Standalone work · private to your RIVT account.</p>
        </section>
      ) : selectedPrivateAlbum ? (
        <section className="v2-camera-home-panel v2-camera-live-command v2-camera-context-card">
          <div className="v2-job-photos-active-job-info">
            <span className="v2-job-photos-active-badge">Private album</span>
            <h2>{selectedPrivateAlbum.name}</h2>
            <small>{selectedPrivateAlbum.photoCount} {selectedPrivateAlbum.photoCount === 1 ? "photo" : "photos"} - private to you</small>
          </div>
          <p className="v2-camera-live-command-copy">Private capture - separate from RIVT and standalone work.</p>
        </section>
      ) : (
        <section className="v2-camera-home-panel v2-camera-live-command v2-camera-context-card">
          <div className="v2-job-photos-active-job-info">
            <span className="v2-job-photos-active-badge">Capture destination</span>
            <h2>Choose where this proof belongs</h2>
            <small>Accepted job, standalone project, or private album.</small>
          </div>
          <button type="button" className="v2-secondary-button" onClick={onRequestContext}>
            <FolderOpen size={16} />
            Choose destination
          </button>
        </section>
      )}

      {recordWork || contextAlbum ? (
        <section className="v2-camera-home-panel">
          <div className="v2-camera-home-section-head">
            <h3>{recordWork ? "Latest from this job" : "Latest capture"}</h3>
          </div>
          {projectLoading ? (
            <p className="v2-job-photos-loading">Loading the latest field photo...</p>
          ) : contextPhoto?.signedUrl ? (
            <button
              type="button"
              className="v2-camera-home-feature"
              onClick={() => {
                if (recordWork) void openActiveJob();
                else if (contextAlbum) openAlbumFromHome(contextAlbum);
              }}
            >
              <span className="v2-camera-home-feature-image">
                <img src={contextPhoto.signedUrl} alt={contextPhoto.originalName} loading="lazy" />
              </span>
              <span className="v2-camera-home-feature-copy">
                <strong>{captureLabel(contextPhoto)}</strong>
                <small>{relativeTime(contextPhoto.createdAt)} - {new Date(contextPhoto.createdAt).toLocaleString()}</small>
                <span>{fileSize(contextPhoto.sizeBytes)} saved to {recordWork ? "the live record" : "this album"}</span>
              </span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <div className="v2-job-photos-empty v2-camera-home-empty">
              <Image size={28} />
              <strong>{recordWork ? "No photos on this job yet" : "No photos in this album yet"}</strong>
            </div>
          )}
          {recentProjectPhotos.length > 1 ? (
            <div className="v2-camera-home-recent-grid">
              {recentProjectPhotos.slice(1).map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  className="v2-camera-home-recent-card"
                  onClick={() => void openActiveJob()}
                >
                  {photo.signedUrl ? <img src={photo.signedUrl} alt={photo.originalName} loading="lazy" /> : <span className="v2-job-photo-placeholder"><Camera size={18} /></span>}
                  <span className="v2-camera-home-recent-copy">
                    <strong>{captureLabel(photo)}</strong>
                    <small>{relativeTime(photo.createdAt)}</small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {!isScopedWorkContext ? <section className="v2-camera-home-panel v2-camera-albums-panel">
        <div className="v2-camera-home-section-head">
          <div>
            <h3>Private albums</h3>
            <p>Personal captures stay separate from RIVT work.</p>
          </div>
          <span className="v2-camera-album-count">{photoAlbums.length}</span>
        </div>
        {photoAlbums.length ? (
          <div className="v2-camera-album-grid">
            {photoAlbums.map((album) => {
              const cover = photoFromAlbumCover(album);
              return (
                <button
                  key={album.id}
                  type="button"
                  className={album.id === selectedAlbum?.id ? "v2-camera-album-card is-selected" : "v2-camera-album-card"}
                  onClick={() => openAlbumFromHome(album)}
                >
                  <span className="v2-camera-album-cover">
                    {cover?.signedUrl
                      ? <img src={cover.signedUrl} alt={`Latest photo in ${album.name}`} loading="lazy" />
                      : <Camera size={23} aria-hidden="true" />}
                    <span className="v2-camera-album-photo-count">{album.photoCount}</span>
                  </span>
                  <span className="v2-camera-album-copy">
                    <strong>{album.name}</strong>
                    <small>{album.isDefault ? "Default private album" : "Private album"}</small>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="v2-job-photos-empty v2-camera-albums-empty">
            <FolderOpen size={26} />
            <strong>No private albums yet</strong>
            <span>Choose Destination to create one before you capture.</span>
          </div>
        )}
      </section> : null}

      {!isScopedWorkContext && recentAlbumCaptures.length > 1 ? (
        <section className="v2-camera-home-panel v2-camera-latest-panel">
          <div className="v2-camera-home-section-head">
            <h3>Recent captures</h3>
          </div>
          <div className="v2-camera-latest-grid">
            {recentAlbumCaptures.map(({ album, photo }) => (
              <button key={photo.id} type="button" className="v2-camera-latest-card" onClick={() => openAlbumFromHome(album)}>
                {photo.signedUrl ? <img src={photo.signedUrl} alt={photo.originalName} loading="lazy" /> : <span><Camera size={18} /></span>}
                <strong>{album.name}</strong>
                <small>{relativeTime(photo.createdAt)}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="v2-tool-action-dock v2-camera-action-dock" aria-label="Camera actions">
        <span>
          <strong>{contextLabel ?? selectedPrivateAlbum?.name ?? "Choose destination"}</strong>
          <small>{recordWork ? "RIVT workspace" : standaloneProject ? "Standalone project" : selectedPrivateAlbum ? "Private album" : "Never attach a photo by accident"}</small>
        </span>
        <button type="button" onClick={onRequestContext} disabled={projectLoading || albumLoading} aria-label="Destination">
          <FolderOpen size={17} />
          <span>Destination</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (recordWork) void openActiveJob();
            else if (standaloneProject) void openStandaloneProject();
            else if (selectedPrivateAlbum) void openAlbumById(selectedPrivateAlbum.id);
            else onRequestContext?.();
          }}
          disabled={projectLoading || albumLoading}
          aria-label="Open project feed"
          title="Open project feed"
        >
          <Image size={17} />
          <span>Feed</span>
        </button>
        <button
          type="button"
          className="v2-primary-button"
          disabled={projectLoading || albumLoading}
          aria-label="Capture"
          onClick={() => {
            if (recordWork) void openActiveJob({ launchCamera: true });
            else if (standaloneProject) void openStandaloneProject({ launchCamera: true });
            else if (selectedPrivateAlbum) {
              setCameraLaunchToken((current) => current + 1);
              void openAlbumById(selectedPrivateAlbum.id);
            }
            else onRequestContext?.();
          }}
        >
          <Camera size={18} /><span>Capture</span>
        </button>
      </div>
    </div>
  );
}


