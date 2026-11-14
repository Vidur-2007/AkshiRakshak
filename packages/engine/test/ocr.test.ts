/**
 * OCR with a mocked tesseract.js and mocked image APIs (no browser, no network).
 */
import { AnalysisResultSchema, OcrResultSchema } from '@akshi/contracts';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const recognize = vi.fn();
const reinitialize = vi.fn();
const createWorker = vi.fn();
vi.mock('tesseract.js', () => ({ createWorker: (...a: unknown[]) => createWorker(...a) }));

const { buildOcrResult, downscaleSize, ocrImage, terminateOcr } = await import('../src/browser');
const { ocrPaths, tessLangs } = await import('../src/ocr/worker');
const { analyze } = await import('../src/index');

const WORDS = [
  'ప్రియమైన',
  'వినియోగదారుడా,',
  'మీ',
  'కరెంట్',
  'కనెక్షన్',
  'నిలిపివేయబడుతుంది.',
  'వెంటనే',
  '98765',
  '00002',
  'కు',
  'కాల్',
  'చేయండి.',
];
const page = {
  confidence: 83.6,
  text: WORDS.join(' '),
  blocks: [
    {
      paragraphs: [
        {
          lines: [WORDS.slice(0, 6), WORDS.slice(6)].map((ws, li) => ({
            words: ws.map((text, i) => ({
              text,
              bbox: { x0: i * 120, y0: li * 60, x1: i * 120 + 100, y1: li * 60 + 44 },
            })),
          })),
        },
      ],
    },
  ],
};

beforeEach(() => {
  recognize.mockReset().mockResolvedValue({ data: page });
  reinitialize.mockReset().mockResolvedValue({});
  createWorker
    .mockReset()
    .mockImplementation(
      async (_langs: string[], _oem: number, opts: { logger: (m: unknown) => void }) => {
        opts.logger({ status: 'loading language traineddata', progress: 1 });
        opts.logger({ status: 'recognizing text', progress: 0.5 });
        return { recognize, reinitialize, terminate: vi.fn() };
      },
    );
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 3200, height: 1800, close: vi.fn() })),
  );
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext() {
        return { drawImage: vi.fn() };
      }
      async convertToBlob() {
        return new Blob(['png'], { type: 'image/png' });
      }
    },
  );
});
afterAll(() => vi.unstubAllGlobals());

describe('OCR helpers', () => {
  it('downscales only images wider than 1600 px', () => {
    expect(downscaleSize(3200, 1800)).toEqual({ width: 1600, height: 900, scaled: true });
    expect(downscaleSize(1080, 2400)).toEqual({ width: 1080, height: 2400, scaled: false });
  });

  it('maps UI languages to tesseract codes and always adds English', () => {
    expect(tessLangs(['te'])).toEqual(['tel', 'eng']);
    expect(tessLangs(['hi', 'bn', 'en'])).toEqual(['hin', 'ben', 'eng']);
  });

  it('uses self-hosted paths under /engine-assets', () => {
    expect(ocrPaths()).toEqual({
      workerPath: '/engine-assets/tesseract/worker.min.js',
      corePath: '/engine-assets/tesseract',
      langPath: '/engine-assets/tessdata',
    });
  });

  it('builds normalised text with exact word offsets', () => {
    const r = OcrResultSchema.parse(buildOcrResult(page, 1600, 900, ['te']));
    expect(r.text).toBe(WORDS.join(' '));
    for (const b of r.boxes) expect(r.text.slice(b.start, b.end)).toBe(b.text);
    expect(r.boxes[1]).toMatchObject({ x: 120, y: 0, w: 100, h: 44 });
    expect(r.confidence).toBe(84);
  });

  it('normalises words (zero-width characters, native digits) while keeping offsets', () => {
    const zwnj = String.fromCodePoint(0x200c);
    const r = buildOcrResult(
      {
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  {
                    words: [
                      { text: `నంబర్${zwnj}లో`, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
                      { text: '౯౮౭౬౫', bbox: { x0: 2, y0: 0, x1: 3, y1: 1 } },
                      { text: zwnj, bbox: { x0: 4, y0: 0, x1: 5, y1: 1 } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      10,
      10,
      ['te'],
    );
    expect(r.text).toBe('నంబర్లో 98765');
    expect(r.boxes).toHaveLength(2);
  });
});

describe('ocrImage', () => {
  it('runs tesseract with self-hosted files, LSTM-only, gzip, and reports progress', async () => {
    const progress: number[] = [];
    const r = await ocrImage(new Blob(['img']), ['te'], (p) => progress.push(p));
    expect(createWorker).toHaveBeenCalledWith(
      ['tel', 'eng'],
      1,
      expect.objectContaining({ ...ocrPaths(), gzip: true, workerBlobURL: false }),
    );
    expect(r.width).toBe(1600); // downscaled from 3200
    expect(r.height).toBe(900);
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(1);
    expect(progress.some((p) => p > 0 && p < 1)).toBe(true);
    expect(recognize).toHaveBeenCalledWith(expect.any(Blob), {}, { text: true, blocks: true });
  });

  it('reuses the worker and reinitialises it for other languages', async () => {
    await terminateOcr();
    await ocrImage(new Blob(['a']), ['hi']);
    await ocrImage(new Blob(['b']), ['hi']);
    expect(createWorker).toHaveBeenCalledTimes(1);
    await ocrImage(new Blob(['c']), ['bn']);
    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(reinitialize).toHaveBeenCalledWith('ben+eng', 1);
  });

  it('feeds analyze(): boxes get the ids of the signals that overlap them', async () => {
    const ocr = await ocrImage(new Blob(['img']), ['te']);
    const r = AnalysisResultSchema.parse(
      await analyze({
        kind: 'image',
        ocr,
        lang: 'te',
        options: { expandLinks: false, domainAge: false },
      }),
    );
    expect(r.image?.boxes).toHaveLength(WORDS.length);
    const flagged = r.image!.boxes.filter((b) => b.signalIds.length);
    expect(flagged.map((b) => b.text)).toEqual(
      expect.arrayContaining(['నిలిపివేయబడుతుంది.', 'వెంటనే', 'కాల్']),
    );
    expect(r.image!.boxes.find((b) => b.text === 'వెంటనే')?.signalIds).toContain('URGENCY');
  });
});
