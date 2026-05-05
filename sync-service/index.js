const express = require('express');
const { startCron } = require('./jobs/syncJob');

const app = express();

startCron();

app.listen(3000, () => {
    console.log("🚀 Sync service running");
});
