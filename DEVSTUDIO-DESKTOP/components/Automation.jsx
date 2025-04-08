'use client';

import React, { useState, useCallback, useMemo , useRef , useEffect } from 'react';
import {
    FiPlay,      // Run
    FiSquare,    // Stop
    FiCheckCircle, // Success
    FiXCircle,   // Failure
    FiLoader,    // Running / Loading
    FiTerminal,  // Logs / Output
    FiSettings,  // Configuration (Placeholder)
    FiTrash2,    // Clear Logs
    FiInfo,      // Idle / Info
    FiZap        // Generic Automation Icon
} from 'react-icons/fi';

// --- Mock Data and Functions (Replace with your actual automation logic) ---

// Example Automation Structure
const initialAutomations = [
    {
        id: 'lint-format',
        name: 'Lint & Format',
        description: 'Check code style and apply formatting rules.',
        status: 'idle', // 'idle', 'running', 'success', 'failed'
        lastRun: null, // { timestamp: Date, durationMs: number } | null
        logs: [], // Array of log lines { timestamp: Date, message: string, type: 'stdout' | 'stderr' | 'info' }
    },
    {
        id: 'unit-tests',
        name: 'Run Unit Tests',
        description: 'Execute Jest/Vitest unit tests.',
        status: 'idle',
        lastRun: null,
        logs: [],
    },
    {
        id: 'build-project',
        name: 'Build Project',
        description: 'Compile the project for production.',
        status: 'idle',
        lastRun: null,
        logs: [],
    },
    {
        id: 'deploy-staging',
        name: 'Deploy to Staging',
        description: 'Deploy the current branch to the staging environment.',
        status: 'failed', // Example initial state
        lastRun: { timestamp: new Date(Date.now() - 3600000), durationMs: 45000 },
        logs: [
            { timestamp: new Date(Date.now() - 3600000), message: 'Deployment started...', type: 'info'},
            { timestamp: new Date(Date.now() - 3590000), message: 'Error: Missing environment variable XYZ', type: 'stderr'},
            { timestamp: new Date(Date.now() - 3580000), message: 'Deployment failed.', type: 'info'},
        ],
    },
];

// Mock function to simulate running an automation
const simulateAutomationRun = async (automationId, updateLog, setStatus) => {
    setStatus('running');
    updateLog(`Starting ${automationId}...`, 'info');
    await new Promise(res => setTimeout(res, 1000)); // Simulate work

    updateLog('Step 1: Preparing environment...', 'stdout');
    await new Promise(res => setTimeout(res, 1500));

    // Simulate potential failure
    const shouldFail = Math.random() < 0.3 && automationId !== 'lint-format'; // 30% chance to fail (except lint)
    if (shouldFail) {
        updateLog('Error: Task failed unexpectedly!', 'stderr');
        await new Promise(res => setTimeout(res, 500));
        updateLog('Automation run failed.', 'info');
        setStatus('failed');
        return false; // Indicate failure
    }

    updateLog('Step 2: Executing core task...', 'stdout');
    await new Promise(res => setTimeout(res, 2000));

    updateLog('Step 3: Finalizing...', 'stdout');
     await new Promise(res => setTimeout(res, 1000));

    updateLog('Automation completed successfully.', 'info');
    setStatus('success');
    return true; // Indicate success
};

// --- Helper Components ---

const StatusIcon = ({ status }) => {
    switch (status) {
        case 'running':
            return <FiLoader className="animate-spin text-blue-500" size={16} title="Running..." />;
        case 'success':
            return <FiCheckCircle className="text-green-500" size={16} title="Success" />;
        case 'failed':
            return <FiXCircle className="text-red-500" size={16} title="Failed" />;
        case 'idle':
        default:
            return <FiInfo className="text-gray-400 dark:text-gray-500" size={16} title="Idle" />;
    }
};

const AutomationItem = React.memo(({ automation, onRun, onSelect, isSelected, isAnyRunning }) => {
    const { id, name, description, status, lastRun } = automation;
    const isRunning = status === 'running';
    const canRun = status !== 'running' && !isAnyRunning; // Prevent running multiple concurrently (simplification)

    const handleRunClick = (e) => {
        e.stopPropagation(); // Prevent selection when clicking run
        if (canRun) {
            onRun(id);
        }
    };

    const formatDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    }

    return (
        <li
            onClick={() => onSelect(id)}
            className={`p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
            key={id}
        >
            <div className="flex items-center justify-between space-x-3">
                {/* Left side: Icon, Name, Description */}
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <FiZap size={18} className="text-purple-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{description}</p>
                    </div>
                </div>

                {/* Right side: Status, Last Run, Actions */}
                <div className="flex items-center space-x-3 flex-shrink-0">
                     {lastRun && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 hidden md:inline" title={`Last run: ${lastRun.timestamp.toLocaleString()}`}>
                           {formatDuration(lastRun.durationMs)}
                        </span>
                    )}
                    <StatusIcon status={status} />
                    <button
                        onClick={handleRunClick}
                        disabled={!canRun}
                        className={`p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        title={canRun ? "Run Automation" : (isRunning ? "Running..." : "Another task is running")}
                    >
                       { isRunning ? <FiSquare size={16} /> : <FiPlay size={16} />}
                    </button>
                    {/* Placeholder for config button */}
                    {/* <button className="p-1 rounded text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-500">
                        <FiSettings size={14} />
                    </button> */}
                </div>
            </div>
        </li>
    );
});
AutomationItem.displayName = 'AutomationItem'; // Add display name


