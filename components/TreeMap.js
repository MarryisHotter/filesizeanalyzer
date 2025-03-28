import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import styles from '../styles/TreeMap.module.css';

const MAX_VISIBLE_FILES = 25;

export default function TreeMap({ data: initialData }) {
    const [drillDownHistory, setDrillDownHistory] = useState([]);
    const [currentData, setCurrentData] = useState(initialData);
    const svgRef = useRef();

    useEffect(() => {
        if (!initialData?.files) return;

        const transformedData = {
            name: initialData.name,
            size: initialData.size,
            children: initialData.files
        };

        setCurrentData(transformedData);
        setDrillDownHistory([]);
    }, [initialData]);

    const handleGroupClick = (groupedFiles) => {
        const groupData = {
            name: "Smaller Files",
            children: groupedFiles.map(f => ({
                ...f,
                type: 'file',
                size: Number(f.size) 
            })),
            type: 'directory'
        };
        setDrillDownHistory(prev => [...prev, currentData]);
        setCurrentData(groupData);
    };

    const goBack = () => {
        setDrillDownHistory(prev => {
            const newHistory = [...prev];
            const lastData = newHistory.pop();
            setCurrentData(lastData);
            return newHistory;
        });
    };

    const resetView = () => {
        const transformedData = {
            name: initialData.name,
            size: initialData.size,
            children: initialData.files
        };
        setCurrentData(transformedData);
        setDrillDownHistory([]);
    };

    useEffect(() => {
        if (!currentData) return;

        const width = 1000;
        const height = 600;

        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height);

        svg.selectAll('*').remove();

        const root = d3.hierarchy(currentData);
        
        const processedData = groupSmallFiles(root);
        
        const processedRoot = d3.hierarchy(processedData)
            .sum(d => d.type === 'file' ? d.size : 0)
            .sort((a, b) => b.value - a.value);

        const treemap = d3.treemap()
            .size([width, height])
            .padding(1)
            .round(true);

        treemap(processedRoot);

        const formatBytes = (bytes) => {
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            if (bytes === 0) return '0 B';
            const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
            return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
        };

        const colorScale = d3.scaleSequential()
            .domain([0, Math.sqrt(processedRoot.value)])
            .interpolator(d3.interpolateHslLong(
                d3.hsl(200, 0.8, 0.3),
                d3.hsl(200, 0.8, 0.7)
            ));

        const cell = svg.selectAll('g')
            .data(processedRoot.leaves())
            .join('g')
            .attr('transform', d => `translate(${d.x0},${d.y0})`);

        cell.style('cursor', d => d.data.isGrouped ? 'pointer' : 'default')
            .on('click', function(event, d) {
                if (d.data.isGrouped && d.data.groupedFiles) {
                    event.stopPropagation();
                    handleGroupClick(d.data.groupedFiles);
                }
            });

        cell.append('rect')
            .attr('width', d => d.x1 - d.x0)
            .attr('height', d => d.y1 - d.y0)
            .attr('fill', d => {
                if (d.data.isGrouped) return '#0284c7';
                return colorScale(Math.sqrt(d.value));
            })
            .attr('class', styles.rectangle);

        cell.append('text')
            .attr('class', styles.label)
            .selectAll('tspan')
            .data(d => [d.data.name, formatBytes(d.value)])
            .join('tspan')
            .attr('x', 3)
            .attr('y', (d, i) => 13 + i * 10)
            .text(d => d)
            .each(function(d, i) {
                const parentWidth = this.parentNode.previousSibling.getAttribute('width');
                const textWidth = this.getComputedTextLength();
                if (textWidth > parentWidth - 6) {
                    let text = d;
                    while (this.getComputedTextLength() > parentWidth - 6) {
                        text = text.slice(0, -1);
                        this.textContent = text + '...';
                    }
                }
            });

        cell.append('title')
            .text(d => d.data.isGrouped 
                ? `${d.data.name}\nTotal size: ${formatBytes(d.value)}\nClick to explore`
                : `${d.data.name}\nPath: ${d.data.path}\nSize: ${formatBytes(d.value)}`
            );

    }, [currentData]);

    const groupSmallFiles = (root) => {
        const allFiles = [];
        root.eachBefore(node => {
            if (node.data.type === 'file') {
                allFiles.push({ ...node.data });
            }
        });

        allFiles.sort((a, b) => b.size - a.size);

        const topFiles = allFiles.slice(0, MAX_VISIBLE_FILES);
        const remainingFiles = allFiles.slice(MAX_VISIBLE_FILES);

        if (remainingFiles.length > 0) {
            const remainingSize = remainingFiles.reduce((sum, file) => sum + file.size, 0);
            topFiles.push({
                name: `${remainingFiles.length} more files`,
                size: remainingSize,
                type: 'file',
                isGrouped: true,
                groupedFiles: remainingFiles 
            });
        }

        return {
            name: root.data.name,
            children: topFiles,
            size: root.data.size
        };
    };

    return (
        <div className={styles.container}>
            {drillDownHistory.length > 0 && (
                <div className={styles.navigationWrapper}>
                    <div className={styles.navigation}>
                        <button 
                            className={styles.backButton}
                            onClick={goBack}
                        >
                            ← Back ({drillDownHistory.length} level{drillDownHistory.length === 1 ? '' : 's'} deep)
                        </button>
                        <button 
                            className={styles.mainViewButton}
                            onClick={resetView}
                        >
                            ↖ Back to main view
                        </button>
                    </div>
                </div>
            )}
            <svg ref={svgRef} className={styles.treemap}></svg>
        </div>
    );
}
