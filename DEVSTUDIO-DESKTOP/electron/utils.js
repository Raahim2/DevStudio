function safeSend(webContents, channel, ...args) {
    if (webContents && !webContents.isDestroyed()) {
        webContents.send(channel, ...args);
    }
}

const successResponse = (data = null) => ({ success: true, data });

const errorResponse = (message, errorObj = null) => {
    const errorMessage = message || 'An unknown error occurred.';
    console.error(`[IPC Error] ${errorMessage}`, errorObj || '');
    return { success: false, error: errorMessage };
};

module.exports = {
    safeSend,
    successResponse,
    errorResponse,
};