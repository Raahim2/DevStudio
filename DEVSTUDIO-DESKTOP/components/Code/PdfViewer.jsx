'use client';

import React, { useEffect, useState } from 'react';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';

const PdfViewer = ({ filePath, className }) => {
    const [fileUrl, setFileUrl] = useState(null);
    const [error, setError] = useState(null);
    const [attemptKey, setAttemptKey] = useState(0); // To force re-render of object/embed

    useEffect(() => {
        setError(null); // Reset error on filePath change
        setFileUrl(null); // Reset fileUrl to show loader

        if (filePath) {
            console.log("PdfViewer: Received filePath:", filePath);
            try {
                let constructedUrl;
                if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
                    // Normalize backslashes to forward slashes first
                    let normalizedPath = filePath.replace(/\\/g, '/');

                    // Ensure it's prefixed correctly for a file URL
                    if (normalizedPath.startsWith('file:///')) {
                        constructedUrl = normalizedPath; // Already well-formed
                    } else if (/^[a-zA-Z]:\//.test(normalizedPath)) { // Windows path like C:/...
                        constructedUrl = `file:///${normalizedPath}`;
                    } else if (normalizedPath.startsWith('/')) { // Unix-like absolute path /...
                        // For Unix, file:// or file:/// can work, file:/// is often safer for <object>
                        constructedUrl = `file:///${normalizedPath}`;
                    } else {
                        console.error("PdfViewer: Path is not recognized as absolute or needs manual file:/// prefix:", filePath);
                        throw new Error(`Path is not absolute or needs prefix: ${filePath}`);
                    }

                    // URI encode the path part ONLY, after the scheme and drive letter (if any)
                    // Example: file:///C:/Users/My User/Doc.pdf
                    // Scheme part: file:///C:
                    // Path part to encode: /Users/My User/Doc.pdf
                    const schemeMatch = constructedUrl.match(/^(file:\/\/\/[a-zA-Z]:|file:\/\/\/|file:\/\/)/i);
                    const scheme = schemeMatch ? schemeMatch[0] : '';
                    
                    if (!scheme) {
                        console.error("PdfViewer: Could not extract scheme from URL:", constructedUrl);
                        throw new Error("URL scheme extraction failed.");
                    }
                    
                    const pathPart = constructedUrl.substring(scheme.length);

                    // encodeURI does not encode: A-Z a-z 0-9 ; , / ? : @ & = + $ - _ . ! ~ * ' ( ) #
                    // We need to handle #, ?, and spaces. encodeURIComponent is too aggressive for path segments.
                    // A common strategy is to split by '/' and encode each segment.
                    const encodedPathSegments = pathPart.split('/').map(segment => {
                        // Encode URI components, but preserve some known safe characters for path segments if needed.
                        // For PDF paths, # and ? are problematic if not part of query params (which file URLs don't have).
                        return encodeURIComponent(segment)
                                 .replace(/%23/g, '#') // Revert # if needed for anchors, but usually not for file paths
                                 .replace(/%26/g, '&') // Revert &
                                 .replace(/%3D/g, '=') // Revert =
                                 .replace(/%3F/g, '?'); // Revert ?
                    });
                    
                    const finalEncodedPathPart = encodedPathSegments.join('/');
                    constructedUrl = scheme + finalEncodedPathPart;

                    // Final check for any stray backslashes that might have been reintroduced or missed
                    constructedUrl = constructedUrl.replace(/\\/g, '/');

                } else {
                    // Fallback for non-Electron (e.g. web browser trying to load local file via prop, highly restricted)
                    console.warn("PdfViewer: Not in Electron renderer, attempting to use filePath directly (likely won't work for local files).");
                    constructedUrl = filePath; // This will likely fail in a standard web browser due to security
                }

                console.log("PdfViewer: Attempting to set fileUrl to:", constructedUrl);
                setFileUrl(constructedUrl);
                setAttemptKey(prev => prev + 1); // Force re-render of object/embed

            } catch (e) {
                console.error("PdfViewer: Error processing PDF path:", filePath, e);
                setError(`Failed to create a valid URL for the PDF: ${e.message}. Path: ${filePath}`);
                setFileUrl(null);
            }
        } else {
            console.log("PdfViewer: No filePath provided.");
            setFileUrl(null);
            // setError("No file path provided for PDF viewer."); // Optional: setError if no path is an error state
        }
    }, [filePath]);

    if (error) {
        return (
            <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-neutral-100 [.dark_&]:bg-neutral-800 text-red-500 ${className}`}>
                <FiAlertCircle size={48} className="mb-2" />
                <p className="text-center font-semibold">Error loading PDF</p>
                <p className="text-sm text-center">{error}</p>
                {filePath && <p className="text-xs mt-2 text-neutral-500 [.dark_&]:text-neutral-400">Path: {filePath}</p>}
            </div>
        );
    }

    if (!fileUrl && filePath) { // filePath is present, but fileUrl not yet set (or failed)
        return (
            <div className={`w-full h-full flex items-center justify-center bg-neutral-100 [.dark_&]:bg-neutral-800 ${className}`}>
                <FiLoader className="animate-spin text-blue-500 [.dark_&]:text-blue-400" size={32} />
                <span className="ml-2 text-neutral-600 [.dark_&]:text-neutral-300">Loading PDF...</span>
            </div>
        );
    }
    
    if (!fileUrl && !filePath) { // No file selected at all
         return (
            <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-neutral-100 [.dark_&]:bg-neutral-800 text-neutral-400 [.dark_&]:text-neutral-500 ${className}`}>
                <FiFileText size={48} className="mb-2 opacity-50" />
                <p>No PDF file selected.</p>
            </div>
        );
    }


    // If fileUrl is set, attempt to display
    if (fileUrl) {
        return (
            <div className={`w-full h-full flex items-center justify-center bg-neutral-300 [.dark_&]:bg-neutral-700 ${className}`}>
                {/* Using a key helps React replace the element if the src changes, which can help with re-loading */}
                <object key={fileUrl + attemptKey} data={fileUrl} type="application/pdf" width="100%" height="100%">
                    {/* Fallback content if object tag fails or is not supported */}
                    <embed key={fileUrl + attemptKey + 'embed'} src={fileUrl} type="application/pdf" width="100%" height="100%" />
                    <div className="p-4 text-neutral-700 [.dark_&]:text-neutral-300 flex flex-col items-center justify-center h-full bg-white [.dark_&]:bg-neutral-800">
                        <FiAlertCircle size={32} className="mb-2 text-yellow-500" />
                        <p className="text-center">PDF viewer plugin may not be available or the PDF could not be loaded.</p>
                        {filePath && <p className="text-xs mt-1 text-neutral-500 [.dark_&]:text-neutral-400">File: {filePath}</p>}
                        <p className="mt-2">You can try opening
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (window.electronAPI && window.electronAPI.openExternal) {
                                        window.electronAPI.openExternal(fileUrl);
                                    } else {
                                        // Fallback if openExternal is not available
                                        window.open(fileUrl, '_blank');
                                    }
                                }}
                                className="ml-1 text-blue-500 hover:underline"
                            >
                                this PDF directly
                            </a> in your system's default viewer.
                        </p>
                        <button 
                            onClick={() => setAttemptKey(prev => prev + 1)} 
                            className="mt-3 px-3 py-1 text-xs rounded bg-blue-500 hover:bg-blue-600 text-white"
                        >
                            Retry Load
                        </button>
                    </div>
                </object>
            </div>
        );
    }

    // Should ideally not be reached if logic above is correct, but as a fallback:
    return (
         <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-neutral-100 [.dark_&]:bg-neutral-800 text-neutral-400 [.dark_&]:text-neutral-500 ${className}`}>
            <FiAlertCircle size={48} className="mb-2 opacity-50" />
            <p>Could not determine how to display PDF.</p>
             {filePath && <p className="text-xs mt-1 text-neutral-500 [.dark_&]:text-neutral-400">File: {filePath}</p>}
        </div>
    );
};
PdfViewer.displayName = 'PdfViewer';
export default PdfViewer;