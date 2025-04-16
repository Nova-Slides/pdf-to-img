import "./polyfill"; // do this before pdfjs

import path from "node:path";
// 🛑 inspite of esModuleInterop being on, you still need to use `import *`, and there are no typedefs
import * as _pdfjs from "pdfjs-dist/legacy/build/pdf";
import type { DocumentInitParameters } from "pdfjs-dist/types/src/display/api";
import { NodeCanvasFactory } from "./canvasFactory";
import { parseInput } from "./parseInput";

const pdfjs: typeof import("pdfjs-dist") = _pdfjs;
const pdfjsPath = path.dirname(require.resolve("pdfjs-dist/package.json"));

/** required since k-yle/pdf-to-img#58, the objects from pdfjs are weirdly structured */
const sanitize = (x: object) => {
  const object: Record<string, string> = JSON.parse(JSON.stringify(x));

  // remove UTF16 BOM and weird 0x0 character introduced in k-yle/pdf-to-img#138 and k-yle/pdf-to-img#184
  for (const key in object) {
    if (typeof object[key] === "string") {
      // eslint-disable-next-line no-control-regex -- this is deliberate
      object[key] = object[key].replaceAll(/(^þÿ|\u0000)/g, "");
    }
  }
  return object;
};

export type PdfMetadata = {
  Title?: string;
  Author?: string;
  // TODO: Subject?
  Producer?: string;
  Creator?: string;
  CreationDate?: string;
  ModDate?: string;
};

export type Options = {
  /** For cases where the PDF is encrypted with a password */
  password?: string;
  /** @deprecated scale is not recommended with maxWidth or maxHeight, as scaling is determined by these values instead */
  scale?: number;
  /** document init parameters which are passed to pdfjs.getDocument */
  docInitParams?: Partial<DocumentInitParameters>;
  /** Maximum width of the output image */
  maxWidth?: number;
  /** Maximum height of the output image */
  maxHeight?: number;
  /** If true, maintain aspect ratio when maxWidth or maxHeight are specified. Defaults to true. */
  maintainAspectRatio?: boolean;
};

/**
 * Converts a PDF to a series of images. This returns a `Symbol.asyncIterator`
 *
 * @param input Either (a) the path to a pdf file, or (b) a data url, or (c) a buffer, or (d) a ReadableStream.
 *
 */
export async function pdf(
  input: string | Buffer | NodeJS.ReadableStream,
  options: Options = {}
): Promise<{
  length: number;
  metadata: PdfMetadata;
  [Symbol.asyncIterator](): AsyncIterator<Buffer, void, void>;
}> {
  if (options.scale && (options.maxWidth || options.maxHeight)) {
    console.warn(
      "pdf-to-img: The 'scale' option is not recommended when 'maxWidth' or 'maxHeight' are specified. Scaling is determined by the max values."
    );
  }

  const data = await parseInput(input);

  const pdfDocument = await pdfjs.getDocument({
    password: options.password, // retain for backward compatibility, but ensure settings from docInitParams overrides this and others, if given.
    standardFontDataUrl: path.join(pdfjsPath, `standard_fonts${path.sep}`),
    cMapUrl: path.join(pdfjsPath, `cmaps${path.sep}`),
    cMapPacked: true,
    isEvalSupported: false,
    ...options.docInitParams,
    data,
  }).promise;

  const metadata = await pdfDocument.getMetadata();

  return {
    length: pdfDocument.numPages,
    metadata: sanitize(metadata.info),
    [Symbol.asyncIterator]() {
      return {
        pg: 0,
        async next(this: { pg: number }) {
          if (this.pg < pdfDocument.numPages) {
            this.pg += 1;
            const page = await pdfDocument.getPage(this.pg);
            let viewport = page.getViewport({ scale: options.scale ?? 1 });

            let targetWidth = options.maxWidth ?? viewport.width;
            let targetHeight = options.maxHeight ?? viewport.height;

            if (options.maintainAspectRatio) {
              let scaleX = targetWidth / viewport.width;
              let scaleY = targetHeight / viewport.height;
              let scale = Math.min(scaleX, scaleY);

              viewport = page.getViewport({ scale: scale });
            } else {
              // Maintain the scale, but set the canvas dimensions to be what the target is to prevent ratio issues

              let scaleX = targetWidth / viewport.width;
              let scaleY = targetHeight / viewport.height;

              viewport = page.getViewport({ scale: Math.min(scaleX, scaleY) });
            }

            const canvasFactory = new NodeCanvasFactory();
            const { canvas, context } = canvasFactory.create(
              Math.round(viewport.width),
              Math.round(viewport.height)
            );

            await page.render({
              canvasContext: context,
              viewport,
              canvasFactory,
            }).promise;

            return { done: false, value: canvas.toBuffer() };
          }
          return { done: true, value: undefined };
        },
      };
    },
  };
}
