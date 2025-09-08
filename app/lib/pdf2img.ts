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
            try {
                // Set the worker source to use local file with multiple fallback options
                const workerSrc = new URL("/pdf.worker.min.mjs", window.location.origin).href;
                console.log("Setting PDF.js worker source to:", workerSrc);
                lib.GlobalWorkerOptions.workerSrc = workerSrc;
                pdfjsLib = lib;
                isLoading = false;
                return lib;
            } catch (workerError) {
                console.error("Error setting worker source:", workerError);
                // Try alternative worker source as fallback
                try {
                    const altWorkerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
                    console.log("Trying alternative worker source:", altWorkerSrc);
                    lib.GlobalWorkerOptions.workerSrc = altWorkerSrc;
                    pdfjsLib = lib;
                    isLoading = false;
                    return lib;
                } catch (altError) {
                    console.error("Error setting alternative worker source:", altError);
                    throw altError;
                }
            }
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
        console.log("Starting PDF to image conversion for file:", file.name);

        // Check if file is valid
        if (!file || file.size === 0) {
            console.error("Invalid file provided for conversion");
            return {
                imageUrl: "",
                file: null,
                error: "Invalid file provided for conversion"
            };
        }

        // Check if file is a PDF
        if (!file.type.includes('pdf')) {
            console.error("File is not a PDF:", file.type);
            return {
                imageUrl: "",
                file: null,
                error: "File is not a PDF"
            };
        }

        console.log("Loading PDF.js library...");
        const lib = await loadPdfJs();
        console.log("PDF.js library loaded successfully");

        console.log("Reading file data...");
        const arrayBuffer = await file.arrayBuffer();
        console.log("File data read successfully, size:", arrayBuffer.byteLength);

        console.log("Loading PDF document...");
        const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
        console.log("PDF document loaded successfully, pages:", pdf.numPages);

        console.log("Getting first page...");
        const page = await pdf.getPage(1);
        console.log("First page retrieved successfully");

        const viewport = page.getViewport({ scale: 4 });
        console.log("Viewport created with dimensions:", viewport.width, "x", viewport.height);

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
            console.error("Failed to get canvas 2D context");
            throw new Error("Failed to get canvas 2D context");
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        console.log("Rendering PDF page to canvas...");
        try {
            await page.render({ canvasContext: context, viewport }).promise;
            console.log("PDF page rendered successfully");
        } catch (renderError) {
            console.error("PDF rendering error:", renderError);
            throw new Error(`Failed to render PDF: ${renderError instanceof Error ? renderError.message : String(renderError)}`);
        }

        console.log("Converting canvas to image blob...");
        return new Promise((resolve, reject) => {
            // Add a timeout to prevent hanging
            const timeoutId = setTimeout(() => {
                console.error("Timed out while creating image blob");
                reject(new Error("Timed out while creating image blob"));
            }, 30000); // 30 seconds timeout

            try {
                // Try using toDataURL as a fallback if toBlob fails
                const tryWithDataURL = () => {
                    try {
                        console.log("Attempting to use toDataURL as fallback...");
                        const dataUrl = canvas.toDataURL('image/png');

                        // Convert data URL to blob
                        const byteString = atob(dataUrl.split(',')[1]);
                        const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
                        const ab = new ArrayBuffer(byteString.length);
                        const ia = new Uint8Array(ab);

                        for (let i = 0; i < byteString.length; i++) {
                            ia[i] = byteString.charCodeAt(i);
                        }

                        const blob = new Blob([ab], {type: mimeString});
                        console.log("Successfully created blob from dataURL");

                        // Create a File from the blob with the same name as the pdf
                        const originalName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File([blob], `${originalName}.png`, {
                            type: "image/png",
                        });

                        clearTimeout(timeoutId);
                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } catch (dataUrlError) {
                        console.error("Error using toDataURL fallback:", dataUrlError);
                        clearTimeout(timeoutId);
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: `Failed to create image using toDataURL: ${dataUrlError instanceof Error ? dataUrlError.message : String(dataUrlError)}`,
                        });
                    }
                };

                // First try with toBlob
                canvas.toBlob(
                    (blob) => {
                        clearTimeout(timeoutId); // Clear the timeout

                        if (blob) {
                            console.log("Successfully created blob, size:", blob.size);
                            try {
                                // Create a File from the blob with the same name as the pdf
                                const originalName = file.name.replace(/\.pdf$/i, "");
                                const imageFile = new File([blob], `${originalName}.png`, {
                                    type: "image/png",
                                });
                                console.log("Successfully created File from blob");

                                resolve({
                                    imageUrl: URL.createObjectURL(blob),
                                    file: imageFile,
                                });
                            } catch (fileError) {
                                console.error("Error creating File from blob:", fileError);
                                // Try with dataURL as fallback
                                tryWithDataURL();
                            }
                        } else {
                            console.error("Blob is null, trying dataURL fallback");
                            tryWithDataURL();
                        }
                    },
                    "image/png",
                    1.0
                ); // Set quality to maximum (1.0)
            } catch (blobError) {
                console.error("Error calling toBlob:", blobError);
                // Try with dataURL as fallback
                tryWithDataURL();
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
