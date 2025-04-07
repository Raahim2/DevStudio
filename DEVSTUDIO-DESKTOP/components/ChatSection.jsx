// src/app/main/components/ChatSection.js (or your correct path)
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FiAlertCircle, FiX, FiZap } from 'react-icons/fi'; // Icons specifically for ChatSection

// Import Hooks
import { useGeminiChat } from '../hooks/useGeminiChat'; // Adjust path as needed
import { useGitHubApi } from '../hooks/useGitHubApi';   // Adjust path as needed

// Import Components
import ChatMessage from './ChatMessage';        // Adjust path
import CodeBlock from './CodeBlock';            // Adjust path
import ChatInput from './ChatInput';            // Adjust path
import CreateFileModal from './CreateFileModal'; // Adjust path

// --- Main Chat Section Component ---
const ChatSection = ({
    selectedRepoFullName, // Format: "owner/repo"
    selectedFile,         // Object: { name, path, sha } or null
    selectedFileContent,  // String content or null
    isLoading: isFileLoading, // Boolean: Is the file content being loaded?
    error: fileError,     // String: Error message from file loading, or null
    accessToken           // String: GitHub personal access token
}) => {
    const chatContainerRef = useRef(null); // Ref for scrolling the chat message area

    // --- Initialize Hooks ---
    // Hook for managing Gemini chat interaction and history
    const {
        chatHistory,              // Array of chat messages { id, role, text }
        sendMessage: sendGeminiMessage, // Function to send a message to Gemini
        isSending: isGeminiSending,   // Boolean: Is Gemini processing a message?
        error: geminiError,         // String: Error from Gemini hook, or null
        clearError: clearGeminiError, // Function to clear Gemini error state
        isApiKeyMissing,          // Boolean: Is the Gemini API key missing/invalid?
        stopGenerating: stopGeminiGenerating, // Function to stop Gemini generation
        setFileContext: setGeminiFileContext, // Function to inform hook about file context changes
    } = useGeminiChat(); // Initialize with default empty history

    // Hook for managing GitHub API interactions (like committing)
    const {
        commitCode,                // Function to commit code changes
        isCommitting: isGitHubCommitting, // Boolean: Is a commit operation in progress?
        commitError: gitHubCommitError,   // String: Error from GitHub commit, or null
        commitSuccess: gitHubCommitSuccess, // Boolean: Was the last commit successful?
        clearCommitError: clearGitHubCommitError, // Function to clear GitHub commit error state
    } = useGitHubApi(accessToken, selectedRepoFullName); // Pass necessary arguments

    // --- State Managed by ChatSection ---
    const [inputMessage, setInputMessage] = useState(''); // State for the text input field
    const [showCreateModal, setShowCreateModal] = useState(false); // State for CreateFileModal visibility
    const [codeForModal, setCodeForModal] = useState('');      // State for storing code to pass to CreateFileModal

    // Determine the primary error to display (prioritizing GitHub, then Gemini, then file loading)
    const displayError = gitHubCommitError || geminiError || fileError;

    // --- Effects ---

    // Effect to scroll chat to the bottom when new messages are added
    useEffect(() => {
        if (chatContainerRef.current) {
            // Use requestAnimationFrame to ensure scrolling occurs after DOM updates
            requestAnimationFrame(() => {
                chatContainerRef.current.scrollTo({
                    top: chatContainerRef.current.scrollHeight,
                    behavior: 'smooth' // Smooth scrolling animation
                });
            });
        }
    }, [chatHistory]); // Rerun whenever chatHistory array changes

    // Effect to notify the Gemini chat hook when the selected file context changes
    useEffect(() => {
        // Call the function exposed by the useGeminiChat hook
        setGeminiFileContext(selectedFile);
    }, [selectedFile, setGeminiFileContext]); // Rerun if selectedFile or the hook's function changes

    // --- Event Handlers ---

    // Update input field state when user types
    const handleInputChange = (e) => {
        setInputMessage(e.target.value);
    };

    // Handle sending a message (triggered by ChatInput component)
    const handleSendMessage = useCallback(() => {
        if (!inputMessage.trim()) return; // Don't send empty messages
        // Call the sendMessage function from the useGeminiChat hook
        sendGeminiMessage(inputMessage, selectedFile, selectedFileContent);
        setInputMessage(''); // Clear the input field after sending
    }, [inputMessage, selectedFile, selectedFileContent, sendGeminiMessage]); // Dependencies

    // Handle stopping AI generation (triggered by ChatInput component)
    const handleStopGenerating = useCallback(() => {
        stopGeminiGenerating(); // Call the function from the useGeminiChat hook
    }, [stopGeminiGenerating]);

    // Handle opening the Create File modal (triggered by CodeBlock component)
    const handleShowCreateFileModal = useCallback((codeContent) => {
        // Precondition check
        if (!selectedRepoFullName || !accessToken) {
             console.error("Cannot show create modal: Missing repo or token");
             // Optionally set a specific error state here if needed for UI feedback
             return;
        }
        console.log("ChatSection: Showing create file modal.");
        setCodeForModal(codeContent); // Store the code content for the modal
        setShowCreateModal(true);     // Set state to make the modal visible
        // Clear any existing errors when opening the modal for a fresh start
        clearGeminiError();
        clearGitHubCommitError();
    }, [selectedRepoFullName, accessToken, clearGeminiError, clearGitHubCommitError]); // Dependencies

    // Handle closing the Create File modal (callback from CreateFileModal component)
    const handleModalClose = useCallback((didCreateFile = false) => {
        setShowCreateModal(false); // Hide the modal
        setCodeForModal('');     // Clear the stored code content
        if (didCreateFile) {
            console.log("ChatSection: File creation successful (reported by modal).");
            // TODO: Implement desired action after successful file creation
            // e.g., Add a system message to chat, trigger a refresh of the file list in FileBar
            // Example: Add system message (needs access to setChatHistory or similar)
            // setChatHistory(prev => [...prev, { id: `sys-${Date.now()}`, role: 'system', text: `File created successfully!` }]);
        } else {
             console.log("ChatSection: Create file modal closed without creating file.");
        }
    }, []); // No dependencies needed if it only sets local state

    // Function to clear the currently displayed error message
    const clearDisplayError = useCallback(() => {
        clearGitHubCommitError(); // Clear GitHub API errors
        clearGeminiError();     // Clear Gemini API errors
        // Note: fileError comes from props and cannot be cleared here.
        // The parent component managing file loading would need to clear it.
    }, [clearGitHubCommitError, clearGeminiError]);


    // --- Markdown Components Configuration ---
    // Memoize the configuration object for ReactMarkdown's `components` prop
    // This prevents unnecessary re-renders of messages if props haven't changed
    const markdownComponents = useMemo(() => ({
        // Custom renderer for code blocks (``` ```)
        code: ({ node, inline, className, children, ...props }) => {
             // Extract language from className (e.g., "language-javascript")
             const match = /language-(\w+)/.exec(className || '');
             const language = match?.[1] || 'plaintext'; // Default to plaintext
             // Clean up code string (remove potential trailing newline)
             const codeString = String(children).replace(/\n$/, '');

             // Render inline code (`code`) differently
             if (inline) {
                 return <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
             }
             // Render block code using the CodeBlock component
             else {
                 return (
                     <CodeBlock
                         language={language}
                         codeString={codeString}
                         selectedRepoFullName={selectedRepoFullName}
                         selectedFile={selectedFile}
                         // Pass the actual commit function from the useGitHubApi hook
                         onCommit={commitCode}
                         // Pass the function to open the Create File modal
                         onCreateFile={handleShowCreateFileModal}
                         {...props} // Pass down any other props
                     />
                 );
             }
        },
         // Standard HTML elements mapping with Tailwind CSS classes for styling
         p: ({ node, children }) => <p className={'mb-2 last:mb-0'}>{children}</p>,
         ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 pl-4" {...props} />,
         ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 pl-4" {...props} />,
         li: ({ node, ...props }) => <li className="mb-1" {...props} />,
         blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-600 dark:text-gray-400 mb-2" {...props} />,
         a: ({ node, ...props }) => <a className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />, // Ensure links open in new tab
         hr: ({ node, ...props }) => <hr className="my-4 border-gray-200 dark:border-gray-700" {...props} />,
    // Dependencies for useMemo: Recreate the config if these functions/values change
    }), [selectedRepoFullName, selectedFile, commitCode, handleShowCreateFileModal]);


    // Determine if primary chat interactions should be disabled
    // Disabled if API key is missing OR if there's an error loading the initial file context
    const isInteractionDisabled = isApiKeyMissing || !!fileError;


    // --- JSX Rendering ---
    return (
        // Main container for the chat section
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden h-full border-l border-gray-200 dark:border-gray-700">

            {/* Scrollable Chat Messages Area */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scroll-smooth flex flex-col" // Added flex flex-col for alignment
            >
                {/* Initial State Message (when no history/file selected) */}
                {chatHistory.length === 0 && !isGeminiSending && !selectedFile && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 px-4">
                         {/* Show API key error if applicable */}
                         {isApiKeyMissing ? (
                            <div className="flex flex-col items-center text-red-600 dark:text-red-400">
                                <FiAlertCircle size={24} className="mb-2"/>
                                <span>{geminiError || "Gemini API Key missing."}</span>
                                <span className="text-xs mt-1">(Check environment variables)</span>
                            </div>
                         ) : (
                            // Generic prompt message
                            <div className="flex flex-col items-center">
                                <FiZap size={32} className="mb-3 text-indigo-400"/>
                                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">Chat Ready</p>
                                <p className="text-sm">Select a file or type a message below.</p>
                            </div>
                         )}
                    </div>
                )}

                {/* Render the list of chat messages */}
                {chatHistory.map((message) => (
                    <ChatMessage
                        key={message.id} // Use unique message ID as key
                        message={message}
                        markdownComponents={markdownComponents} // Pass the memoized components config
                    />
                ))}

                 {/* Global Error Display Area (at the bottom of messages) */}
                 {displayError && !isGeminiSending && ( // Show only if there's an error and AI is not currently sending
                     <div className="mt-auto sticky bottom-2 px-4 z-10"> {/* Use mt-auto to push down, sticky to keep in view */}
                       <div className="flex items-center justify-center p-3 mx-auto w-full max-w-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm border border-red-200 dark:border-red-600/50 shadow-sm">
                           <FiAlertCircle className="mr-2 flex-shrink-0" size={18}/>
                           <span className="flex-1 text-center">{displayError}</span>
                           {/* Button to dismiss the error */}
                           <button
                                onClick={clearDisplayError}
                                className="ml-2 p-1 text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-100 rounded-full hover:bg-red-200 dark:hover:bg-red-800/50 focus:outline-none focus:ring-1 focus:ring-red-500"
                                aria-label="Dismiss error"
                                title="Dismiss error"
                            >
                             <FiX size={16}/>
                           </button>
                       </div>
                     </div>
                 )}
            </div> {/* End Chat Messages Area */}

            {/* Chat Input Area (uses the dedicated component) */}
            <ChatInput
                inputValue={inputMessage}
                onInputChange={handleInputChange}
                onSendMessage={handleSendMessage}
                isSending={isGeminiSending} // Pass Gemini's sending state
                onStopGenerating={handleStopGenerating}
                selectedFile={selectedFile}
                isFileLoading={isFileLoading}
                fileError={fileError}
                isInteractionDisabled={isInteractionDisabled} // Pass combined disabled flag
            />

            {/* Create File Modal (Rendered conditionally, managed by state) */}
            <CreateFileModal
                isOpen={showCreateModal}
                onClose={handleModalClose} // Pass the close handler
                initialCode={codeForModal} // Pass the code for the new file
                accessToken={accessToken} // Pass the GitHub token
                selectedRepoFullName={selectedRepoFullName} // Pass the repo name
            />

        </div> /* End Main Container */
    );
};

export default ChatSection;