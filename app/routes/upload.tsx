import {type FormEvent, useState, useEffect} from 'react'
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import {usePuterStore} from "~/lib/puter";
import {useNavigate} from "react-router";
import {convertPdfToImage} from "~/lib/pdf2img";
import {generateUUID} from "~/lib/utils";
import {prepareInstructions} from "../../constants";

const Upload = () => {
    const { auth, isLoading, fs, ai, kv } = usePuterStore();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);

    // Global error handler
    useEffect(() => {
        const handleGlobalError = (event: ErrorEvent) => {
            console.error('Global error caught:', event.error);
            // Only update UI if we're in the processing state to avoid disrupting normal flow
            if (isProcessing) {
                setStatusText(`Error: Unexpected error occurred. ${event.error?.message || 'Unknown error'}`);
                setIsProcessing(false);
            }
        };

        // Add global error handler
        window.addEventListener('error', handleGlobalError);

        // Cleanup
        return () => {
            window.removeEventListener('error', handleGlobalError);
        };
    }, [isProcessing]);

    const handleFileSelect = (file: File | null) => {
        setFile(file)
    }

    const handleAnalyze = async ({ companyName, jobTitle, jobDescription, file }: { companyName: string, jobTitle: string, jobDescription: string, file: File  }) => {
        setIsProcessing(true);

        // Set a global timeout for the entire operation
        const globalTimeoutId = setTimeout(() => {
            console.error('Global timeout: Analysis operation took too long (5 minutes)');
            setStatusText('Error: The operation timed out after 5 minutes. Please try again.');
            setIsProcessing(false);
        }, 300000); // 5 minutes timeout

        setStatusText('Uploading the file...');
        const uploadedFile = await fs.upload([file]);
        if(!uploadedFile) {
            clearTimeout(globalTimeoutId);
            return setStatusText('Error: Failed to upload file');
        }

        setStatusText('Converting to image...');
        let imageFile;
        try {
            imageFile = await convertPdfToImage(file);
            if(!imageFile.file) {
                const errorMessage = imageFile.error || 'Failed to convert PDF to image';
                console.error('PDF conversion error:', errorMessage);
                clearTimeout(globalTimeoutId);
                return setStatusText(`Error: ${errorMessage}`);
            }
        } catch (error) {
            console.error('Exception during PDF conversion:', error);
            clearTimeout(globalTimeoutId);
            return setStatusText(`Error: ${error instanceof Error ? error.message : 'Failed to convert PDF to image'}`);
        }

        setStatusText('Uploading the image...');
        const uploadedImage = await fs.upload([imageFile.file]);
        if(!uploadedImage) {
            clearTimeout(globalTimeoutId);
            return setStatusText('Error: Failed to upload image');
        }

        setStatusText('Preparing data...');
        console.log('Preparing data for analysis...');
        const uuid = generateUUID();
        console.log('Generated UUID:', uuid);
        const data = {
            id: uuid,
            resumePath: uploadedFile.path,
            imagePath: uploadedImage.path,
            companyName, jobTitle, jobDescription,
            feedback: '',
        }
        console.log('Data object created:', { ...data, resumePath: '(truncated)', imagePath: '(truncated)' });

        try {
            console.log('Storing data in key-value store...');
            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            console.log('Data successfully stored in key-value store');
        } catch (error) {
            console.error('Error storing data in key-value store:', error);
            clearTimeout(globalTimeoutId);
            return setStatusText(`Error: Failed to store data. ${error instanceof Error ? error.message : ''}`);
        }

        setStatusText('Analyzing...');
        console.log('Starting AI analysis of resume...');

        let feedback;
        try {
            console.log('Sending resume to AI for feedback...');
            const instructions = prepareInstructions({ jobTitle, jobDescription });
            console.log('Prepared instructions for AI');

            feedback = await ai.feedback(
                uploadedFile.path,
                instructions
            );

            if (!feedback) {
                console.error('AI feedback returned null or undefined');
                clearTimeout(globalTimeoutId);
                return setStatusText('Error: Failed to analyze resume');
            }
            console.log('Received AI feedback response');
        } catch (error) {
            console.error('Error getting AI feedback:', error);
            clearTimeout(globalTimeoutId);
            return setStatusText(`Error: Failed to analyze resume. ${error instanceof Error ? error.message : ''}`);
        }

        let feedbackText;
        try {
            console.log('Processing AI feedback response...');
            feedbackText = typeof feedback.message.content === 'string'
                ? feedback.message.content
                : feedback.message.content[0].text;

            console.log('Parsing feedback JSON...');
            data.feedback = JSON.parse(feedbackText);
            console.log('Successfully parsed feedback JSON');
        } catch (error) {
            console.error('Error parsing feedback:', error);
            clearTimeout(globalTimeoutId);
            return setStatusText(`Error: Failed to parse feedback. ${error instanceof Error ? error.message : ''}`);
        }

        try {
            console.log('Storing final data with feedback in key-value store...');
            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            console.log('Final data successfully stored in key-value store');
        } catch (error) {
            console.error('Error storing feedback in key-value store:', error);
            clearTimeout(globalTimeoutId);
            return setStatusText(`Error: Failed to store feedback. ${error instanceof Error ? error.message : ''}`);
        }

        // Clear the global timeout as the operation has completed successfully
        clearTimeout(globalTimeoutId);

        setStatusText('Analysis complete, redirecting...');
        console.log('Analysis complete, data:', { ...data, resumePath: '(truncated)', imagePath: '(truncated)', feedback: '(truncated)' });
        console.log('Redirecting to resume page...');

        try {
            navigate(`/resume/${uuid}`);
            console.log('Navigation initiated');
        } catch (error) {
            console.error('Error during navigation:', error);
            setStatusText(`Error: Failed to navigate to results page. ${error instanceof Error ? error.message : ''}`);
        }
    }

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget.closest('form');
        if(!form) return;
        const formData = new FormData(form);

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;

        if(!file) return;

        await handleAnalyze({ companyName, jobTitle, jobDescription, file });
    }

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <Navbar />

            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>Smart feedback for your dream job</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src="/images/resume-scan.gif" className="w-full" alt="Resume scanning animation" />

                        </>
                    ) : (
                        <h2>Drop your resume for an ATS score and improvement tips</h2>
                    )}
                    {!isProcessing && (
                        <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                            <div className="form-div">
                                <label htmlFor="company-name">Company Name</label>
                                <input type="text" name="company-name" placeholder="Company Name" id="company-name" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-title">Job Title</label>
                                <input type="text" name="job-title" placeholder="Job Title" id="job-title" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-description">Job Description</label>
                                <textarea rows={5} name="job-description" placeholder="Job Description" id="job-description" />
                            </div>

                            <div className="form-div">
                                <label htmlFor="uploader">Upload Resume</label>
                                <FileUploader onFileSelect={handleFileSelect} />
                            </div>

                            <button className="primary-button" type="submit">
                                Analyze Resume
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    )
}
export default Upload
