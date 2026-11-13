const { join } = require("path");

// Keep Chrome inside the project so App Hosting ships it with the server bundle.
module.exports = {
    cacheDirectory: join(__dirname, ".cache", "puppeteer"),
    "chrome-headless-shell": {
        skipDownload: true
    }
};
