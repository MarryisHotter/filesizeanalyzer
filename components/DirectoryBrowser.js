import { useState, useEffect } from 'react';
import styles from '../styles/DirectoryBrowser.module.css';

export default function DirectoryBrowser({ isOpen, onClose, onSelect }) {
    const [currentPath, setCurrentPath] = useState('C:\\');
    const [directories, setDirectories] = useState([]);
    const [drives, setDrives] = useState(['C:']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadDrives = async () => {
            try {
                const response = await fetch('http://localhost:3003/api/drives');
                const data = await response.json();
                setDrives(data.drives);
            } catch (err) {
                console.error('Failed to load drives:', err);
            }
        };

        if (isOpen) {
            loadDrives();
            loadDirectories(currentPath);
        }
    }, [isOpen, currentPath]);

    const loadDirectories = async (path) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`http://localhost:3003/api/browse?path=${encodeURIComponent(path)}`);
            if (!response.ok) throw new Error('Failed to load directories');
            const data = await response.json();
            setDirectories(data.directories);
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    };

    const goToParent = () => {
        // Special handling for root directory
        if (currentPath.match(/^[A-Z]:\\$/i)) {
            return; // Already at root, don't go up
        }
        
        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('\\'));
        if (parentPath.match(/^[A-Z]:$/i)) {
            // Add trailing slash for root directory
            setCurrentPath(parentPath + '\\');
        } else if (parentPath.length >= 2) {
            setCurrentPath(parentPath);
        }
    };

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter') onSelect(currentPath);
            if (e.key === 'Backspace' && !e.target.matches('input')) goToParent();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentPath, onClose, onSelect]);

    if (!isOpen) return null;

    return (
        <div className={styles.modal}>
            <div className={styles.content}>
                <div className={styles.header}>
                    <h2>Select Directory</h2>
                    <button onClick={onClose}>&times;</button>
                </div>
                <div className={styles.controls}>
                    <select 
                        value={currentPath.split('\\')[0]} 
                        onChange={(e) => setCurrentPath(`${e.target.value}\\`)}
                        className={styles.driveSelect}
                    >
                        {drives.map(drive => (
                            <option key={drive} value={drive}>
                                {drive}
                            </option>
                        ))}
                    </select>
                    <input 
                        type="text" 
                        value={currentPath} 
                        onChange={(e) => setCurrentPath(e.target.value)}
                    />
                </div>
                <div className={styles.list}>
                    {currentPath.length > 3 && (
                        <div className={styles.item} onClick={goToParent}>
                            ..
                        </div>
                    )}
                    {directories.map((dir) => (
                        <div 
                            key={dir.path} 
                            className={styles.item}
                            onClick={() => setCurrentPath(dir.path)}
                            onDoubleClick={() => onSelect(dir.path)}
                        >
                            📁 {dir.name}
                        </div>
                    ))}
                </div>
                <div className={styles.actions}>
                    <button onClick={() => onSelect(currentPath)}>Select This Directory</button>
                    <button onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}
