const express = require('express');
const { startCron } = require('./jobs/syncJob');
const photosRouter = require('./routes/photos');

const app = express();

app.use('/photos', photosRouter);

startCron();

app.listen(3000, () => {
    console.log("🚀 Sync service running");
});
