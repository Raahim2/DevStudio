'use client';

import React, { useState } from 'react';

// --- Helper Components ---

// Spinner - No changes needed
const Spinner = () => (
    <svg className="animate-spin inline-block h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// JSON Display - No changes needed
const JsonDisplay = ({ data }) => (
    <pre className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 p-2 my-1 rounded overflow-auto max-h-60 font-mono whitespace-pre-wrap break-words">
        {JSON.stringify(data, null, 2)}
    </pre>
);

// Severity Badge - No changes needed
const SeverityBadge = ({ severity }) => {
    const sev = String(severity || 'info').toLowerCase();
    let styles = 'bg-gray-400 text-black border-gray-500';

    switch (sev) {
        case 'critical': styles = 'bg-purple-600 text-white border-purple-700'; break;
        case 'error':    styles = 'bg-red-600 text-white border-red-700'; break;
        case 'high':     styles = 'bg-orange-500 text-white border-orange-600'; break;
        case 'warning':  styles = 'bg-yellow-400 text-black border-yellow-500'; break;
        case 'medium':   styles = 'bg-blue-500 text-white border-blue-600'; break;
        case 'low':      styles = 'bg-green-500 text-white border-green-600'; break;
        default:         styles = 'bg-gray-500 text-white border-gray-600'; break;
    }

    return (
        <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase border rounded-full inline-block whitespace-nowrap ${styles}`}>
            {severity || 'N/A'}
        </span>
    );
};

// Code Location Component - Updated Icon (no functional changes needed here)
const CodeLocation = ({ path, line, col }) => (
    <div className="text-xs text-gray-600 dark:text-gray-400 font-mono mt-1.5 break-all flex items-center flex-grow min-w-0"> {/* Added flex-grow and min-w-0 for better truncation */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline-block mr-1.5 flex-shrink-0 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="truncate" title={path}>{path || 'N/A'}</span>
        {line && <span className="ml-1 flex-shrink-0">:L{line}{col ? `:${col}` : ''}</span>}
    </div>
);


// --- Main Component ---
const RepoScanner = ({ repoUrl: initialRepoUrl, accessToken, setActiveTab, setSelectedFile }) => { // Receive setActiveTab and setSelectedFile
    const [repoUrlInput, setRepoUrlInput] = useState(initialRepoUrl || '');
    const [scanStatus, setScanStatus] = useState('idle'); // idle, scanning, completed, error
    const [error, setError] = useState(null);

    // State for results
    const [scanMessage, setScanMessage] = useState('');
    const [scanFindings, setScanFindings] = useState(null); // Array of findings
    const [scanErrors, setScanErrors] = useState([]);     // Array of error objects
    const [scannedPaths, setScannedPaths] = useState([]); // Array of strings
    const [skippedRules, setSkippedRules] = useState([]); // Array of strings/objects
    const [scanVersion, setScanVersion] = useState('');

    const API_ENDPOINT = 'http://192.168.197.116:5000/api/send_query';

    const handleScan = async () => {
        const targetRepoUrl = repoUrlInput.trim();
        if (!targetRepoUrl) {
            setError('Repository identifier cannot be empty. Please provide owner/repository-name.');
            setScanStatus('error');
            return;
        }
        if (targetRepoUrl.includes('/') === false || targetRepoUrl.includes('://') || targetRepoUrl.endsWith('.git')) {
             setError('Invalid format. Please use "owner/repository-name".');
             setScanStatus('error');
             return;
        }

        setError(null); setScanMessage(''); setScanFindings(null); setScanErrors([]); setScannedPaths([]); setSkippedRules([]); setScanVersion('');
        setScanStatus('scanning');
        const fullRepoGitUrl = `https://github.com/${targetRepoUrl}.git`;

        try {
            console.log(`Initiating scan for: ${fullRepoGitUrl}`);
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                 },
                body: JSON.stringify({ repo_url: fullRepoGitUrl, access_token: accessToken }),
            });

            const data = await response.json();

            if (!response.ok || data.status !== 'success') {
                let errorMsg = `Scan request failed (HTTP ${response.status}). `;
                errorMsg += `Status: ${data?.status || 'Unknown'}. `;
                errorMsg += `Message: ${data?.message || response.statusText || 'No details provided.'}`;
                 if (data?.findings?.errors?.length > 0) {
                     errorMsg += ` Scanner reported ${data.findings.errors.length} internal errors.`;
                     setScanErrors(Array.isArray(data.findings.errors) ? data.findings.errors : []);
                 }
                throw new Error(errorMsg);
            }

            setScanMessage(data.message || 'Scan completed successfully.');
            const findings = data.findings || {};
            setScanFindings(Array.isArray(findings.results) ? findings.results : []);
            setScanErrors(Array.isArray(findings.errors) ? findings.errors : []);
            setScannedPaths(Array.isArray(findings.paths?.scanned) ? findings.paths.scanned : []);
            setSkippedRules(Array.isArray(findings.skipped_rules) ? findings.skipped_rules : []);
            setScanVersion(findings.version || '');
            setScanStatus('completed');

        } catch (err) {
            console.error("Scan execution error:", err);
            let displayError = err.message;
            if (err instanceof TypeError) {
                displayError = `Network or connection error: Could not reach the API endpoint (${API_ENDPOINT}). Please check connectivity and CORS policy.`;
            }
            setError(`Error during scan: ${displayError}`);
            setScanStatus('error');
            if (!scanErrors.length) {
                setScanMessage(''); setScanFindings(null); setScannedPaths([]); setSkippedRules([]); setScanVersion('');
            }
        }
    };


   // Helper function for the Go-To-Code button click
