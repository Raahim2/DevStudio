'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

const lightTheme = {
    background: '#f8f8ff', foreground: '#333333', cursor: '#333333', cursorAccent: '#ffffff',
    selectionBackground: 'rgba(173, 216, 230, 0.6)', black: '#000000', red: '#cd3131',
    green: '#0dbc79', yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc',
    cyan: '#11a8cd', white: '#e5e5e5', brightBlack: '#666666', brightRed: '#f14c4c',
    brightGreen: '#23d18b', brightYellow: '#f5f543', brightBlue: '#3b8eea',
    brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#ffffff'
};

const darkTheme = {
    background: '#2e2e2e', foreground: '#d4d4d4', cursor: '#ffffff', cursorAccent: '#1e1e1e',
    selectionBackground: 'rgba(255, 255, 255, 0.3)', black: '#000000', red: '#ff5555',
    green: '#50fa7b', yellow: '#f1fa8c', blue: '#bd93f9', magenta: '#ff79c6',
    cyan: '#8be9fd', white: '#f8f8f2', brightBlack: '#6272a4', brightRed: '#ff6e6e',
    brightGreen: '#69ff94', brightYellow: '#ffffa5', brightBlue: '#d6acff',
    brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff'
};

const PROMPT_PREFIX = '\x1b[38;5;244mPS \x1b[0m';
const PROMPT_CWD_COLOR = '\x1b[34m';
const PROMPT_SUFFIX = '\x1b[38;5;238m>\x1b[0m ';
const RESET_COLOR = '\x1b[0m';

