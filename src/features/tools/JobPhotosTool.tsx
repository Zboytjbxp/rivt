import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Download, FileUp, FolderOpen, Image, Loader2, Plus, RefreshCw } from "lucide-react";
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

function captureIntentDescription(intent: CaptureIntent | null) {
  return CAPTURE_INTENTS.find((option) => option.value === intent)?.description ?? "Routine field capture";
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

function CameraCapture({ onCapture, onClose }: {
  onCapture: (blob: Blob) => Promise<void> | void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [captureCount, setCaptureCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [lastSnapUrl, setLastSnapUrl] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const lastSnapRef = useRef<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    void navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
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
      if (lastSnapRef.current) URL.revokeObjectURL(lastSnapRef.current);
    };
  }, []);

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
      setCaptureCount((current) => current + 1);
      setFlash(true);
      setSaving(true);
      setSaveStatus("Saving to live project feed...");
      setTimeout(() => setFlash(false), 200);
      Promise.resolve(onCapture(blob))
        .then(() => setSaveStatus("Saved to live project feed."))
        .catch((err: unknown) => setSaveStatus(projectErrorMessage(err)))
        .finally(() => setSaving(false));
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="v2-camera-overlay">
      {flash ? <div className="v2-camera-flash" aria-hidden="true" /> : null}
      <button type="button" className="v2-camera-close" onClick={onClose}>Done</button>
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
      <div className="v2-camera-controls">
        <button
          type="button"
          className="v2-camera-shutter"
          onClick={shoot}
          disabled={!ready || Boolean(error)}
          aria-label="Take photo"
        />
      </div>
      {lastSnapUrl ? (
        <img
          key={lastSnapUrl}
          src={lastSnapUrl}
          alt="Last photo taken"
          className="v2-camera-last-snap"
        />
      ) : null}
      {captureCount > 0 ? (
        <span className="v2-camera-badge">{captureCount} {captureCount === 1 ? "photo" : "photos"}</span>
      ) : null}
      {saveStatus ? (
        <span className={saving ? "v2-camera-save-status is-saving" : "v2-camera-save-status"} role="status">
          {saving ? <Loader2 size={14} className="v2-photo-spinner" /> : <CheckCircle2 size={14} />}
          {saveStatus}
        </span>
      ) : null}
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
  onUploadFiles: (files: FileList | null, note?: string) => Promise<void>;
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

  async function handleUpload(files: FileList | null, note = captureIntentNote(captureIntent)) {
    if (!files?.length) return;
    const count = files.length;
    setPendingCount((current) => current + count);
    try {
      await onUploadFiles(files, note);
    } finally {
      setPendingCount((current) => Math.max(0, current - count));
    }
  }

  function handleCapturePhoto(blob: Blob) {
    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    return handleUpload(transfer.files);
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
          void handleUpload(files).catch(() => undefined);
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
            <strong>{captureIntentLabel(captureIntent)}</strong>
            <small>{captureIntentDescription(captureIntent)}</small>
          </div>
          <div className="v2-camera-capture-strip">
            {CAPTURE_INTENTS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === captureIntent ? "v2-camera-capture-pill is-active" : "v2-camera-capture-pill"}
                onClick={() => onCaptureIntentChange(option.value)}
                aria-pressed={option.value === captureIntent}
                title={option.description}
              >
                {option.shortLabel}
              </button>
            ))}
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
      {uploadError ? <p className="v2-record-notice v2-job-photos-upload-error" role="alert">{uploadError}</p> : null}

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
    </div>
  );
}

