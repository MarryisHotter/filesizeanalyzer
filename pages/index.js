import { useState, useEffect } from 'react';
import TreeMap from '../components/TreeMap';
import FileTree from '../components/FileTree';
import styles from '../styles/Home.module.css';

export default function Home() {
    const [data, setData] = useState(null);
    const [path, setPath] = useState('C:\\');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        console.log('%cFile Size Analyzer Started', 'color: #007acc; font-size: 14px; font-weight: bold;');
    }, []);

    const scanDirectory = async () => {
        setLoading(true);
        setError(null);
        
        try {
            if (!path.trim()) {
                throw new Error('Please enter a valid directory path');
            }

            console.log('%cSending request to server...', 'color: #8c8c8c');
            const response = await fetch('http://localhost:3003/api/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: path.replace(/\\/g, '/') }),
            });

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error || `Server error: ${response.status}`);
            }

            const result = await response.json();
            console.log('%cServer response:', 'color: #4caf50', result);
            
            if (!result.files || result.files.length === 0) {
                console.warn('%cNo files found', 'color: #ff9800');
                setError('No accessible files found in this directory');
            } else {
                const totalSize = calculateTotalSize(result.files);
                console.log('%cTotal size:', 'color: #4caf50', formatBytes(totalSize));
                setData({ 
                    name: path, 
                    files: result.files, 
                    skipped: result.skipped,
                    size: totalSize 
                });
            }
        } catch (error) {
            console.error('%cError:', 'color: #ff6b6b', error.message);
            setError(error.message || 'Failed to scan directory');
        }
        setLoading(false);
    };

    const calculateTotalSize = (items) => {
        return items.reduce((total, item) => {
            if (item.children) {
                return total + calculateTotalSize(item.children);
            }
            return total + (item.size || 0);
        }, 0);
    };

    const formatBytes = (bytes) => {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
    };

    return (
        <div className={styles.container}>
            <h1>File Size Analyzer</h1>
            <div className={styles.controls}>
                <input
                    type="text"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    className={styles.input}
                />
                <button 
                    onClick={scanDirectory}
                    disabled={loading}
                    className={styles.button}
                >
                    {loading ? 'Scanning...' : 'Scan Directory'}
                </button>
            </div>
            {error && <div className={styles.error}>{error}</div>}
            {data && (
                <>
                    <TreeMap data={data} />
                    <FileTree data={data} />
                </>
            )}
        </div>
    );
}
