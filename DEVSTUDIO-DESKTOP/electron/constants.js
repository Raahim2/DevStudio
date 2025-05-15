const path = require('path');

module.exports = {
    APP_PROTOCOL: 'devstudio',
    WEBSITE_LOGIN_URL: 'http://devstudio-ai.vercel.app/api/auth/github/login',
    INDEX_HTML_PATH: path.join(__dirname, '..', 'out', 'index.html'),
    ICON_PATH: path.join(__dirname, '..', 'assets', 'icon.png'),
    LOCAL_HOST_URL: 'http://localhost:3000',
};