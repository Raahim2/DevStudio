const os = require('os');
const path = require('path');
const fsc = require('fs');
const { spawn } = require('child_process');
const { safeSend } = require('../utils');

let termChildProcess = null;
let termSenderWebContents = null;
let killTimeoutId = null;

function cleanupTerminalProcess() {
    if (termChildProcess) {
        console.log('[Terminal Cleanup] Attempting to kill active terminal process:', termChildProcess.pid);
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', termChildProcess.pid.toString(), '/f', '/t']);
        } else {
            termChildProcess.kill('SIGKILL');
        }
        termChildProcess = null;
        if (killTimeoutId) {
            clearTimeout(killTimeoutId);
            killTimeoutId = null;
        }
    }
}

function setupTerminalHandlers(ipcMain) {
    ipcMain.on('terminal:execute', (event, { command, cwd }) => {
        termSenderWebContents = event.sender;

        if (termChildProcess) {
            safeSend(termSenderWebContents, 'terminal:output', '\r\n\x1b[31m[Error: Another command is already running.]\x1b[0m\r\n');
            safeSend(termSenderWebContents, 'terminal:finish', 1);
            return;
        }

        const currentCwd = cwd || os.homedir();

        if (command.trim().startsWith('cd ')) {
            const targetDir = command.trim().substring(3).trim();
            let newCwd;
            try {
                const resolvedTarget = path.resolve(currentCwd, targetDir);
                if (!fsc.existsSync(resolvedTarget) || !fsc.statSync(resolvedTarget).isDirectory()) {
                    throw new Error(`cd: no such file or directory: ${targetDir}`);
                }
                newCwd = resolvedTarget;
                safeSend(termSenderWebContents, 'terminal:cwd-changed', newCwd);
                safeSend(termSenderWebContents, 'terminal:finish', 0);
            } catch (error) {
                safeSend(termSenderWebContents, 'terminal:output', `\r\n\x1b[31m[Error: ${error.message}]\x1b[0m\r\n`);
                safeSend(termSenderWebContents, 'terminal:finish', 1);
            }
            return;
        }

        if (command.trim() === 'clear' || command.trim() === 'cls') {
            safeSend(termSenderWebContents, 'terminal:clear');
            safeSend(termSenderWebContents, 'terminal:finish', 0);
            return;
        }

        const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
        const executable = parts[0];
        const args = parts.slice(1).map(arg => arg.replace(/^['"]|['"]$/g, ''));

        if (!executable) {
            safeSend(termSenderWebContents, 'terminal:finish', 0);
            return;
        }

        try {
            const useShell = os.platform() === 'win32' || command.includes('|') || command.includes('>') || command.includes('<') || command.includes('&&') || command.includes('||');
            termChildProcess = spawn(executable, args, {
                cwd: currentCwd,
                env: { ...process.env },
                shell: useShell,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            const pid = termChildProcess.pid;

            termChildProcess.stdout.on('data', (data) => {
                safeSend(termSenderWebContents, 'terminal:output', data.toString());
            });

            termChildProcess.stderr.on('data', (data) => {
                safeSend(termSenderWebContents, 'terminal:output', data.toString());
            });

            let alreadyClosed = false;
            const handleExitOrError = (type, codeOrError) => {
                if (alreadyClosed) return;
                alreadyClosed = true;
                clearTimeout(killTimeoutId);
                killTimeoutId = null;
                if (type === 'close') {
                    safeSend(termSenderWebContents, 'terminal:finish', codeOrError === null ? 1 : codeOrError);
                } else if (type === 'error') {
                    safeSend(termSenderWebContents, 'terminal:output', `\r\n\x1b[31m[Error: ${codeOrError.message}]\x1b[0m\r\n`);
                    safeSend(termSenderWebContents, 'terminal:finish', 1);
                }
                termChildProcess = null;
            };

            termChildProcess.on('close', (code) => handleExitOrError('close', code));
            termChildProcess.on('error', (err) => handleExitOrError('error', err));

        } catch (error) {
            safeSend(termSenderWebContents, 'terminal:output', `\r\n\x1b[31m[Error: Failed to start command - ${error.message}]\x1b[0m\r\n`);
            safeSend(termSenderWebContents, 'terminal:finish', 1);
            termChildProcess = null;
        }
    });

    ipcMain.on('terminal:kill', (event) => {
        const killerWebContents = event.sender;
        if (termChildProcess) {
            const pidToKill = termChildProcess.pid;
            if (killTimeoutId) {
                clearTimeout(killTimeoutId);
                killTimeoutId = null;
            }
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', pidToKill.toString(), '/f', '/t'])
                    .on('error', (err) => { console.error("Error taskkill:", err); })
                    .on('exit', () => { console.log("Taskkill exited for:", pidToKill); });
            } else {
                termChildProcess.kill('SIGINT');
            }
            killTimeoutId = setTimeout(() => {
                if (termChildProcess && termChildProcess.pid === pidToKill) {
                    if (process.platform !== 'win32') {
                        termChildProcess.kill('SIGKILL');
                    }
                    if (termChildProcess && termChildProcess.pid === pidToKill) {
                        termChildProcess = null;
                        safeSend(termSenderWebContents, 'terminal:output', '\r\n\x1b[33m[Warning: Process forcefully terminated.]\x1b[0m\r\n');
                        safeSend(termSenderWebContents, 'terminal:finish', -1);
                        if (killerWebContents && termSenderWebContents && killerWebContents.id !== termSenderWebContents.id) {
                            safeSend(killerWebContents, 'terminal:output', '\r\n\x1b[33m[Info: Process kill confirmed (forced).]\x1b[0m\r\n');
                            safeSend(killerWebContents, 'terminal:finish', -1);
                        } else if (killerWebContents && !termSenderWebContents) {
                           safeSend(killerWebContents, 'terminal:output', '\r\n\x1b[33m[Info: Process kill confirmed (forced).]\x1b[0m\r\n');
                           safeSend(killerWebContents, 'terminal:finish', -1);
                        }
                    }
                }
                killTimeoutId = null;
            }, 2000);
        } else {
            safeSend(killerWebContents, 'terminal:finish', 0);
        }
    });
}

module.exports = { setupTerminalHandlers, cleanupTerminalProcess };