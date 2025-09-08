export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    isLoading = true;
    try {
        // @ts-expect-error - pdfjs-dist/build/pdf.mjs is not a module
        loadPromise = import("pdfjs-dist/build/pdf.mjs").then((lib) => {
            // Set the worker source to use local file
            lib.GlobalWorkerOptions.workerSrc = new URL("/pdf.worker.min.mjs", window.location.origin).href;
            pdfjsLib = lib;
            isLoading = false;
            return lib;
        }).catch(error => {
            console.error("Failed to load PDF.js library:", error);
            isLoading = false;
            throw error;
        });
    } catch (error) {
        console.error("Error in loadPdfJs:", error);
        isLoading = false;
        throw error;
    }

    return loadPromise;
}

export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    try {
        const lib = await loadPdfJs();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 4 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Failed to get canvas 2D context");
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        try {
            await page.render({ canvasContext: context, viewport }).promise;
        } catch (renderError) {
            console.error("PDF rendering error:", renderError);
            throw new Error(`Failed to render PDF: ${renderError instanceof Error ? renderError.message : String(renderError)}`);
        }

        return new Promise((resolve, reject) => {
            // Add a timeout to prevent hanging
            const timeoutId = setTimeout(() => {
                reject(new Error("Timed out while creating image blob"));
            }, 30000); // 30 seconds timeout

            try {
                canvas.toBlob(
                    (blob) => {
                        clearTimeout(timeoutId); // Clear the timeout

                        if (blob) {
                            try {
                                // Create a File from the blob with the same name as the pdf
                                const originalName = file.name.replace(/\.pdf$/i, "");
                                const imageFile = new File([blob], `${originalName}.png`, {
                                    type: "image/png",
                                });

                                resolve({
                                    imageUrl: URL.createObjectURL(blob),
                                    file: imageFile,
                                });
                            } catch (fileError) {
                                console.error("Error creating File from blob:", fileError);
                                resolve({
                                    imageUrl: "",
                                    file: null,
                                    error: `Error creating File from blob: ${fileError instanceof Error ? fileError.message : String(fileError)}`,
                                });
                            }
                        } else {
                            resolve({
                                imageUrl: "",
                                file: null,
                                error: "Failed to create image blob - blob is null",
                            });
                        }
                    },
                    "image/png",
                    1.0
                ); // Set quality to maximum (1.0)
            } catch (blobError) {
                clearTimeout(timeoutId); // Clear the timeout
                console.error("Error calling toBlob:", blobError);
                resolve({
                    imageUrl: "",
                    file: null,
                    error: `Error calling toBlob: ${blobError instanceof Error ? blobError.message : String(blobError)}`,
                });
            }
        });
    } catch (err) {
        console.error("PDF conversion error:", err);
        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF to image: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
