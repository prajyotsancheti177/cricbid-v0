module.exports = {
    apps: [
        {
            name: "auction-app",         // A name for your app
            script: "./server/index.js",         // The entry point file (e.g., app.js or index.js)
            instances: 1,                // Or 'max' to scale to all CPU cores
            autorestart: true,           // Auto restart if it crashes
            watch: false,                // Set to true if you want PM2 to restart on file changes
        }
    ]
};