export function JobPhotosTool({ activeWork }: { activeWork: CanonicalActiveWork[] }) {
  const recordWork = activeWork.find((work) => work.status === "active") ?? activeWork[0] ?? null;
  const recordWorkId = recordWork?.id ?? null;

  const [mode, setMode] = useState<JobPhotosMode>("home");
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [albumsError, setAlbumsError] = useState("");
  const [openAlbum, setOpenAlbum] = useState<AlbumDetail | null>(null);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    void listAlbums()
      .then((items) => {
        if (!cancelled) setAlbums(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setAlbumsError(albumErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setAlbumsLoading(false);
      });

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

  async function handleCreateAlbum() {
    const name = newAlbumName.trim();
    if (!name) return;
    setCreatingAlbum(true);
    try {
      const album = await createAlbum(name);
      setAlbums((current) => [album, ...current]);
      setNewAlbumName("");
      setShowNewAlbum(false);
      await openAlbumById(album.id);
    } catch (err) {
      setAlbumsError(albumErrorMessage(err));
    } finally {
      setCreatingAlbum(false);
    }
  }

  async function handleAlbumFiles(files: FileList | null, note?: string) {
    if (!files?.length || !openAlbum) return;
    setAlbumUploading(true);
    setAlbumUploadError("");
    const newPhotos: AlbumPhoto[] = [];
    let failed: unknown = null;
    for (const file of Array.from(files)) {
      try {
        newPhotos.push(await uploadAlbumPhoto(openAlbum.id, file, note ?? ""));
      } catch (err) {
        setAlbumUploadError(albumErrorMessage(err));
        failed = err;
        break;
      }
    }
    if (newPhotos.length) {
      setOpenAlbum((current) => current ? {
        ...current,
        photoCount: current.photoCount + newPhotos.length,
        photos: [...current.photos, ...newPhotos],
      } : current);
    }
    setAlbumUploading(false);
    if (albumFileRef.current) albumFileRef.current.value = "";
    if (failed) throw failed;
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

  async function handleJobFiles(files: FileList | null, note?: string) {
    if (!files?.length || !project) return;
    setJobUploading(true);
    setJobUploadError("");
    let failed: unknown = null;
    for (const file of Array.from(files)) {
      try {
        await uploadProjectMedia(project.id, file, note ?? captureIntentNote(captureIntent));
      } catch (err) {
        setJobUploadError(projectErrorMessage(err));
        failed = err;
        break;
      }
    }
    try {
      setProject(await getProject(project.id));
    } catch {
      // Best effort refresh after upload.
    }
    setJobUploading(false);
    if (jobFileRef.current) jobFileRef.current.value = "";
    if (failed) throw failed;
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
        subtitle="Side work album"
        photos={albumPhotos}
        uploading={albumUploading}
        uploadError={albumUploadError}
        onBack={() => { setMode("home"); setOpenAlbum(null); }}
        backLabel="Camera"
        onUploadFiles={handleAlbumFiles}
        onFileRef={(ref) => { albumFileRef.current = ref; }}
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
  const totalPhotoCount = projectPhotos.length + albums.reduce((sum, album) => sum + album.photoCount, 0);

  return (
    <div className="v2-job-photos-workbench v2-camera-home">
      <section className="v2-camera-home-hero">
        <div className="v2-camera-home-copy">
          <span className="v2-camera-home-kicker">Camera</span>
          <h2>Jobsite camera</h2>
          <p>Shoot live progress fast, keep before-and-after proof tight, and keep side-work albums out of the closeout trail.</p>
        </div>
        <div className="v2-camera-home-summary" aria-label="Camera summary">
          <span>{projectPhotos.length} live</span>
          <span>{albums.length} private album{albums.length === 1 ? "" : "s"}</span>
          <span>{totalPhotoCount} total</span>
        </div>
        <div className="v2-tool-action-row">
          {recordWork ? (
            <>
              <button type="button" className="v2-primary-button" onClick={() => void openActiveJob({ launchCamera: true })} disabled={projectLoading}>
                <Camera size={15} />
                {projectLoading ? "Opening..." : `Shoot ${captureIntentLabel(captureIntent).toLowerCase()}`}
              </button>
              <button type="button" onClick={() => void openActiveJob()} disabled={projectLoading}>
                <FolderOpen size={15} />
                Open project feed
              </button>
            </>
          ) : (
            <button type="button" className="v2-primary-button" onClick={() => setShowNewAlbum(true)}>
              <Plus size={15} />
              New album
            </button>
          )}
        </div>
      </section>

      {showNewAlbum ? (
        <div className="v2-job-photos-new-album v2-camera-home-panel">
          <input
            type="text"
            value={newAlbumName}
            onChange={(event) => setNewAlbumName(event.target.value)}
            placeholder="Album name - e.g. Johnson deck, Main St kitchen reno"
            maxLength={140}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreateAlbum();
              if (event.key === "Escape") {
                setShowNewAlbum(false);
                setNewAlbumName("");
              }
            }}
          />
          <div className="v2-tool-action-row">
            <button type="button" className="v2-primary-button" onClick={() => void handleCreateAlbum()} disabled={creatingAlbum || !newAlbumName.trim()}>
              {creatingAlbum ? "Creating..." : "Create album"}
            </button>
            <button type="button" onClick={() => { setShowNewAlbum(false); setNewAlbumName(""); }}>Cancel</button>
          </div>
        </div>
      ) : null}

      {albumsError ? <p className="v2-record-notice v2-job-photos-upload-error" role="alert">{albumsError}</p> : null}

      <section className="v2-camera-home-panel v2-camera-home-live-card">
        <div className="v2-camera-home-section-head">
          <div>
            <h3>Live jobsite</h3>
            <p>Every live capture lands on the accepted-work feed so the office, closeout, and proof trail stay in one place.</p>
          </div>
        </div>
        {recordWork ? (
          <div className="v2-job-photos-active-job-card">
            <div className="v2-job-photos-active-job-info">
              <span className="v2-job-photos-active-badge">Active job</span>
              <strong>{recordWork.job?.title ?? "Accepted work"}</strong>
              <small>
                {recordWork.job?.publicLocation.city ?? "Project"} - {projectPhotos.length} {projectPhotos.length === 1 ? "photo" : "photos"}
              </small>
            </div>
            <div className="v2-camera-live-intent">
              <div className="v2-camera-live-intent-copy">
                <strong>{captureIntentLabel(captureIntent)}</strong>
                <small>{captureIntentDescription(captureIntent)}</small>
              </div>
              <div className="v2-camera-capture-strip" aria-label="Live job capture mode">
                {CAPTURE_INTENTS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={option.value === captureIntent ? "v2-camera-capture-pill is-active" : "v2-camera-capture-pill"}
                    onClick={() => setCaptureIntent(option.value)}
                    aria-pressed={option.value === captureIntent}
                  >
                    {option.shortLabel}
                  </button>
                ))}
              </div>
            </div>
            <div className="v2-tool-action-row">
              <button
                type="button"
                onClick={() => void openActiveJob()}
                disabled={projectLoading}
              >
                <ArrowRight size={15} />
                Open project feed
              </button>
            </div>
            {projectError ? <p className="v2-record-notice v2-job-photos-upload-error" role="alert">{projectError}</p> : null}
          </div>
        ) : (
          <div className="v2-job-photos-empty v2-camera-home-empty">
            <Camera size={28} />
            <strong>No live job open</strong>
            <p>Albums are still here for side work, showroom photos, and proof that does not belong to an active RIVT record.</p>
          </div>
        )}
      </section>

      {recordWork ? (
        <section className="v2-camera-home-panel">
          <div className="v2-camera-home-section-head">
            <div>
              <h3>Recent live captures</h3>
              <p>The newest field proof on the live project feed, ready to reopen, compare, or keep building on.</p>
            </div>
            <button type="button" onClick={() => void openActiveJob()} disabled={projectLoading}>
              Open full feed
            </button>
          </div>
          {projectLoading ? (
            <p className="v2-job-photos-loading">Loading the latest field photo...</p>
          ) : latestProjectPhoto?.signedUrl ? (
            <button type="button" className="v2-camera-home-feature" onClick={() => void openActiveJob()}>
              <span className="v2-camera-home-feature-image">
                <img src={latestProjectPhoto.signedUrl} alt={latestProjectPhoto.originalName} loading="lazy" />
              </span>
              <span className="v2-camera-home-feature-copy">
                <strong>{captureLabel(latestProjectPhoto)}</strong>
                <small>{relativeTime(latestProjectPhoto.createdAt)} - {new Date(latestProjectPhoto.createdAt).toLocaleString()}</small>
                <span>{fileSize(latestProjectPhoto.sizeBytes)} saved to the live record</span>
              </span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <div className="v2-job-photos-empty v2-camera-home-empty">
              <Image size={28} />
              <strong>No field captures yet</strong>
              <p>Start with the live job camera so the very first photo already belongs to the closeout trail.</p>
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

      <section className="v2-camera-home-panel">
        <div className="v2-camera-home-section-head">
          <div>
            <h3>Private albums</h3>
            <p>Keep side work, showroom shots, and off-platform photos separate from the live project feed.</p>
          </div>
        </div>
        <details className="v2-camera-albums-fold" open={!recordWork}>
          <summary className="v2-camera-albums-summary">
            <span>
              <strong>{albums.length ? `${albums.length} side-work ${albums.length === 1 ? "album" : "albums"}` : "Keep side-work albums separate"}</strong>
              <small>Side work, showroom shots, and off-platform proof</small>
            </span>
            <ArrowRight size={15} />
          </summary>
          <div className="v2-camera-albums-content">
            <div className="v2-tool-action-row">
              <button type="button" className="v2-primary-button" onClick={() => setShowNewAlbum(true)}>
                <Plus size={15} />
                New album
              </button>
            </div>
            {albumsLoading ? (
              <p className="v2-job-photos-loading">Loading albums...</p>
            ) : albums.length === 0 && !showNewAlbum ? (
              <div className="v2-job-photos-empty v2-camera-home-empty">
                <FolderOpen size={28} />
                <strong>No private albums yet</strong>
                <p>Create an album for side jobs, showroom shots, warranty proof, or any photo set that should stay outside the live work timeline.</p>
                <button type="button" className="v2-primary-button" onClick={() => setShowNewAlbum(true)}>
                  <Plus size={15} />Create first album
                </button>
              </div>
            ) : (
              <div className="v2-job-photos-album-list">
                {albums.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    className="v2-job-photos-album-row"
                    onClick={() => void openAlbumById(album.id)}
                    disabled={albumLoading}
                  >
                    <span className="v2-job-photos-album-icon"><Camera size={17} /></span>
                    <span className="v2-job-photos-album-copy">
                      <strong>{album.name}</strong>
                      <small>{album.photoCount} {album.photoCount === 1 ? "photo" : "photos"} - updated {relativeTime(album.updatedAt)}</small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}


