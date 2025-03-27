import { useState } from 'react';
import styles from '../styles/FileTree.module.css';

const formatBytes = (bytes) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
};

const FileTreeNode = ({ node, level = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className={styles.node}>
            <div 
                className={styles.nodeContent}
                style={{ paddingLeft: `${level * 20}px` }}
                onClick={() => hasChildren && setIsExpanded(!isExpanded)}
            >
                {hasChildren && (
                    <span className={styles.toggle}>
                        {isExpanded ? '▼' : '▶'}
                    </span>
                )}
                <span className={styles.name}>{node.name}</span>
                <span className={styles.size}>{formatBytes(node.size)}</span>
            </div>
            {isExpanded && hasChildren && (
                <div className={styles.children}>
                    {node.children
                        .sort((a, b) => b.size - a.size)
                        .map((child, index) => (
                            <FileTreeNode 
                                key={`${child.path}-${index}`}
                                node={child}
                                level={level + 1}
                            />
                        ))
                    }
                </div>
            )}
        </div>
    );
};

export default function FileTree({ data }) {
    const skippedFiles = data.skipped || [];
    
    return (
        <div className={styles.container}>
            <h2>Directory Structure</h2>
            <div className={styles.tree}>
                <FileTreeNode node={{ ...data, children: data.files }} />
            </div>
            {skippedFiles.length > 0 && (
                <div className={styles.skippedSection}>
                    <h3>Skipped Files ({skippedFiles.length})</h3>
                    <div className={styles.skippedFiles}>
                        {skippedFiles.map((file, index) => (
                            <div key={index} className={styles.skippedFile}>
                                <span className={styles.name}>{file.name}</span>
                                <span className={styles.reason}>{file.reason}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
