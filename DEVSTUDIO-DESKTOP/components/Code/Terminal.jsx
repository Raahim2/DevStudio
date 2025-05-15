'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

// Constants
const lightTheme = {
    background: '#ffffff', foreground: '#333333', cursor: '#333333', cursorAccent: '#ffffff',
    selectionBackground: 'rgba(173, 216, 230, 0.6)', black: '#000000', red: '#cd3131',
    green: '#0dbc79', yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc',
    cyan: '#11a8cd', white: '#e5e5e5', brightBlack: '#666666', brightRed: '#f14c4c',
    brightGreen: '#23d18b', brightYellow: '#f5f543', brightBlue: '#3b8eea',
    brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#ffffff'
};
const PROMPT_PREFIX = '\x1b[38;5;244mPS \x1b[0m';
const PROMPT_CWD_COLOR = '\x1b[34m';
const PROMPT_SUFFIX = '\x1b[38;5;238m>\x1b[0m ';
const RESET_COLOR = '\x1b[0m';

const TerminalComponent = ({ rootDir, isVisible }) => {
    const [currentDir, setCurrentDir] = useState(() => rootDir || window.electronAPI?.getHomeDir() || '~');
    const [isProcessing, setIsProcessing] = useState(false);

    const terminalHostRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const commandHistory = useRef([]);
    const historyIndex = useRef(-1);
    const isTerminalInitialized = useRef(false);
    const currentLineRef = useRef('');

    const writePrompt = useCallback((term, cwd) => {
        if (!term) return;
        term.write(`\r${PROMPT_PREFIX}${PROMPT_CWD_COLOR}${cwd}${PROMPT_SUFFIX}${RESET_COLOR}`);
    }, []);

    const fitTerminal = useCallback(() => {
        if (fitAddonRef.current && xtermRef.current && terminalHostRef.current?.clientHeight > 0) {
            try {
                fitAddonRef.current.fit();
                if (xtermRef.current && !isProcessing) {
                     xtermRef.current.scrollToBottom();
                }
            } catch (e) {
                console.error("fitTerminal Error:", e);
            }
        }
    }, [isProcessing]);

    useEffect(() => { // ONE-TIME Initialization and Cleanup
        if (!terminalHostRef.current || !window.electronAPI) {
            if (terminalHostRef.current && !window.electronAPI) {
                 terminalHostRef.current.innerHTML = '<div style="padding: 10px; color: red;">Error: Electron API not available. Terminal cannot function.</div>';
            }
            return;
        }
        if (terminalHostRef.current.querySelector('div[style*="color: red"]')) {
            terminalHostRef.current.innerHTML = '';
        }

        console.log("TerminalComponent: Initializing XTerm instance");

        const term = new XTerm({
            cursorBlink: true, cursorStyle: 'block',
            fontFamily: 'Menlo, "DejaVu Sans Mono", Consolas, "Lucida Console", monospace',
            fontSize: 13, theme: lightTheme, convertEol: true,
            windowsMode: process.platform === 'win32', allowProposedApi: true,
        });
        const fitAddon = new FitAddon();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;
        term.loadAddon(fitAddon);
        term.open(terminalHostRef.current);
        isTerminalInitialized.current = true;
        currentLineRef.current = '';

        writePrompt(term, currentDir);
        if (isVisible) term.focus(); // Focus if initially visible

        const focusTerminal = () => { if(xtermRef.current && isVisible) xtermRef.current.focus();};
        const currentTerminalHost = terminalHostRef.current;
        currentTerminalHost.addEventListener('focusin', focusTerminal);

        const handleData = (data) => {
            const termInstance = xtermRef.current;
            if (!termInstance || isProcessing) return;

            if (data === '\x03') {
               termInstance.write('^C\r\n');
               window.electronAPI.killProcess();
               return;
           }

           const code = data.charCodeAt(0);
            if (code === 13) {
                const command = currentLineRef.current.trim();
                termInstance.write('\r\n');
               if (command) {
                    if (!commandHistory.current.length || commandHistory.current[commandHistory.current.length - 1] !== command) {
                        commandHistory.current.push(command);
                    }
                    historyIndex.current = commandHistory.current.length;

                   if (command === 'clear' || command === 'cls') {
                        termInstance.clear();
                        currentLineRef.current = '';
                        writePrompt(termInstance, currentDir);
                   } else {
                       setIsProcessing(true);
                       window.electronAPI.executeCommand({ command: command, cwd: currentDir });
                       currentLineRef.current = '';
                   }
               } else {
                   writePrompt(termInstance, currentDir);
               }
            } else if (code === 127 || code === 8) {
                if (currentLineRef.current.length > 0) {
                    termInstance.write('\b \b');
                    currentLineRef.current = currentLineRef.current.slice(0, -1);
                }
            } else if (code === 27) {
               const clearCurrentTypedLineForHistory = () => {
                   for (let i = 0; i < currentLineRef.current.length; i++) termInstance.write('\b \b');
               };

               if (data === '\x1b[A') { // Up
                   if (commandHistory.current.length > 0 && historyIndex.current > 0) {
                        historyIndex.current--;
                        const prevCommand = commandHistory.current[historyIndex.current];
                        clearCurrentTypedLineForHistory();
                        termInstance.write(prevCommand);
                        currentLineRef.current = prevCommand;
                    }
               } else if (data === '\x1b[B') { // Down
                   if (historyIndex.current < commandHistory.current.length - 1) {
                        historyIndex.current++;
                        const nextCommand = commandHistory.current[historyIndex.current];
                        clearCurrentTypedLineForHistory();
                        termInstance.write(nextCommand);
                        currentLineRef.current = nextCommand;
                   } else if (historyIndex.current === commandHistory.current.length - 1) {
                       historyIndex.current++;
                       clearCurrentTypedLineForHistory();
                       currentLineRef.current = '';
                   }
               }
            } else if (code >= 32 || data === '\t') {
               currentLineRef.current += data;
               termInstance.write(data);
           }
        };
        const dataListener = term.onData(handleData);

        const handleOutput = (outputData) => { if (xtermRef.current) xtermRef.current.write(outputData); };
        const handleFinish = () => {
            setIsProcessing(false);
            if (xtermRef.current) {
                 writePrompt(xtermRef.current, currentDir);
                 if (isVisible) xtermRef.current.focus();
            }
        };
        const handleCwdChanged = (newCwd) => { setCurrentDir(newCwd); };
        const handleClear = () => {
             if (xtermRef.current) {
                 xtermRef.current.clear();
                 if (!isProcessing) writePrompt(xtermRef.current, currentDir);
             }
        };

       const removeOutputListener = window.electronAPI.onOutput(handleOutput);
       const removeFinishListener = window.electronAPI.onFinish(handleFinish);
       const removeCwdListener = window.electronAPI.onCwdChanged(handleCwdChanged);
       const removeClearListener = window.electronAPI.onClear(handleClear);

       const resizeObserver = new ResizeObserver(() => { if (isVisible) fitTerminal(); });
       resizeObserver.observe(currentTerminalHost);

        return () => { // Cleanup on unmount
            console.log("TerminalComponent: Unmounting and disposing XTerm instance");
            resizeObserver.disconnect();
            removeOutputListener(); removeFinishListener(); removeCwdListener(); removeClearListener();
            dataListener?.dispose();
            currentTerminalHost.removeEventListener('focusin', focusTerminal);
            if (xtermRef.current) {
                xtermRef.current.dispose();
                xtermRef.current = null;
            }
            fitAddonRef.current = null;
            isTerminalInitialized.current = false;
            if (currentTerminalHost) currentTerminalHost.innerHTML = '';
        };
    }, []); // Empty array: runs once on mount, cleanup on unmount

    useEffect(() => { // Handle isVisible changes
        if (isTerminalInitialized.current && xtermRef.current) {
            if (isVisible) {
                // terminalHostRef.current.style.display = ''; // Parent handles display
                fitTerminal();
                xtermRef.current.focus();
                xtermRef.current.scrollToBottom();
            }
        }
    }, [isVisible, fitTerminal]);

    useEffect(() => { // Handle currentDir (CWD) changes
        if (isTerminalInitialized.current && xtermRef.current && !isProcessing) {
            writePrompt(xtermRef.current, currentDir);
            if (isVisible) xtermRef.current.focus();
        }
    }, [currentDir, isProcessing, isVisible, writePrompt]);

    useEffect(() => { // Handle external rootDir prop changes
        if (rootDir && rootDir !== currentDir) {
            if (!isProcessing) {
                setCurrentDir(rootDir);
                currentLineRef.current = '';
            } else {
                console.warn(`TerminalComponent: rootDir changed to ${rootDir}, but command processing. CWD change deferred.`);
            }
        }
    }, [rootDir, currentDir, isProcessing]);

    useEffect(() => { // Window resize events
        let resizeFitTimeoutId;
        const debouncedFitTerminal = () => {
            clearTimeout(resizeFitTimeoutId);
            resizeFitTimeoutId = setTimeout(fitTerminal, 150);
        };

        if (isVisible && isTerminalInitialized.current) {
             const initialFitTimeoutId = setTimeout(fitTerminal, 50); // Fit after becoming visible
             window.addEventListener('resize', debouncedFitTerminal);
             return () => {
                 clearTimeout(initialFitTimeoutId);
                 clearTimeout(resizeFitTimeoutId);
                 window.removeEventListener('resize', debouncedFitTerminal);
             };
         }
         return () => { clearTimeout(resizeFitTimeoutId); };
    }, [isVisible, fitTerminal]);

    return (
        <div 
            className="bg-white h-full w-full overflow-hidden p-1 border border-gray-200 dark:border-gray-300 rounded flex flex-col" 
            tabIndex={-1}
        >  
            <div ref={terminalHostRef} className="w-full flex-grow min-h-0" />
        </div>
    );
};

export default memo(TerminalComponent);