const handleGoToCodeClick = (filePath) => {
    const basePath = '/home/oman/devstudio/SkillX/';
    const relativePath = filePath.startsWith(basePath) ? filePath.replace(basePath, '') : filePath;
    
    console.log(`Go-To-Code clicked for file: ${relativePath}`);
    
    if (relativePath && typeof setSelectedFile === 'function' && typeof setActiveTab === 'function') {
        setSelectedFile(relativePath);
        setActiveTab('Code'); // <-- Make sure 'Code' is the correct key for your code tab
    } else {
        console.warn('Missing filePath, setSelectedFile, or setActiveTab for Go-To-Code functionality.');
    }
};


    return (
        // --- Overall Container ---
        <div className="min-h-screen flex flex-col bg-gray-100 font-sans text-gray-900 dark:text-gray-100 [.dark_&]:bg-gray-800  ">

            {/* --- Header --- */}
            <header className="bg-white [.dark_&]:bg-gray-800 dark:bg-gray-800 shadow-sm py-3 px-4 md:px-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                <h1 className="text-lg font-semibold [.dark_&]:text-white [.dark_&]:bg-gray-800">
                    Repository Security Scanner
                    {scanVersion && <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Engine v{scanVersion})</span>}
                </h1>
            </header>

            {/* --- Main Content Area --- */}
            <main className="flex-grow p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* --- Left Column / Control Panel --- */}
                <div className="lg:col-span-4 xl:col-span-3">
                     <div className="sticky top-[70px]"> {/* Adjust top value based on header height + desired gap */}
                        <div className="bg-white dark:bg-gray-800 [.dark_&]:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 shadow-md rounded-lg">
                            <h2 className="text-base font-semibold text-gray-700 [.dark_&]:text-white [.dark_&]:bg-gray-800 border-b border-gray-200 dark:border-gray-600 pb-2 mb-4">
                                Scan Configuration
                            </h2>
                            <div className="space-y-4">
                                {/* Repo Input */}
                                <div>
                                    <label htmlFor="repoUrlInput" className="block text-xs font-medium text-gray-600 [.dark_&]:text-white mb-1">
                                        Target Repository <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="repoUrlInput"
                                        value={repoUrlInput}
                                        onChange={(e) => setRepoUrlInput(e.target.value)}
                                        placeholder="owner/repo-name"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100 disabled:opacity-60"
                                        disabled={scanStatus === 'scanning'}
                                        aria-label="Target Repository Input"
                                    />
                                    {initialRepoUrl && repoUrlInput !== initialRepoUrl && (
                                        <p className="text-[11px] mt-1 text-gray-500 dark:text-gray-400">
                                            (Initial: "{initialRepoUrl}")
                                        </p>
                                    )}
                                </div>
                                {/* Scan Button */}
                                <button
                                    onClick={handleScan}
                                    disabled={scanStatus === 'scanning' || !repoUrlInput.trim()}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 dark:disabled:bg-gray-500 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                                >
                                    {scanStatus === 'scanning' ? ( <Spinner /> ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    )}
                                    {scanStatus === 'scanning' ? 'Scanning...' : 'Start Scan'}
                                </button>
                            </div>

                            {/* --- Status Area --- */}
                            <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-600">
                                <h3 className="text-xs font-semibold text-gray-500 [.dark_&]:text-white uppercase tracking-wider mb-2">Status</h3>
                                {scanStatus === 'idle' && ( <p className="text-sm text-gray-600 [.dark_&]:text-white">Ready to scan.</p> )}
                                {scanStatus === 'scanning' && ( <div className="text-sm text-blue-600 dark:text-blue-400 flex items-center font-medium"><Spinner /> In progress...</div> )}
                                {scanStatus === 'error' && error && (
                                    <div className="border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-200 rounded-r-md" role="alert">
                                        <p className="font-semibold">Scan Error</p>
                                        <p className="mt-1 text-xs break-words">{error}</p>
                                    </div>
                                )}
                                {scanStatus === 'completed' && (
                                    <div className={`p-3 rounded-md text-sm border-l-4 ${ scanFindings?.length > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-500 text-yellow-800 dark:text-yellow-200' : 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-600 text-green-800 dark:text-green-200'}`}>
                                        <p className="font-semibold">{scanFindings?.length > 0 ? 'Scan Complete - Findings Reported' : 'Scan Complete - No Findings'}</p>
                                        <p className="text-xs mt-1 opacity-90">{scanMessage}</p>
                                        {scanFindings !== null && ( <p className="text-xs mt-1.5 font-medium">Findings: {scanFindings.length} | Errors: {scanErrors.length}</p> )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Right Column / Results Area --- */}
                <div className="lg:col-span-8 xl:col-span-9 space-y-6">

                    {/* --- Findings Card --- */}
                    {scanStatus === 'completed' && scanFindings !== null && (
                         <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md rounded-lg flex flex-col overflow-hidden">
                             <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                                 <h3 className="text-base font-semibold">Findings ({scanFindings.length})</h3>
                             </header>
                             <div className="flex-grow overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                                <div className="p-1 md:p-2">
                                     {scanFindings.length > 0 ? (
                                         <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                             {scanFindings.map((finding, index) => (
                                                 <div
                                                    key={finding.check_id + '-' + index}
                                                    className="p-3 md:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition duration-150 ease-in-out"
                                                    role="listitem"
                                                 >
                                                     {/* Finding Header */}
                                                     <div className="flex justify-between items-start gap-x-3 mb-2">
                                                         <span className="font-semibold font-mono text-sm text-blue-700 dark:text-blue-400 break-all flex-shrink mr-4" title={finding.check_id}>
                                                             {finding.check_id || 'Unknown Rule'}
                                                         </span>
                                                         <SeverityBadge severity={finding.extra?.severity} />
                                                     </div>

                                                     {/* Finding Message */}
                                                     <p className="text-sm text-gray-800 dark:text-gray-200 my-1 leading-relaxed">
                                                         {finding.extra?.message || 'No description provided.'}
                                                     </p>

                                                     {/* --- Location & Go-To-Code Button --- */}
                                                     <div className="flex items-center justify-between gap-x-2"> {/* Use flex container */}
                                                        <CodeLocation path={finding.path} line={finding.start?.line} col={finding.start?.col} />

                                                        {/* Go-To-Code Button (Conditionally Rendered) */}
                                                        {finding.path && typeof setActiveTab === 'function' && typeof setSelectedFile === 'function' && (
                                                            <button
                                                                onClick={() => handleGoToCodeClick(finding.path)}
                                                                title={`Go to code: ${finding.path}`}
                                                                aria-label={`View code for finding in ${finding.path}`}
                                                                className="ml-2 p-1 rounded text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 flex-shrink-0 transition-colors"
                                                            >
                                                                {/* Code Icon SVG */}
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                     </div>

                                                     {/* Metadata / Extra Data */}
                                                     {finding.extra && Object.keys(finding.extra).filter(k => k !== 'severity' && k !== 'message').length > 0 && (
                                                          <details className="mt-2.5 text-xs group">
                                                              <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-medium list-none flex items-center">
                                                                    <span className="group-open:hidden">Show Raw Data</span>
                                                                    <span className="hidden group-open:inline">Hide Raw Data</span>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 ml-1 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                              </summary>
                                                              <div className="pt-1">
                                                                 <JsonDisplay data={finding.extra} />
                                                              </div>
                                                          </details>
                                                      )}
                                                 </div>
                                             ))}
                                         </div>
                                     ) : ( // No Findings Message
                                         <div className="text-center py-10 px-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                             <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">No findings reported.</p>
                                             <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">The scan completed without identifying any issues based on the current rule set.</p>
                                         </div>
                                     )}
                                 </div>
                             </div>
                         </section>
                     )}

                    {/* --- Errors & Details Card (No changes needed here) --- */}
                    {scanStatus === 'completed' && (scanErrors.length > 0 || scannedPaths.length > 0 || skippedRules.length > 0) && (
                        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md rounded-lg">
                             <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                 <h3 className="text-base font-semibold">Scan Execution Details</h3>
                             </header>
                             <div className="p-4 space-y-5">
                                 {/* Scan Errors */}
                                 {scanErrors.length > 0 && (
                                     <div>
                                        <h4 className="text-sm font-semibold mb-2 text-red-600 dark:text-red-400 flex items-center">
                                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                            Internal Scanner Errors ({scanErrors.length})
                                        </h4>
                                        <div className="space-y-2">
                                             {scanErrors.map((err, index) => (
                                                 <details key={index} className="border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-2 rounded group">
                                                     <summary className="text-xs font-medium text-red-700 dark:text-red-300 cursor-pointer select-none list-none flex justify-between items-center">
                                                         <span>Error {index + 1}: { typeof err === 'string' ? err.substring(0, 80)+'...' : (err?.ruleId || err?.message || 'Details below').substring(0,80)+'...' }</span>
                                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 ml-1 group-open:rotate-180 transition-transform flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                                     </summary>
                                                     <div className="mt-1.5 pt-1 border-t border-red-200 dark:border-red-700/50"><JsonDisplay data={err} /></div>
                                                 </details>
                                             ))}
                                        </div>
                                    </div>
                                 )}
                                {/* Scanned Paths & Skipped Rules */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {scannedPaths.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">Paths Scanned ({scannedPaths.length})</h4>
                                            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 p-2 rounded bg-gray-50 dark:bg-gray-700/40 text-xs font-mono text-gray-600 dark:text-gray-400">
                                                <ul className="list-none space-y-1 pl-0">{scannedPaths.map((path, index) => ( <li key={index} className="truncate" title={path}>{path}</li> ))}</ul>
                                            </div>
                                        </div>
                                    )}
                                    {skippedRules.length > 0 && (
                                    <div>
                                            <h4 className="text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">Rules Skipped ({skippedRules.length})</h4>
                                            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 p-2 rounded bg-gray-50 dark:bg-gray-700/40 text-xs font-mono text-gray-600 dark:text-gray-400">
                                                <ul className="list-none space-y-1 pl-0">{skippedRules.map((rule, index) => ( <li key={index}>{typeof rule === 'object' ? JSON.stringify(rule) : rule}</li> ))}</ul>
                                            </div>
                                    </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* --- Placeholder for Initial/Loading State (No changes needed here) --- */}
                     {scanStatus !== 'completed' && scanStatus !== 'error' && (
                         <div className="flex items-center justify-center text-center py-16 px-6 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-white [.dark_&]:bg-gray-800 min-h-[300px]">
                            {scanStatus === 'idle' &&
                                <div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                    <p className="mt-3 text-sm font-medium [.dark_&]:text-white">Scan results will appear here.</p>
                                    <p className="mt-1 text-xs [.dark_&]:text-white ">Enter a repository identifier and click "Start Scan".</p>
                                </div>
                            }
                            {scanStatus === 'scanning' &&
                                <div>
                                    <Spinner />
                                    <p className="mt-2 text-sm font-medium">Scanning repository...</p>
                                    <p className="mt-1 text-xs">This may take a few moments.</p>
                                </div>
                            }
                        </div>
                     )}
                    {/* --- Display Errors Card on Failed Scan (No changes needed here) --- */}
                     {scanStatus === 'error' && scanErrors.length > 0 && (
                         <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md rounded-lg mt-6">
                              <header className="px-4 py-3 border-b border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30">
                                  <h3 className="text-base font-semibold text-red-700 dark:text-red-300">Internal Scanner Errors ({scanErrors.length})</h3>
                              </header>
                              <div className="p-4 space-y-2">
                                    {scanErrors.map((err, index) => (
                                        <details key={index} className="border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-2 rounded group">
                                             <summary className="text-xs font-medium text-red-700 dark:text-red-300 cursor-pointer select-none list-none flex justify-between items-center">
                                                <span>Error {index + 1}: { typeof err === 'string' ? err.substring(0, 80)+'...' : (err?.ruleId || err?.message || 'Details below').substring(0,80)+'...' }</span>
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 ml-1 group-open:rotate-180 transition-transform flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                            </summary>
                                            <div className="mt-1.5 pt-1 border-t border-red-200 dark:border-red-700/50"><JsonDisplay data={err} /></div>
                                        </details>
                                    ))}
                               </div>
                          </section>
                     )}

                </div>
            </main>

             {/* --- Footer (No changes needed here) --- */}
             <footer className="flex-shrink-0 mt-auto py-4 px-4 md:px-6 bg-gray-200 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                    © {new Date().getFullYear()} Security Analysis Tool. Internal Use Only.
                    <span className="block sm:inline sm:ml-2 mt-1 sm:mt-0 text-yellow-600 dark:text-yellow-500 font-medium">
                       Note: API uses insecure HTTP.
                    </span>
                </p>
             </footer>

        </div> // End Overall Container
    );
};

export default RepoScanner;