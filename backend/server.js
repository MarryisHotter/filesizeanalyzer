const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { Buffer } = require('buffer');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const execAsync = util.promisify(exec);
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

const ignorePaths = [
    '$Recycle.Bin',
    'System Volume Information',
    'pagefile.sys',
    'hiberfil.sys',
    'swapfile.sys',
    'DumpStack.log',
    'PerfLogs',
    '.lnk'
];

const supportedVideoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv'];

const isVideoFile = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    return supportedVideoExtensions.includes(ext);
};

const log = (message, ...args) => {
    console.log(`[${new Date().toISOString()}] ${message}`, ...args);
};

async function isValidPath(pathToCheck) {
    try {
        log('Checking path:', pathToCheck);
        await fs.access(pathToCheck);
        const stats = await fs.stat(pathToCheck);
        const isDir = stats.isDirectory();
        log('Path validation result:', { isDirectory: isDir, path: pathToCheck });
        return isDir;
    } catch (error) {
        log('Path validation failed:', error.message);
        return false;
    }
}

const shouldIgnorePath = (pathToCheck) => {
    return ignorePaths.some(ignorePath => 
        pathToCheck.includes(ignorePath) || 
        pathToCheck.match(/\$.*/) ||
        pathToCheck.endsWith('.lnk')  
    );
};

const normalizeDisplayName = (name) => {
    try {
        return name.replace(/[\u0000-\u001F\u0080-\uFFFF]/g, '?');
    } catch (error) {
        log('Name normalization error:', error.message);
        return name;
    }
};

const getShortPathName = async (longPath) => {
    try {
        const { stdout } = await execPromise(`cmd /c for %I in ("${longPath}") do @echo %~sI`);
        return stdout.trim();
    } catch (error) {
        throw new Error(`Failed to get short path: ${error.message}`);
    }
};

const attemptFileAccess = async (filePath) => {
    try {
        try {
            return await fs.stat(filePath);
        } catch (e) {
            const shortPath = await getShortPathName(filePath);
            if (shortPath && shortPath !== filePath) {
                return await fs.stat(shortPath);
            }
            throw e;
        }
    } catch (error) {
        throw new Error(`Cannot access file: ${error.message}`);
    }
};

const hasProblematicCharacters = (str) => {
    return /[\u{1F300}-\u{1F9FF}]|[\u{2702}-\u{27B0}]|[\u{24C2}-\u{1F251}]/u.test(str);
};

async function scanDirectory(dirPath) {
    try {
        if (!await isValidPath(dirPath)) {
            try {
                const shortPath = await getShortPathName(dirPath);
                if (!await isValidPath(shortPath)) {
                    log('Invalid directory:', dirPath);
                    return { files: [], skipped: [] };
                }
                dirPath = shortPath;
            } catch (error) {
                log('Invalid directory:', dirPath);
                return { files: [], skipped: [] };
            }
        }

        if (shouldIgnorePath(dirPath)) {
            log('Ignored directory:', dirPath);
            return { files: [], skipped: [] };
        }

        let items;
        try {
            items = await fs.readdir(dirPath);
        } catch (err) {
            const longPath = `\\\\?\\${dirPath}`;
            items = await fs.readdir(longPath);
        }

        let results = [];
        let skippedFiles = [];

        for (const itemName of items) {
            try {
                if (hasProblematicCharacters(itemName)) {
                    log(`Skipping file with problematic characters: ${itemName}`);
                    skippedFiles.push({
                        name: itemName,
                        path: path.join(dirPath, itemName),
                        reason: 'Contains emojis or special characters that are currently not supported'
                    });
                    continue;
                }

                if (itemName.endsWith('.lnk')) continue;

                const fullPath = path.join(dirPath, itemName);

                try {
                    const stats = await attemptFileAccess(fullPath);
                    
                    if (stats.isDirectory()) {
                        const subDirResults = await scanDirectory(fullPath);
                        if (subDirResults.files.length > 0) {
                            results.push({
                                name: itemName,
                                path: fullPath,
                                size: subDirResults.files.reduce((acc, curr) => acc + (curr.size || 0), 0),
                                type: 'directory',
                                children: subDirResults.files
                            });
                        }
                        skippedFiles = skippedFiles.concat(subDirResults.skipped);
                    } else {
                        results.push({
                            name: itemName,
                            path: fullPath,
                            size: stats.size,
                            type: 'file',
                            fileType: isVideoFile(itemName) ? 'video' : 'other'
                        });
                    }
                } catch (accessError) {
                    log(`Access error for ${fullPath}: ${accessError.message}`);
                    continue;
                }
            } catch (error) {
                log('Item processing error:', error.message);
                continue;
            }
        }
        
        results.sort((a, b) => b.size - a.size);
        return {
            files: results,
            skipped: skippedFiles
        };
    } catch (error) {
        log('Scan directory error:', error.message);
        return { files: [], skipped: [] };
    }
}

app.post('/api/scan', async (req, res) => {
    const { path: scanPath } = req.body;
    log('Received scan request for path:', scanPath);

    try {
        if (!scanPath || typeof scanPath !== 'string') {
            throw new Error('Invalid path provided');
        }
        const windowsPath = scanPath.replace(/\//g, '\\');
        const data = await scanDirectory(windowsPath);
        log('Scan completed successfully');
        res.json(data);
    } catch (error) {
        log('Scan error:', error.message);
        res.status(400).json({ 
            error: error.message,
            code: error.code || 'INVALID_PATH'
        });
    }
});

app.get('/api/drives', async (req, res) => {
    try {
        const { stdout } = await execAsync('wmic logicaldisk get caption');
        const drives = stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => /^[A-Z]:$/.test(line));
        
        res.json({ drives });
    } catch (error) {
        res.json({ drives: ['C:'] });
    }
});

app.get('/api/browse', async (req, res) => {
    try {
        const dirPath = req.query.path || 'C:\\';
        const items = await fs.readdir(dirPath);
        const directories = [];

        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            try {
                const stats = await fs.stat(fullPath);
                if (stats.isDirectory() && !shouldIgnorePath(fullPath)) {
                    directories.push({
                        name: item,
                        path: fullPath
                    });
                }
            } catch (error) {
                continue;
            }
        }

        res.json({
            current: dirPath,
            directories: directories.sort((a, b) => a.name.localeCompare(b.name))
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.listen(3003, () => {
    console.log('Server running on port 3003');
});
