import { CameraOff, Flashlight, FlashlightOff, ImageUp, LoaderCircle } from 'lucide-react';
import { m } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
  cameraErrorKind,
  cameraSupported,
  decodeImageFile,
  decodeVideoFrame,
  setTorch,
  torchSupported,
  type CameraError,
} from '@/lib/qr';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

const FRAME_MS = 180;

type CamState =
  | { kind: 'starting' }
  | { kind: 'live'; torch: boolean; torchOn: boolean }
  | { kind: 'error'; error: CameraError };

/** Corner brackets that close in once around the scan area (only ShieldCore loops, §3.3). */
function Brackets() {
  const corner = 'absolute size-10 border-brand';
  return (
    <m.div
      aria-hidden
      className="pointer-events-none absolute inset-[12%]"
      initial={{ opacity: 0, scale: 1.12 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.ui}
    >
      <span className={cn(corner, 'top-0 left-0 rounded-tl-xl border-t-4 border-l-4')} />
      <span className={cn(corner, 'top-0 right-0 rounded-tr-xl border-t-4 border-r-4')} />
      <span className={cn(corner, 'bottom-0 left-0 rounded-bl-xl border-b-4 border-l-4')} />
      <span className={cn(corner, 'right-0 bottom-0 rounded-br-xl border-r-4 border-b-4')} />
    </m.div>
  );
}

/**
 * Camera QR scanner (§5.6): rear camera, BarcodeDetector or jsQR in a worker, torch
 * when the camera has one, and an upload alternative that always works.
 */
export function QRScannerSheet({
  open,
  onOpenChange,
  onDecoded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecoded: (payload: string) => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState<CamState>({ kind: 'starting' });
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [decodingFile, setDecodingFile] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  const done = useCallback(
    (payload: string) => {
      stop();
      navigator.vibrate?.(20);
      onDecoded(payload);
      onOpenChange(false);
    },
    [stop, onDecoded, onOpenChange],
  );

  // Start the camera while the sheet is open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setUploadMsg(null);
    if (!cameraSupported()) {
      setCam({ kind: 'error', error: 'unsupported' });
      return;
    }
    setCam({ kind: 'starting' });
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false,
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setCam({ kind: 'live', torch: torchSupported(stream.getVideoTracks()[0]), torchOn: false });
      })
      .catch(
        (err: unknown) => !cancelled && setCam({ kind: 'error', error: cameraErrorKind(err) }),
      );
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, stop]);

  // Scan frames while live
  useEffect(() => {
    if (cam.kind !== 'live') return;
    let alive = true;
    let timer = 0;
    const loop = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!alive || !video || !canvas) return;
      const hit = await decodeVideoFrame(video, canvas).catch(() => null);
      if (!alive) return;
      if (hit) done(hit);
      else timer = window.setTimeout(() => void loop(), FRAME_MS);
    };
    void loop();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [cam.kind, done]);

  const toggleTorch = async () => {
    if (cam.kind !== 'live') return;
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && (await setTorch(track, !cam.torchOn))) setCam({ ...cam, torchOn: !cam.torchOn });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setDecodingFile(true);
    setUploadMsg(null);
    try {
      const hit = await decodeImageFile(file);
      if (hit) done(hit);
      else setUploadMsg(t('qr.notFound'));
    } catch {
      setUploadMsg(t('qr.notFound'));
    } finally {
      setDecodingFile(false);
    }
  };

  const errorText =
    cam.kind === 'error'
      ? cam.error === 'denied'
        ? t('qr.denied')
        : cam.error === 'no-camera'
          ? t('qr.noCamera')
          : t('qr.unsupported')
      : null;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) stop();
        onOpenChange(o);
      }}
    >
      <SheetContent
        side="bottom"
        closeLabel={t('shell.close')}
        className="mx-auto max-w-lg sm:mb-6 sm:rounded-sheet sm:border"
      >
        <SheetTitle className="pr-10">{t('qr.title')}</SheetTitle>
        <SheetDescription>{t('qr.hint')}</SheetDescription>

        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-card bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className={cn('size-full object-cover', cam.kind !== 'live' && 'opacity-0')}
          />
          <canvas ref={canvasRef} className="hidden" />
          {cam.kind === 'live' && <Brackets />}
          {cam.kind === 'starting' && (
            <div className="absolute inset-0 grid place-items-center text-sm text-text-2">
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                {t('qr.starting')}
              </span>
            </div>
          )}
          {errorText && (
            <div
              role="alert"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
            >
              <CameraOff className="size-8 text-text-2" aria-hidden />
              <p className="text-sm text-text">{errorText}</p>
            </div>
          )}
          {cam.kind === 'live' && cam.torch && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              aria-pressed={cam.torchOn}
              className="absolute right-3 bottom-3 inline-flex size-tap items-center justify-center rounded-full bg-black/60 text-white outline-none focus-visible:outline-2 focus-visible:outline-brand"
              aria-label={cam.torchOn ? t('qr.torchOff') : t('qr.torchOn')}
            >
              {cam.torchOn ? (
                <FlashlightOff className="size-5" aria-hidden />
              ) : (
                <Flashlight className="size-5" aria-hidden />
              )}
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          aria-label={t('qr.upload')}
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={decodingFile}
          className={buttonVariants({
            variant: errorText ? 'default' : 'outline',
            size: 'lg',
            className: 'w-full',
          })}
        >
          {decodingFile ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <ImageUp aria-hidden />
          )}
          {t('qr.upload')}
        </button>
        {uploadMsg && (
          <p role="status" className="text-center text-sm text-text-2">
            {uploadMsg}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
