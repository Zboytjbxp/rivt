import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Download, FileUp, Image, Loader2, Plus, RefreshCw } from "lucide-react";
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

function formatNumber(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0";
}

function fileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${formatNumber(sizeBytes / 1024, 1)} KB`;
  return `${formatNumber(sizeBytes / 1024 / 1024, 1)} MB`;
}

function projectErrorMessage(error: unknown) {
  if (error instanceof ProjectApiError) return error.message;
  return error instanceof Error ? error.message : "RIVT could not complete the Records request.";
}
type PhotoView = "gallery" | "detail" | "compare-a" | "compare-b" | "compare-view";
type JobPhotosMode = "albums" | "album-detail" | "active-job";

interface UnifiedPhoto {
  id: string;
  originalName: string;
  sizeBytes: number;
  createdAt: string;
  signedUrl: string | null;
}

function photoFromProjectMedia(m: ProjectMedia): UnifiedPhoto {
  return { id: m.id, originalName: m.originalName, sizeBytes: m.sizeBytes, createdAt: m.createdAt, signedUrl: m.signedUrl ?? null };
}

function photoFromAlbumPhoto(p: AlbumPhoto): UnifiedPhoto {
  return { id: p.id, originalName: p.originalName, sizeBytes: p.sizeBytes, createdAt: p.createdAt, signedUrl: p.signedUrl };
}

function albumErrorMessage(error: unknown) {
  if (error instanceof AlbumApiError) return error.message;
  return error instanceof Error ? error.message : "RIVT could not complete the request.";
}

function CameraCapture({ onCapture, onClose }: {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [captureCount, setCaptureCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [lastSnapUrl, setLastSnapUrl] = useState<string | null>(null);
  const lastSnapRef = useRef<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).then((s) => {
      stream = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    }).catch((err: unknown) => {
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access was denied. Check your browser or app settings."
          : "Camera could not be started."
      );
    });
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (lastSnapRef.current) URL.revokeObjectURL(lastSnapRef.current);
    };
  }, []);

  function shoot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !ready) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (lastSnapRef.current) URL.revokeObjectURL(lastSnapRef.current);
      const url = URL.createObjectURL(blob);
      lastSnapRef.current = url;
      setLastSnapUrl(url);
      onCapture(blob);
      setCaptureCount((n) => n + 1);
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="v2-camera-overlay">
      {flash && <div className="v2-camera-flash" aria-hidden="true" />}
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
          disabled={!ready || !!error}
          aria-label="Take photo"
        />
      </div>
      {lastSnapUrl && (
        <img
          key={lastSnapUrl}
          src={lastSnapUrl}
          alt="Last photo taken"
          className="v2-camera-last-snap"
        />
      )}
      {captureCount > 0 && (
        <span className="v2-camera-badge">{captureCount} {captureCount === 1 ? "photo" : "photos"}</span>
      )}
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
  onUploadFiles,
  onFileRef,
}: {
  title: string;
  subtitle: string;
  photos: UnifiedPhoto[];
  uploading: boolean;
  uploadError: string;
  onBack: () => void;
  onUploadFiles: (files: FileList | null) => Promise<void>;
  onFileRef: (ref: HTMLInputElement | null) => void;
}) {
  const [photoView, setPhotoView] = useState<PhotoView>("gallery");
  const [selectedPhoto, setSelectedPhoto] = useState<UnifiedPhoto | null>(null);
  const [compareA, setCompareA] = useState<UnifiedPhoto | null>(null);
  const [compareB, setCompareB] = useState<UnifiedPhoto | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { onFileRef(fileRef.current); }, [onFileRef]);

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    const count = files.length;
    setPendingCount((prev) => prev + count);
    try {
      await onUploadFiles(files);
    } finally {
      setPendingCount((prev) => Math.max(0, prev - count));
    }
  }

  function handleCapturePhoto(blob: Blob) {
    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    const dt = new DataTransfer();
    dt.items.add(file);
    void handleUpload(dt.files);
  }

  function startCompare() { setCompareA(null); setCompareB(null); setPhotoView("compare-a"); }

  function pickForCompare(photo: UnifiedPhoto) {
    if (photoView === "compare-a") { setCompareA(photo); setPhotoView("compare-b"); }
    else { setCompareB(photo); setPhotoView("compare-view"); }
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
            <small>{new Date(selectedPhoto.createdAt).toLocaleString()} · {fileSize(selectedPhoto.sizeBytes)}</small>
          </div>
          {selectedPhoto.signedUrl ? (
            <a href={selectedPhoto.signedUrl} download={selectedPhoto.originalName} className="v2-btn-secondary" rel="noreferrer">
              <Download size={15} />Download
            </a>
          ) : null}
        </div>
        {selectedPhoto.signedUrl ? (
          <figure className="v2-job-photo-full">
            <img src={selectedPhoto.signedUrl} alt={selectedPhoto.originalName} />
          </figure>
        ) : null}
      </div>
    );
  }

  if (photoView === "compare-a" || photoView === "compare-b") {
    const label = photoView === "compare-a" ? "Pick the Before photo" : "Now pick the After photo";
    const excludeId = photoView === "compare-b" ? compareA?.id : undefined;
    return (
      <div className="v2-job-photos-workbench">
        <div className="v2-job-photos-toolbar">
          <button type="button" onClick={() => setPhotoView("gallery")}><ArrowLeft size={15} />Back</button>
          <span className="v2-job-photos-pick-label">{label}</span>
        </div>
        <div className="v2-job-photos-grid">
          {photos.filter((p) => p.id !== excludeId).map((photo) => (
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
          {([["Before", compareA], ["After", compareB]] as const).map(([lbl, photo]) => (
            <figure key={lbl} className="v2-job-photo-compare-frame">
              <span className="v2-job-photo-compare-label">{lbl}</span>
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
      {showCamera && (
        <CameraCapture
          onCapture={handleCapturePhoto}
          onClose={() => setShowCamera(false)}
        />
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} aria-hidden="true"
        onChange={(e) => { const files = e.target.files; if (e.target) e.target.value = ""; void handleUpload(files); }} />

      <div className="v2-job-photos-actions-bar">
        <div className="v2-job-photos-stats">
          <button type="button" className="v2-job-photos-back-link" onClick={onBack}><ArrowLeft size={14} />Albums</button>
          <span className="v2-job-photos-separator">·</span>
          <strong>{photos.length}</strong>
          <span>{photos.length === 1 ? "photo" : "photos"}</span>
          <span className="v2-job-photos-separator">·</span>
          <span className="v2-job-photos-job-name">{title}</span>
        </div>
        <div className="v2-tool-action-row">
          <button type="button" className="v2-primary-button" onClick={() => setShowCamera(true)}>
            <Camera size={15} />Camera
          </button>
          <button type="button" className="v2-primary-button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <FileUp size={15} />Upload
          </button>
          {photos.length >= 2 ? (
            <button type="button" onClick={startCompare}><Image size={15} />Compare</button>
          ) : null}
        </div>
      </div>

      {subtitle ? <p className="v2-job-photos-subtitle">{subtitle}</p> : null}
      {uploadError ? <p className="v2-record-notice v2-job-photos-upload-error" role="alert">{uploadError}</p> : null}

      {photos.length === 0 && pendingCount === 0 ? (
        <div className="v2-job-photos-empty">
          <Camera size={28} />
          <strong>No photos yet</strong>
          <p>Take a photo on site or upload from your device.</p>
          <div className="v2-tool-action-row">
            <button type="button" className="v2-primary-button" onClick={() => setShowCamera(true)}>
              <Camera size={15} />Take first photo
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <FileUp size={15} />Upload
            </button>
          </div>
        </div>
      ) : (
        <div className="v2-job-photos-grid">
          {photos.map((photo) => (
            <button key={photo.id} type="button" className="v2-job-photo-thumb"
              onClick={() => { setSelectedPhoto(photo); setPhotoView("detail"); }}>
              {photo.signedUrl
                ? <img src={photo.signedUrl} alt={photo.originalName} loading="lazy" />
                : <span className="v2-job-photo-placeholder"><Camera size={18} /></span>}
              <span className="v2-job-photo-meta">
                <small>{new Date(photo.createdAt).toLocaleDateString()}</small>
              </span>
            </button>
          ))}
          {Array.from({ length: pendingCount }).map((_, i) => (
            <div key={`pending-${i}`} className="v2-job-photo-thumb v2-job-photo-pending">
              <span className="v2-job-photo-placeholder"><Loader2 size={18} className="v2-photo-spinner" /></span>
              <span className="v2-job-photo-meta"><small>Uploading…</small></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function JobPhotosTool({ activeWork }: { activeWork: CanonicalActiveWork[] }) {
  const recordWork = activeWork.find((w) => w.status === "active") ?? activeWork[0] ?? null;

  // Albums mode state
  const [mode, setMode] = useState<JobPhotosMode>("albums");
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

  // Active-job mode state
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [jobUploading, setJobUploading] = useState(false);
  const [jobUploadError, setJobUploadError] = useState("");
  const jobFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAlbums()
      .then((items) => { if (!cancelled) setAlbums(items); })
      .catch((err: unknown) => { if (!cancelled) setAlbumsError(albumErrorMessage(err)); })
      .finally(() => { if (!cancelled) setAlbumsLoading(false); });
    return () => { cancelled = true; };
  }, []);

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
      setAlbums((prev) => [album, ...prev]);
      setNewAlbumName("");
      setShowNewAlbum(false);
      await openAlbumById(album.id);
    } catch (err) {
      setAlbumsError(albumErrorMessage(err));
    } finally {
      setCreatingAlbum(false);
    }
  }

  async function handleAlbumFiles(files: FileList | null) {
    if (!files?.length || !openAlbum) return;
    setAlbumUploading(true);
    setAlbumUploadError("");
    const newPhotos: AlbumPhoto[] = [];
    for (const file of Array.from(files)) {
      try {
        newPhotos.push(await uploadAlbumPhoto(openAlbum.id, file));
      } catch (err) {
        setAlbumUploadError(albumErrorMessage(err));
        break;
      }
    }
    if (newPhotos.length) {
      setOpenAlbum((prev) => prev ? {
        ...prev,
        photoCount: prev.photoCount + newPhotos.length,
        photos: [...prev.photos, ...newPhotos],
      } : prev);
    }
    setAlbumUploading(false);
    if (albumFileRef.current) albumFileRef.current.value = "";
  }

  async function openActiveJob() {
    if (!recordWork) return;
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

  async function handleJobFiles(files: FileList | null) {
    if (!files?.length || !project) return;
    setJobUploading(true);
    setJobUploadError("");
    for (const file of Array.from(files)) {
      try {
        await uploadProjectMedia(project.id, file, "");
      } catch (err) {
        setJobUploadError(projectErrorMessage(err));
        break;
      }
    }
    try { setProject(await getProject(project.id)); } catch { /* best-effort */ }
    setJobUploading(false);
    if (jobFileRef.current) jobFileRef.current.value = "";
  }

  // ── Active-job gallery ───────────────────────────────────────────────────
  if (mode === "active-job" && project) {
    const jobPhotos = project.media
      .filter((m) => m.mediaKind === "photo" && m.status !== "removed" && m.signedUrl)
      .map(photoFromProjectMedia);
    return (
      <PhotoGallery
        title={recordWork?.job?.title ?? "Active job"}
        subtitle=""
        photos={jobPhotos}
        uploading={jobUploading}
        uploadError={jobUploadError}
        onBack={() => setMode("albums")}
        onUploadFiles={handleJobFiles}
        onFileRef={(r) => { jobFileRef.current = r; }}
      />
    );
  }

  // ── Album detail gallery ─────────────────────────────────────────────────
  if (mode === "album-detail" && openAlbum) {
    const albumPhotos = openAlbum.photos.map(photoFromAlbumPhoto);
    return (
      <PhotoGallery
        title={openAlbum.name}
        subtitle=""
        photos={albumPhotos}
        uploading={albumUploading}
        uploadError={albumUploadError}
        onBack={() => { setMode("albums"); setOpenAlbum(null); }}
        onUploadFiles={handleAlbumFiles}
        onFileRef={(r) => { albumFileRef.current = r; }}
      />
    );
  }

  // ── Albums list (home screen) ────────────────────────────────────────────
  return (
    <div className="v2-job-photos-workbench">
      <div className="v2-job-photos-albums-header">
        <div>
          <h2 className="v2-job-photos-albums-title">Job Photos</h2>
          <p className="v2-job-photos-albums-sub">Document any job — marketplace or not. Albums are private to your account.</p>
        </div>
        <button type="button" className="v2-primary-button" onClick={() => setShowNewAlbum(true)}>
          <Plus size={15} />New album
        </button>
      </div>

      {showNewAlbum ? (
        <div className="v2-job-photos-new-album">
          <input
            type="text"
            value={newAlbumName}
            onChange={(e) => setNewAlbumName(e.target.value)}
            placeholder="Album name — e.g. Johnson deck, Main St kitchen reno…"
            maxLength={140}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreateAlbum(); if (e.key === "Escape") { setShowNewAlbum(false); setNewAlbumName(""); } }}
          />
          <div className="v2-tool-action-row">
            <button type="button" className="v2-primary-button" onClick={() => void handleCreateAlbum()} disabled={creatingAlbum || !newAlbumName.trim()}>
              {creatingAlbum ? "Creating…" : "Create album"}
            </button>
            <button type="button" onClick={() => { setShowNewAlbum(false); setNewAlbumName(""); }}>Cancel</button>
          </div>
        </div>
      ) : null}

      {albumsError ? <p className="v2-record-notice v2-job-photos-upload-error" role="alert">{albumsError}</p> : null}

      {recordWork ? (
        <div className="v2-job-photos-active-job-card">
          <div className="v2-job-photos-active-job-info">
            <span className="v2-job-photos-active-badge">Active job</span>
            <strong>{recordWork.job?.title ?? "Accepted work"}</strong>
            <small>Photos stored in your private project record</small>
          </div>
          <button
            type="button"
            className="v2-primary-button"
            onClick={() => void openActiveJob()}
            disabled={projectLoading}
          >
            <Camera size={15} />
            {projectLoading ? "Opening…" : "Open"}
          </button>
          {projectError ? <p className="v2-record-notice v2-job-photos-upload-error" role="alert">{projectError}</p> : null}
        </div>
      ) : null}

      {albumsLoading ? (
        <p className="v2-job-photos-loading">Loading albums…</p>
      ) : albums.length === 0 && !showNewAlbum ? (
        <div className="v2-job-photos-empty">
          <Camera size={28} />
          <strong>No albums yet</strong>
          <p>Create an album for any job — even ones you found outside RIVT. Your photos are stored privately on your account.</p>
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
                <small>{album.photoCount} {album.photoCount === 1 ? "photo" : "photos"} · {new Date(album.updatedAt).toLocaleDateString()}</small>
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mileage Logger ───────────────────────────────────────────────────────────