// --- Main Automation Tab Component ---

const AutomationTab = () => {
    const [automations, setAutomations] = useState(initialAutomations);
    const [selectedAutomationId, setSelectedAutomationId] = useState(null);
    const logContainerRef = useRef(null); // To scroll logs

    const isAnyRunning = useMemo(() => automations.some(a => a.status === 'running'), [automations]);

    const selectedAutomation = useMemo(() => {
        return automations.find(a => a.id === selectedAutomationId) || null;
    }, [automations, selectedAutomationId]);

     // Scroll to bottom when logs change for the selected automation
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [selectedAutomation?.logs]);

    const updateAutomationState = useCallback((id, updates) => {
        setAutomations(prev =>
            prev.map(a => (a.id === id ? { ...a, ...updates } : a))
        );
    }, []);

    const addLog = useCallback((id, message, type = 'stdout') => {
        const newLogEntry = { timestamp: new Date(), message, type };
        setAutomations(prev =>
            prev.map(a =>
                a.id === id
                    ? { ...a, logs: [...a.logs, newLogEntry] }
                    : a
            )
        );
    }, []);


    const handleRunAutomation = useCallback(async (id) => {
        const startTime = Date.now();
        // Select the automation being run if not already selected
        setSelectedAutomationId(id);

        // Clear previous logs for this run
        updateAutomationState(id, { logs: [], status: 'running', lastRun: null });

        const updateLogCallback = (message, type) => addLog(id, message, type);
        const setStatusCallback = (status) => updateAutomationState(id, { status });

        try {
            await simulateAutomationRun(id, updateLogCallback, setStatusCallback);
            // Status is set inside simulateAutomationRun
            const durationMs = Date.now() - startTime;
             updateAutomationState(id, {
                lastRun: { timestamp: new Date(startTime), durationMs }
            });

        } catch (error) {
            console.error(`Error running automation ${id}:`, error);
            addLog(id, `Client-side error running task: ${error.message}`, 'stderr');
            const durationMs = Date.now() - startTime;
            updateAutomationState(id, {
                status: 'failed',
                lastRun: { timestamp: new Date(startTime), durationMs }
            });
        }
    }, [updateAutomationState, addLog]);


    const handleSelectAutomation = useCallback((id) => {
        setSelectedAutomationId(id);
    }, []);

    const handleClearLogs = useCallback(() => {
        if (selectedAutomationId) {
            updateAutomationState(selectedAutomationId, { logs: [] });
        }
    }, [selectedAutomationId, updateAutomationState]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
                <h2 className="text-base font-semibold flex items-center">
                    <FiZap className="mr-2 text-purple-500" /> Automation Tasks
                </h2>
            </div>

            {/* Automation List */}
            <div className="overflow-y-auto flex-shrink-0 border-b border-gray-200 dark:border-gray-700 max-h-60 md:max-h-none md:flex-1"> {/* Limit height on small screens */}
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {automations.length > 0 ? (
                        automations.map(auto => (
                            <AutomationItem
                                key={auto.id}
                                automation={auto}
                                onRun={handleRunAutomation}
                                onSelect={handleSelectAutomation}
                                isSelected={selectedAutomationId === auto.id}
                                isAnyRunning={isAnyRunning}
                            />
                        ))
                    ) : (
                        <li className="p-4 text-sm text-center text-gray-500 dark:text-gray-400">
                            No automations configured.
                        </li>
                    )}
                </ul>
            </div>

            {/* Log Output Area */}
            <div className="flex-1 flex flex-col min-h-0"> {/* Ensures log area takes remaining space */}
                <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-sm font-semibold flex items-center">
                        <FiTerminal className="mr-2 text-gray-500 dark:text-gray-400" />
                        Output: {selectedAutomation ? selectedAutomation.name : 'No Task Selected'}
                        {selectedAutomation && <span className="ml-2"><StatusIcon status={selectedAutomation.status} /></span>}
                    </h3>
                    <button
                        onClick={handleClearLogs}
                        disabled={!selectedAutomation || selectedAutomation.logs.length === 0}
                        className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500"
                        title="Clear Logs"
                    >
                        <FiTrash2 size={14} />
                    </button>
                </div>
                <div ref={logContainerRef} className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-3 font-mono text-xs">
                    {selectedAutomation && selectedAutomation.logs.length > 0 ? (
                        selectedAutomation.logs.map((log, index) => (
                            <div key={index} className={`whitespace-pre-wrap break-words ${log.type === 'stderr' ? 'text-red-500 dark:text-red-400' : log.type === 'info' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                {/* Optional Timestamp */}
                                {/* <span className="text-gray-400 dark:text-gray-500 mr-2">{log.timestamp.toLocaleTimeString()}</span> */}
                                {log.message}
                            </div>
                        ))
                    ) : (
                        <div className="text-sm text-center text-gray-400 dark:text-gray-500 h-full flex items-center justify-center">
                            {selectedAutomationId ? 'No output for this task yet.' : 'Select an automation task to view its output.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AutomationTab;