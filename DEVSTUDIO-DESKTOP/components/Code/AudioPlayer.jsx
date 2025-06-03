'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FiLoader, FiAlertCircle, FiMusic } from 'react-icons/fi';

const getMimeType = (filename) => {
    if (!filename) return '';
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'mp3': return 'audio/mpeg';
        case 'wav': return 'audio/wav';
        case 'ogg': return 'audio/ogg';
        case 'aac': return 'audio/aac';
        case 'flac': return 'audio/flac';
        case 'm4a': return 'audio/mp4'; // M4A is often an MP4 container with AAC audio
        default: return '';
    }
};

// --- TEMPORARY HARDCODED PATH FOR TESTING ---
const HARDCODED_TEST_FILE_PATH = "D:\\Raahim\\DEMO FOR PROJECTS\\gta.mp3";
// const HARDCODED_TEST_FILE_PATH = null; // Set to null to use propFilePath
// --- END TEMPORARY HARDCODED PATH ---


const AudioPlayer = ({ filePath: propFilePath, className }) => {
    const [fileUrl, setFileUrl] = useState(null);
    const [error, setError] = useState(null);
    const [fileName, setFileName] = useState('');
    const [mimeType, setMimeType] = useState('');
    const [isLoading, setIsLoading] = useState(false); // Added loading state
    const audioRef = useRef(null);

    useEffect(() => {
        setError(null);
        setFileUrl(null); // Reset to show loader if applicable
        const currentFilePath = HARDCODED_TEST_FILE_PATH || propFilePath;
        setIsLoading(!!currentFilePath); // Set loading if filePath is present

        if (currentFilePath) {
            const name = currentFilePath.split(/[/\\]/).pop() || 'Audio File';
            setFileName(name);
            const determinedMimeType = getMimeType(name);
            setMimeType(determinedMimeType);
            console.log("AudioPlayer: Received filePath:", currentFilePath);

            try {
                let constructedUrl;
                if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
                    // 1. Normalize backslashes to forward slashes
                    let normalizedPath = currentFilePath.replace(/\\/g, '/');

                    // 2. Ensure it's prefixed correctly for a file URL
                    if (normalizedPath.startsWith('file:///')) {
                        constructedUrl = normalizedPath; // Already well-formed
                    } else if (/^[a-zA-Z]:\//.test(normalizedPath)) { // Windows path like C:/...
                        constructedUrl = `file:///${normalizedPath}`;
                    } else if (normalizedPath.startsWith('/')) { // Unix-like absolute path /...
                        constructedUrl = `file:///${normalizedPath}`;
                    } else {
                        console.error("AudioPlayer: Path is not recognized as absolute:", currentFilePath);
                        throw new Error(`Path is not absolute: ${currentFilePath}`);
                    }

                    // 3. Encode special characters in the path part ONLY
                    const schemeMatch = constructedUrl.match(/^(file:\/\/\/[a-zA-Z]:|file:\/\/\/|file:\/\/)/i);
                    const scheme = schemeMatch ? schemeMatch[0] : '';
                    if (!scheme) {
                        throw new Error("URL scheme extraction failed for audio.");
                    }
                    const pathPart = constructedUrl.substring(scheme.length);
                    const encodedPathSegments = pathPart.split('/').map(segment =>
                        encodeURIComponent(segment)
                            .replace(/%23/g, '#').replace(/%26/g, '&') // Revert some if needed
                            .replace(/%3D/g, '=').replace(/%3F/g, '?')
                    );
                    constructedUrl = scheme + encodedPathSegments.join('/');
                    constructedUrl = constructedUrl.replace(/\\/g, '/'); // Final sanity check for slashes
                } else {
                    // Fallback for non-Electron environments (less likely for local files)
                    constructedUrl = currentFilePath;
                }

                console.log('AudioPlayer: Attempting to set fileUrl to:', constructedUrl, 'MIME type:', determinedMimeType);
                setFileUrl(constructedUrl);
                setIsLoading(false);

                if (audioRef.current) {
                    console.log("AudioPlayer: Pausing and loading new audio source.");
                    audioRef.current.pause();
                    // audioRef.current.src = constructedUrl; // Setting src directly then load() is often better
                    audioRef.current.load(); // This tells the browser to update based on the new src from render
                }

            } catch (e) {
                console.error("AudioPlayer: Error processing audio path:", currentFilePath, e);
                setError(`Failed to create a valid URL for audio: ${e.message}. Path: ${currentFilePath}`);
                setFileUrl(null);
                setIsLoading(false);
            }
        } else {
            setFileName('');
            setMimeType('');
            setIsLoading(false);
        }
    // Add HARDCODED_TEST_FILE_PATH to dependency array if you want it to react to changes in that constant (for testing different hardcoded paths)
    // For now, propFilePath is enough as the primary trigger.
    }, [propFilePath]);

    const handleError = (e) => {
        const audioElement = e.target;
        const currentSrcPath = HARDCODED_TEST_FILE_PATH || propFilePath;
        console.error("AudioPlayer: Playback error occurred.", {
            filePathUsed: currentSrcPath,
            fileUrlState: fileUrl, // Log the state variable that should have the correct URL
            audioElementSrc: audioElement.src, // Log what's actually on the element
            mimeType,
            errorCode: audioElement.error?.code,
            errorMessage: audioElement.error?.message,
            networkState: audioElement.networkState,
            readyState: audioElement.readyState,
            errorEvent: e
        });

        let message = "Could not load or play the audio file.";
        if (audioElement.error) {
            switch (audioElement.error.code) {
                case MediaError.MEDIA_ERR_ABORTED: // 1
                    message = "Audio playback was aborted.";
                    break;
                case MediaError.MEDIA_ERR_NETWORK: // 2
                    message = "A network error caused audio download to fail part-way.";
                    break;
                case MediaError.MEDIA_ERR_DECODE: // 3
                    message = "Audio decoding error. The file may be corrupt, or the format is not fully supported for decoding even if the container is recognized.";
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: // 4
                    message = "The audio format (e.g., MP3) is not supported. This can happen if the file is unusual, or (less likely now that video works) a very specific codec variant issue.";
                    break;
                default:
                    message = `An unknown audio error occurred (code: ${audioElement.error.code}).`;
            }
        }
        setError(message);
        setIsLoading(false);
    };

    const activeFilePath = HARDCODED_TEST_FILE_PATH || propFilePath;

    if (isLoading) {
        return (
            <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-neutral-100 [.dark_&]:bg-neutral-800 text-neutral-600 [.dark_&]:text-neutral-300 ${className}`}>
                <FiLoader className="animate-spin text-blue-500 [.dark_&]:text-blue-400" size={32} />
                <span className="ml-2 mt-2">Loading Audio...</span>
                {fileName && <p className="text-xs mt-1">{fileName}</p>}
            </div>
        );
    }

    if (error) {
         return (
            <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-neutral-100 [.dark_&]:bg-neutral-800 text-red-500 ${className}`}>
                <FiAlertCircle size={48} className="mb-2" />
                <p className="text-center font-semibold">Audio Error</p>
                <p className="text-sm text-center">{error}</p>
                {activeFilePath && <p className="text-xs mt-2 text-neutral-500 [.dark_&]:text-neutral-400">File: {activeFilePath}</p>}
            </div>
        );
    }

    if (!activeFilePath && !isLoading) {
        return (
            <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-neutral-100 [.dark_&]:bg-neutral-800 text-neutral-500 [.dark_&]:text-neutral-400 ${className}`}>
                <FiMusic size={48} className="mb-2 opacity-50" />
                <p>No audio file selected.</p>
            </div>
        );
    }

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-neutral-100 [.dark_&]:bg-neutral-800 text-neutral-700 [.dark_&]:text-neutral-300 ${className}`}>
            <FiMusic size={64} className="mb-4 text-blue-500 [.dark_&]:text-blue-400" />
            <p className="mb-1 text-lg font-medium truncate max-w-md" title={fileName}>{fileName}</p>
            {activeFilePath && !isLoading && <p className="mb-3 text-xs text-neutral-500 [.dark_&]:text-neutral-400 truncate max-w-md" title={activeFilePath}>{activeFilePath}</p>}

            {fileUrl && (
                <audio
                    ref={audioRef}
                    controls
                    key={fileUrl} // Force re-render if URL changes
                    src={fileUrl}
                    type={mimeType || undefined}
                    onError={handleError}
                    onLoadedData={() => console.log("AudioPlayer: (onLoadedData) Audio data loaded for", fileUrl)}
                    onCanPlay={() => console.log("AudioPlayer: (onCanPlay) Can play", fileUrl)}
                    onCanPlayThrough={() => console.log("AudioPlayer: (onCanPlayThrough) Can play through", fileUrl)}
                    onPlaying={() => console.log("AudioPlayer: (onPlaying) Playback started for", fileUrl)}
                    preload="metadata" // Good practice
                    className="w-full max-w-md mt-2"
                >
                    Your browser does not support the audio element.
                </audio>
            )}
            {/* Fallback if fileUrl is not yet ready but a file was selected and not loading (and no error) */}
            {!fileUrl && activeFilePath && !isLoading && !error && (
                 <p className="text-neutral-400">Preparing audio...</p>
            )}
        </div>
    );
};
AudioPlayer.displayName = 'AudioPlayer';
export default AudioPlayer;