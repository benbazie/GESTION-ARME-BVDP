const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// GET /photos/:idVolontaire
router.get('/:idVolontaire', async (req, res) => {
    const idVolontaire = parseInt(req.params.idVolontaire, 10);
    if (isNaN(idVolontaire)) return res.status(400).json({ error: 'id_volontaire invalide' });

    try {
        const result = await pool.query(
            'SELECT photo, etag, last_modified FROM volontaire_photo WHERE id_volontaire = $1',
            [idVolontaire]
        );

        if (!result.rows.length) return res.status(404).json({ error: 'Photo introuvable' });

        const { photo, etag, last_modified } = result.rows[0];

        if (etag) res.setHeader('ETag', etag);
        if (last_modified) res.setHeader('Last-Modified', new Date(last_modified).toUTCString());
        res.setHeader('Cache-Control', 'private, max-age=86400');

        const clientEtag = req.headers['if-none-match'];
        if (clientEtag && clientEtag === etag) return res.status(304).end();

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', photo.length);
        res.send(photo);
    } catch (err) {
        console.error('[photos]', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
