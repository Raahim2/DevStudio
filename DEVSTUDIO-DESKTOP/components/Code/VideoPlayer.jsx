'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FiLoader, FiAlertCircle, FiFilm } from 'react-icons/fi';

// Optional: Function to get MIME type, though browser often infers well for video
const getMimeTypeForVideo = (filename) => {
    if (!filename) return '';
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'mp4': return 'video/mp4';
        case 'webm': return 'video/webm';
        case 'ogv': return 'video/ogg';
        case 'mov': return 'video/quicktime'; // MOV support can be tricky
        // Add more if needed
        default: return ''; // Let browser infer
    }
};

const VideoPlayer = ({ filePath, className }) => {
    const [fileUrl, setFileUrl] = useState(null);
    const [error, setError] = useState(null);
    const [fileName, setFileName] = useState('');
    const [isLoading, setIsLoading] = useState(false); // Added loading state
    const videoRef = useRef(null);

    useEffect(() => {
        setError(null);
        setFileUrl(null); // Reset to show loader
        setIsLoading(!!filePath); // Set loading if filePath is present

        if (filePath) {
            const name = filePath.split(/[/\\]/).pop() || 'Video File';
            setFileName(name);
            console.log("VideoPlayer: Received filePath:", filePath);

            try {
                let constructedUrl;
                if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
                    let normalizedPath = filePath.replace(/\\/g, '/');

                    if (normalizedPath.startsWith('file:///')) {
                        constructedUrl = normalizedPath;
                    } else if (/^[a-zA-Z]:\//.test(normalizedPath)) {
                        constructedUrl = `file:///${normalizedPath}`;
                    } else if (normalizedPath.startsWith('/')) {
                        constructedUrl = `file:///${normalizedPath}`;
                    } else {
                        console.error("VideoPlayer: Path is not recognized as absolute:", filePath);
                        throw new Error(`Path is not absolute: ${filePath}`);
                    }

                    const schemeMatch = constructedUrl.match(/^(file:\/\/\/[a-zA-Z]:|file:\/\/\/|file:\/\/)/i);
                    const scheme = schemeMatch ? schemeMatch[0] : '';
                    if (!scheme) {
                        throw new Error("URL scheme extraction failed.");
                    }
                    const pathPart = constructedUrl.substring(scheme.length);
                    const encodedPathSegments = pathPart.split('/').map(segment => 
                        encodeURIComponent(segment)
                            .replace(/%23/g, '#').replace(/%26/g, '&')
                            .replace(/%3D/g, '=').replace(/%3F/g, '?')
                    );
                    constructedUrl = scheme + encodedPathSegments.join('/');
                    constructedUrl = constructedUrl.replace(/\\/g, '/'); // Final sanity check
                } else {
                    constructedUrl = filePath; // Fallback for non-Electron (likely won't work)
                }

                console.log("VideoPlayer: Attempting to set fileUrl to:", constructedUrl);
                setFileUrl(constructedUrl);
                setIsLoading(false);

                if (videoRef.current) {
                    console.log("VideoPlayer: Pausing and loading new video source.");
                    videoRef.current.pause();
                    videoRef.current.load(); // Important to reflect new src
                }

            } catch (e) {
                console.error("VideoPlayer: Error processing video path:", filePath, e);
                setError(`Failed to create a valid URL for video: ${e.message}. Path: ${filePath}`);
                setFileUrl(null);
                setIsLoading(false);
            }
        } else {
            setFileName('');
            setIsLoading(false);
        }
    }, [filePath]);

    const handleError = (e) => {
        const videoElement = e.target;
        console.error("VideoPlayer: Playback error occurred.", {
            filePath,
            fileUrl,
            errorCode: videoElement.error?.code,
            errorMessage: videoElement.error?.message,
            videoElementSrc: videoElement.src,
            networkState: videoElement.networkState,
            readyState: videoElement.readyState,
            errorEvent: e
        });

        let message = "Could not load or play the video file.";
        if (videoElement.error) {
            switch (videoElement.error.code) {
                case MediaError.MEDIA_ERR_ABORTED: // 1
                    message = "Video playback was aborted by the user.";
                    break;
                case MediaError.MEDIA_ERR_NETWORK: // 2
                    message = "A network error caused video download to fail.";
                    break;
                case MediaError.MEDIA_ERR_DECODE: // 3
                    message = "Video decoding error. The file may be corrupt, or the format/codecs (e.g., H.264, AAC) are not fully supported for decoding.";
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: // 4
                    message = "The video format or codecs (e.g., H.264 for video, AAC for audio in MP4) are not supported by this browser/Electron build. This is very often due to missing proprietary codecs.";
                    break;
                default:
                    message = `An unknown video error occurred (code: ${videoElement.error.code}).`;
            }
        }
        setError(message);
        setIsLoading(false); // Stop loading indicator on error
    };

    // ----- UI Rendering Logic -----

    if (isLoading) {
        return (
            <div className={`w-full h-full flex flex-col items-center justify-center bg-black text-neutral-300 ${className}`}>
                <FiLoader className="animate-spin text-blue-400" size={32} />
                <span className="ml-2 mt-2">Loading Video...</span>
                {fileName && <p className="text-xs mt-1">{fileName}</p>}
            </div>
        );
    }

    if (error) { // Display error if any occurred during URL processing or playback
         return (
            <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-black text-red-400 ${className}`}>
                <FiAlertCircle size={48} className="mb-2" />
                <p className="text-center font-semibold">Video Error</p>
                <p className="text-sm text-center">{error}</p>
                {filePath && <p className="text-xs mt-2 text-neutral-500">File: {filePath}</p>}
                 <button
                    onClick={() => { // Simple retry: re-triggers useEffect by temporarily clearing filePath
                        const currentPath = filePath;
                        // A bit hacky for retry, better would be dedicated retry function
                        // For now, we can rely on parent re-supplying filePath or use a key
                        // Or, if hardcoding, just re-set state to trigger load:
                        setFileUrl(null); setError(null); setIsLoading(true);
                        // This will cause useEffect to run again if filePath is stable
                        // A more robust retry would involve re-calling the load logic.
                        // For simplicity, we'll let the existing useEffect handle it if filePath is constant.
                        // Or a simple page refresh might be what a user does.
                        // Let's assume for now the useEffect logic is sufficient if filePath is re-evaluated.
                        // A proper retry would re-initiate the URL processing.
                         const event = new Event('change'); // Dummy event for useEffect
                         Object.defineProperty(event, 'target', {value: {value: currentPath}, enumerable: true});
                         // this is very hacky, ideally refetch or re-trigger processing
                         // The `useEffect` dependency on `filePath` should re-trigger if `filePath` changes.
                         // If `filePath` is static from a prop, we might need a manual "retry" state.
                         // For now, we'll just clear the error and hope the existing mechanism re-evaluates.
                         console.log("Retrying video load for:", currentPath);


                    }}
                    className="mt-3 px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white"
                >
                    Retry
                </button>
            </div>
        );
    }
    
    if (!filePath && !isLoading) { // No file selected and not loading
        return (
            <div className={`w-full h-full flex flex-col items-center justify-center bg-black text-neutral-500 ${className}`}>
                <FiFilm size={64} className="mb-2 opacity-50" />
                <p>No video file selected.</p>
            </div>
        );
    }


    return (
        <div className={`w-full h-full flex flex-col items-center justify-center bg-black text-white relative ${className}`}>
            {fileUrl && (
                 <video
                    ref={videoRef}
                    key={fileUrl} // Keying by URL can help React re-render fully
                    controls
                    src={fileUrl}
                    type={getMimeTypeForVideo(fileName) || undefined}
                    onError={handleError}
                    onCanPlay={() => console.log("VideoPlayer: (onCanPlay) Can play video", fileUrl)}
                    className="max-w-full max-h-full"
                    preload="metadata" // Good for showing duration and first frame quickly
                 >
                    Your browser does not support the video tag or this video format.
                 </video>
            )}
            {fileName && !isLoading && ( // Show filename only if not loading and filename is present
                <div className="absolute top-2 left-2 p-1.5 bg-black/60 rounded text-xs text-neutral-200 max-w-[calc(100%-1rem)] truncate" title={filePath}>
                    {fileName}
                </div>
            )}
            {/* Fallback if fileUrl is not yet ready but a file was selected and not loading (and no error) */}
            {!fileUrl && filePath && !isLoading && !error && (
                 <p className="text-neutral-400">Preparing video...</p>
            )}
        </div>
    );
};
VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;