const TerminalComponent = ({ rootDir, isVisible, isDarkMode }) => {
    const [currentDir, setCurrentDir] = useState(() => rootDir || (typeof window !== 'undefined' && window.electronAPI?.getHomeDir()) || '~');
    const [isProcessing, setIsProcessing] = useState(false);

    const terminalHostRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const webLinksAddonRef = useRef(null);
    const commandHistory = useRef([]);
    const historyIndex = useRef(-1);
    const isTerminalInitialized = useRef(false);
    const currentLineRef = useRef('');

    const currentDirRef = useRef(currentDir);
    const isProcessingRef = useRef(isProcessing);
    const isVisibleRef = useRef(isVisible);

    useEffect(() => { currentDirRef.current = currentDir; }, [currentDir]);
    useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
    useEffect(() => { isVisibleRef.current = isVisible; }, [isVisible]);

    useEffect(() => {
        if (xtermRef.current) {
            const newXTermThemeObject = isDarkMode ? darkTheme : lightTheme;
            if (xtermRef.current.options.theme !== newXTermThemeObject) {
                 xtermRef.current.options.theme = newXTermThemeObject;
            }
        }
    }, [isDarkMode]);

    const writePrompt = useCallback((term, cwd) => {
        if (!term) return;
        term.write(`\r${PROMPT_PREFIX}${PROMPT_CWD_COLOR}${cwd}${PROMPT_SUFFIX}${RESET_COLOR}`);
    }, []);

    const fitTerminal = useCallback(() => {
        if (fitAddonRef.current && xtermRef.current && terminalHostRef.current?.clientHeight > 0) {
            try {
                fitAddonRef.current.fit();
                if (xtermRef.current && !isProcessingRef.current) {
                     xtermRef.current.scrollToBottom();
                }
            } catch (e) {
                console.error("fitTerminal Error:", e);
            }
        }
    }, []);

    useEffect(() => {
        if (!terminalHostRef.current || (typeof window !== 'undefined' && !window.electronAPI)) {
            if (terminalHostRef.current && (typeof window !== 'undefined' && !window.electronAPI)) {
                 terminalHostRef.current.innerHTML = '<div style="padding: 10px; color: red;">Error: Electron API not available. Terminal cannot function.</div>';
            }
            return;
        }
        if (terminalHostRef.current.querySelector('div[style*="color: red"]')) {
            terminalHostRef.current.innerHTML = '';
        }

        const currentTermThemeObject = isDarkMode ? darkTheme : lightTheme;

        const term = new XTerm({
            cursorBlink: true, cursorStyle: 'block',
            fontFamily: 'Menlo, "DejaVu Sans Mono", Consolas, "Lucida Console", monospace',
            fontSize: 15, theme: currentTermThemeObject, convertEol: true,
            windowsMode: typeof process !== 'undefined' && process.platform === 'win32',
            allowProposedApi: true,
        });
        
        const fitAddon = new FitAddon();
        const handleLinkOpen = (event, uri) => {
            event.preventDefault();
            if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.openExternalLink) {
                window.electronAPI.openExternalLink(uri);
            } else {
                console.warn('electronAPI.openExternalLink is not available. Cannot open link:', uri);
            }
        };
        const webLinksAddon = new WebLinksAddon(handleLinkOpen);

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;
        webLinksAddonRef.current = webLinksAddon;

        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);
        
        if (!terminalHostRef.current) {
            term.dispose();
            return;
        }
        term.open(terminalHostRef.current);
        isTerminalInitialized.current = true;
        currentLineRef.current = '';

        writePrompt(term, currentDirRef.current);
        if (isVisibleRef.current) term.focus();

        const focusTerminal = () => { if(xtermRef.current && isVisibleRef.current) xtermRef.current.focus();};
        const currentTerminalHostForCleanup = terminalHostRef.current;
        currentTerminalHostForCleanup.addEventListener('focusin', focusTerminal);
        
        term.attachCustomKeyEventHandler((event) => {
            const { ctrlKey, shiftKey, metaKey, key, type } = event;

            if (type === 'keydown') {
                if ((ctrlKey || metaKey) && shiftKey && key.toLowerCase() === 'c') {
                    const selection = term.getSelection();
                    if (selection) {
                        navigator.clipboard.writeText(selection).catch(err => {
                            console.error('Failed to copy to clipboard:', err);
                        });
                    }
                    return false;
                }

                if ((ctrlKey || metaKey) && !shiftKey && key.toLowerCase() === 'v') {
                    navigator.clipboard.readText().then(text => {
                        if (text) {
                            term.paste(text);
                        }
                    }).catch(err => {
                        console.error('Failed to read from clipboard:', err);
                    });
                    return false;
                }
                
                if ((ctrlKey || metaKey) && !shiftKey && key.toLowerCase() === 'c') {
                    return true; 
                }
            }
            return true;
        });

        const handleData = (data) => {
            const termInstance = xtermRef.current;
            if (!termInstance || isProcessingRef.current) return;

            if (data === '\x03') {
               termInstance.write('^C\r\n');
               if (typeof window !== 'undefined' && window.electronAPI) window.electronAPI.killProcess();
               return;
            }

            if (data.charCodeAt(0) === 27 && data.length > 1) {
                if (data === '\x1b[A') {
                    if (commandHistory.current.length > 0 && historyIndex.current > 0) {
                        historyIndex.current--;
                        const prevCommand = commandHistory.current[historyIndex.current];
                        termInstance.write('\x1b[2K\r');
                        writePrompt(termInstance, currentDirRef.current);
                        termInstance.write(prevCommand);
                        currentLineRef.current = prevCommand;
                    }
                    return;
                } else if (data === '\x1b[B') {
                    if (historyIndex.current < commandHistory.current.length - 1) {
                        historyIndex.current++;
                        const nextCommand = commandHistory.current[historyIndex.current];
                        termInstance.write('\x1b[2K\r');
                        writePrompt(termInstance, currentDirRef.current);
                        termInstance.write(nextCommand);
                        currentLineRef.current = nextCommand;
                    } else if (historyIndex.current === commandHistory.current.length - 1) {
                       historyIndex.current++;
                       termInstance.write('\x1b[2K\r');
                       writePrompt(termInstance, currentDirRef.current);
                       currentLineRef.current = '';
                   }
                   return;
                }
            }
            
            for (let i = 0; i < data.length; i++) {
                const char = data[i];
                const code = char.charCodeAt(0);

                if (code === 13) {
                    termInstance.write('\r\n');
                    const command = currentLineRef.current.trim();
                    if (command) {
                        if (!commandHistory.current.length || commandHistory.current[commandHistory.current.length - 1] !== command) {
                            commandHistory.current.push(command);
                        }
                        historyIndex.current = commandHistory.current.length;

                        if (command === 'clear' || command === 'cls') {
                            termInstance.clear();
                            writePrompt(termInstance, currentDirRef.current);
                        } else {
                            setIsProcessing(true);
                            if (typeof window !== 'undefined' && window.electronAPI) {
                                window.electronAPI.executeCommand({ command: command, cwd: currentDirRef.current });
                            }
                        }
                    } else {
                        writePrompt(termInstance, currentDirRef.current);
                    }
                    currentLineRef.current = '';
                } else if (code === 127 || code === 8) {
                    if (currentLineRef.current.length > 0) {
                        currentLineRef.current = currentLineRef.current.slice(0, -1);
                        termInstance.write('\b \b');
                    }
                } else if (code === 9) {
                    currentLineRef.current += char;
                    termInstance.write(char);
                } else if (code >= 32) {
                    currentLineRef.current += char;
                    termInstance.write(char);
                }
            }
        };
        const dataListener = term.onData(handleData);

        const handleOutput = (outputData) => { if (xtermRef.current) xtermRef.current.write(outputData); };
        const handleFinish = () => {
            setIsProcessing(false);
            if (xtermRef.current) {
                 writePrompt(xtermRef.current, currentDirRef.current);
                 if (isVisibleRef.current) xtermRef.current.focus();
            }
        };
        const handleCwdChanged = (newCwd) => { setCurrentDir(newCwd); };
        const handleClear = () => {
             if (xtermRef.current) {
                 xtermRef.current.clear();
                 if (!isProcessingRef.current) writePrompt(xtermRef.current, currentDirRef.current);
             }
        };

       let removeOutputListener, removeFinishListener, removeCwdListener, removeClearListener;
       if (typeof window !== 'undefined' && window.electronAPI) {
           removeOutputListener = window.electronAPI.onOutput(handleOutput);
           removeFinishListener = window.electronAPI.onFinish(handleFinish);
           removeCwdListener = window.electronAPI.onCwdChanged(handleCwdChanged);
           removeClearListener = window.electronAPI.onClear(handleClear);
       }

       const resizeObserver = new ResizeObserver(() => { if (isVisibleRef.current) fitTerminal(); });
       if (currentTerminalHostForCleanup) resizeObserver.observe(currentTerminalHostForCleanup);

        return () => {
            if (currentTerminalHostForCleanup) {
                resizeObserver.unobserve(currentTerminalHostForCleanup);
                currentTerminalHostForCleanup.removeEventListener('focusin', focusTerminal);
            }
            resizeObserver.disconnect();
            if(removeOutputListener) removeOutputListener(); 
            if(removeFinishListener) removeFinishListener(); 
            if(removeCwdListener) removeCwdListener(); 
            if(removeClearListener) removeClearListener();
            dataListener?.dispose();
            
            if (xtermRef.current) {
                xtermRef.current.dispose();
                xtermRef.current = null;
            }
            isTerminalInitialized.current = false;
        };
    }, [isDarkMode, writePrompt, fitTerminal]);
                                                 
    useEffect(() => {
        if (isTerminalInitialized.current && xtermRef.current) {
            if (isVisible) {
                fitTerminal();
                if (xtermRef.current) {
                    xtermRef.current.focus();
                    xtermRef.current.scrollToBottom();
                }
            }
        }
    }, [isVisible, fitTerminal]);

    useEffect(() => {
        if (isTerminalInitialized.current && xtermRef.current && !isProcessing) {
            writePrompt(xtermRef.current, currentDir);
            if (isVisible && xtermRef.current) {
                xtermRef.current.focus();
            }
        }
    }, [currentDir, isProcessing, isVisible, writePrompt]);

    useEffect(() => {
        if (rootDir && rootDir !== currentDir) {
            if (!isProcessing) {
                setCurrentDir(rootDir);
                currentLineRef.current = '';
            } else {
                console.warn(`TerminalComponent: rootDir changed to ${rootDir}, but command processing. CWD change deferred.`);
            }
        }
    }, [rootDir, currentDir, isProcessing]);

    useEffect(() => {
        let resizeFitTimeoutId;
        const debouncedFitTerminal = () => {
            clearTimeout(resizeFitTimeoutId);
            resizeFitTimeoutId = setTimeout(fitTerminal, 150);
        };

        if (isVisible && isTerminalInitialized.current && typeof window !== 'undefined') {
             const initialFitTimeoutId = setTimeout(fitTerminal, 50);
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
            className="h-full w-full overflow-hidden p-1 rounded flex flex-col bg-transparent"
            tabIndex={-1}
        >  
            <div ref={terminalHostRef} className="w-full flex-grow min-h-0" />
        </div>
    );
};

export default memo(TerminalComponent);