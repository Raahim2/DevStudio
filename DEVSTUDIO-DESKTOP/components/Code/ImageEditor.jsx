import React, { useState, useEffect, useRef, useCallback } from 'react';
// Simple unique ID generator for drawing elements
const generateId = () => `_${Math.random().toString(36).substr(2, 9)}`;

import {
  FiCrop, FiMaximize, FiZoomIn, FiZoomOut,
  FiMousePointer, FiEdit3, FiType, FiMinus, FiSquare, FiCircle,
  FiX, FiCornerUpLeft, FiCornerUpRight, FiTrash2, FiRotateCcw, FiRotateCw,
  FiSliders, FiFilter, FiEdit, FiSave, FiDownloadCloud, FiMaximize2, FiRefreshCcw, FiDroplet, FiSun, FiZap // Added more icons
} from 'react-icons/fi';

const initialFilters = {
  brightness: 100, contrast: 100, saturate: 100, exposure: 100, // Added exposure
  grayscale: 0, sepia: 0, blur: 0, sharpness: 0,
  vignette: 0 // Added vignette (0-100 scale)
};

const PRESET_FILTERS = {
  'Original': { ...initialFilters },
  'Vintage': { brightness: 95, contrast: 115, saturate: 80, exposure: 100, sepia: 40, grayscale: 0, blur: 0.2, sharpness: 5, vignette: 20 },
  'Black & White': { brightness: 100, contrast: 120, saturate: 0, exposure: 105, sepia: 0, grayscale: 100, blur: 0, sharpness: 10, vignette: 10 },
  'Cool Light': { brightness: 105, contrast: 95, saturate: 110, exposure: 98, sepia: 0, grayscale: 0, blur: 0, sharpness: 0, vignette: 5 },
  'Warm Glow': { brightness: 100, contrast: 105, saturate: 110, exposure: 102, sepia: 15, grayscale: 0, blur: 0.1, sharpness: 3, vignette: 10 },
};


const MAX_HISTORY_LENGTH = 30;

export default function ImageEditor({ initialFilePath }) {
  const [originalImageDataUrl, setOriginalImageDataUrl] = useState(null);
  const [processedImageDataUrl, setProcessedImageDataUrl] = useState(null);

  const [filters, setFilters] = useState(initialFilters);
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState({ horizontal: false, vertical: false });
  const [zoomLevel, setZoomLevel] = useState(1);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [displayFileName, setDisplayFileName] = useState('');
  const [electronApiReady, setElectronApiReady] = useState(false);
  const [filePath, setFilePath] = useState(initialFilePath);

  const [activeTool, setActiveTool] = useState('select'); // current tool selected from left toolbar
  const [activeRightSidebarTab, setActiveRightSidebarTab] = useState('adjustments'); // 'filters', 'adjustments', 'crop', 'drawing'
  const [drawColor, setDrawColor] = useState('#FF0000');
  const [drawings, setDrawings] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState(null);
  const [drawingLineWidth, setDrawingLineWidth] = useState(3); // For brush, line, shapes
  const [eraserLineWidth, setEraserLineWidth] = useState(20); // For eraser

  const [cropRect, setCropRect] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStartPoint, setCropStartPoint] = useState(null);

  const [resizeDimensions, setResizeDimensions] = useState({ width: 0, height: 0 });
  const [showResizeModal, setShowResizeModal] = useState(false);

  const previewCanvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const baseImageRef = useRef(new Image());

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (window.electronAPI && typeof window.electronAPI.readImageAsBase64 === 'function') {
      setElectronApiReady(true);
    } else {
      console.error("ImageEditor: window.electronAPI or required functions not found.");
      setError("Critical error: Application API not available. Please restart.");
    }
  }, []);

  useEffect(() => {
    const fetchBasename = async () => {
      if (filePath && electronApiReady && window.electronAPI.pathBasename) {
        try {
          const name = await window.electronAPI.pathBasename(filePath);
          setDisplayFileName(name);
        } catch (e) { console.error("Error getting basename:", e); setDisplayFileName("Invalid Path"); }
      } else { setDisplayFileName(''); }
    };
    fetchBasename();
  }, [filePath, electronApiReady]);


  const getFileExtension = async (fp) => {
    if (!fp || !electronApiReady || !window.electronAPI.pathExtname) return ''; // Use pathExtname
    try {
      const ext = await window.electronAPI.pathExtname(fp);
      return ext;
    } catch (e) {
      console.error("Error getting file extension:", e);
      return '';
    }
  };
  
  const resetImageState = (newImageDataUrl, recordHistory = true, fullReset = false) => {
    setFilters(initialFilters);
    setRotation(0);
    setFlip({ horizontal: false, vertical: false });
    setDrawings([]);
    setZoomLevel(1);
    setCropRect(null); // Clear crop rectangle
    setIsCropping(false); // Ensure cropping state is reset
    
    if (fullReset) { // If it's a full reset from original image
        setActiveTool('select');
        setActiveRightSidebarTab('adjustments');
    }
    // Only reset activeTool if it's something destructive like crop
    else if (activeTool === 'crop'){
        setActiveTool('select');
    }
    
    if (baseImageRef.current && baseImageRef.current.complete) {
         setResizeDimensions({ width: baseImageRef.current.naturalWidth, height: baseImageRef.current.naturalHeight });
    }

    if (recordHistory && newImageDataUrl) {
        saveToHistory({ 
            imageDataUrl: newImageDataUrl, 
            filters: initialFilters, 
            rotation: 0, 
            flip: { horizontal: false, vertical: false }, 
            drawings: [] 
        });
    }
  };


  const loadImage = useCallback(async (fp) => {
    if (!fp) {
      setOriginalImageDataUrl(null); setProcessedImageDataUrl(null); setError(''); return;
    }
    if (!electronApiReady) { setError('API not ready, cannot load image.'); return; }
    setIsLoading(true); setError('');
    try {
      const dataUrl = await window.electronAPI.readImageAsBase64(fp);
      
      const img = new Image();
      img.onload = () => {
        baseImageRef.current = img;
        setOriginalImageDataUrl(dataUrl); 
        setProcessedImageDataUrl(dataUrl); 
        resetImageState(dataUrl, true, true); // Full reset for new image load
      };
      img.onerror = () => {
        setError('Failed to parse loaded image data.');
        setOriginalImageDataUrl(null); setProcessedImageDataUrl(null);
      }
      img.src = dataUrl;
      setFilePath(fp);
    } catch (err) {
      console.error("Failed to load image:", err);
      setError(`Error loading image: ${err.message}`);
      setOriginalImageDataUrl(null); setProcessedImageDataUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [electronApiReady]); 

  useEffect(() => {
    if (initialFilePath && electronApiReady) {
      loadImage(initialFilePath);
    }
  }, [initialFilePath, loadImage, electronApiReady]);

  const saveToHistory = useCallback((stateSnapshot) => {
    setHistory(prevHistory => {
        const newHistory = prevHistory.slice(0, historyIndex + 1);
        newHistory.push(stateSnapshot);
        if (newHistory.length > MAX_HISTORY_LENGTH) {
            newHistory.shift();
        }
        setHistoryIndex(newHistory.length - 1);
        return newHistory;
    });
  },[historyIndex]);


  const applyHistoryState = (index) => {
    if (index < 0 || index >= history.length) return;
    const state = history[index];

    const img = new Image();
    img.onload = () => {
        baseImageRef.current = img; 
        setProcessedImageDataUrl(state.imageDataUrl);
        setFilters(state.filters);
        setRotation(state.rotation);
        setFlip(state.flip);
        setDrawings(state.drawings || []);
        setResizeDimensions({width: img.naturalWidth, height: img.naturalHeight});
        setHistoryIndex(index);
    }
    img.onerror = () => {
        console.error("Error loading image from history");
        setError("Error restoring history state. Image data might be corrupted.");
    }
    img.src = state.imageDataUrl; 
  };

  const handleUndo = () => (historyIndex > 0) && applyHistoryState(historyIndex - 1);
  const handleRedo = () => (historyIndex < history.length - 1) && applyHistoryState(historyIndex + 1);

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: parseFloat(value) }));
  };

  const commitInstantChangeToHistory = useCallback(() => {
    saveToHistory({ imageDataUrl: processedImageDataUrl, filters, rotation, flip, drawings });
  }, [processedImageDataUrl, filters, rotation, flip, drawings, saveToHistory]);

  const handleRotate = (degrees) => {
    const newRotation = (rotation + degrees + 360) % 360;
    setRotation(newRotation);
    saveToHistory({ imageDataUrl: processedImageDataUrl, filters, rotation: newRotation, flip, drawings });
  };

  const handleFlip = (axis) => {
    const newFlip = { ...flip, [axis]: !flip[axis] };
    setFlip(newFlip);
    saveToHistory({ imageDataUrl: processedImageDataUrl, filters, rotation, flip: newFlip, drawings });
  };

  const handleZoom = (delta) => setZoomLevel(prev => Math.max(0.1, Math.min(prev + delta, 5)));


  const drawCanvas = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !baseImageRef.current || !baseImageRef.current.complete || baseImageRef.current.naturalWidth === 0) {
        if(canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0,0, canvas.width, canvas.height); 
        }
        return;
    }
    const ctx = canvas.getContext('2d');
    const img = baseImageRef.current;

    const displayWidth = img.naturalWidth * zoomLevel;
    const displayHeight = img.naturalHeight * zoomLevel;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    ctx.fillStyle = '#e0e0e0'; // Slightly darker gray background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);

    ctx.translate(img.naturalWidth / 2, img.naturalHeight / 2);
    ctx.rotate(rotation * Math.PI / 180);
    if (flip.horizontal) ctx.scale(-1, 1);
    if (flip.vertical) ctx.scale(1, -1);
    ctx.translate(-img.naturalWidth / 2, -img.naturalHeight / 2);

    ctx.filter = `
      brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)
      brightness(${filters.exposure}%) /* Exposure疊加 can be tricky, CSS applies them sequentially */
      grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px)
      ${filters.sharpness > 0 ? `url(#sharpenFilterSvg)` : ''}
    `;
    try {
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
    } catch (e) {
      console.error("Error drawing image on canvas:", e, img.src);
      setError("Error displaying image. It might be corrupted or an unsupported format.");
      ctx.restore(); 
      return;
    }
    
    ctx.filter = 'none'; 

    if (filters.vignette > 0 && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const centerX = img.naturalWidth / 2;
        const centerY = img.naturalHeight / 2;
        const outerRadius = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
        const vignetteAmount = filters.vignette / 100; 
        const innerRadiusFactor = 1 - (vignetteAmount * 0.85); // Vignette strength, 0.85 means at 100 vignette, clear area is 15% of radius
        const innerR = outerRadius * innerRadiusFactor;
        
        if (outerRadius > 0 && innerR < outerRadius) { 
            let gradient = ctx.createRadialGradient(centerX, centerY, innerR, centerX, centerY, outerRadius);
            gradient.addColorStop(0, 'rgba(0,0,0,0)'); 
            gradient.addColorStop(1, `rgba(0,0,0,${Math.min(vignetteAmount * 0.7, 1)})`); // Vignette color and opacity

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, img.naturalWidth, img.naturalHeight); 
        }
    }
    ctx.restore(); 

    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);
    drawings.forEach(d => {
      ctx.strokeStyle = d.color;
      ctx.fillStyle = d.color;
      ctx.lineWidth = d.lineWidth || 2;
      if (d.compositeOperation) ctx.globalCompositeOperation = d.compositeOperation;

      switch (d.type) {
        case 'freehand':
        case 'eraser':
          ctx.beginPath();
          d.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.stroke();
          break;
        case 'line': ctx.beginPath(); ctx.moveTo(d.startX, d.startY); ctx.lineTo(d.endX, d.endY); ctx.stroke(); break;
        case 'rectangle': ctx.beginPath(); ctx.rect(d.x, d.y, d.width, d.height); d.fill ? ctx.fill() : ctx.stroke(); break;
        case 'circle':
            ctx.beginPath();
            const radius = d.radius || Math.sqrt(Math.pow(d.endX - d.startX, 2) + Math.pow(d.endY - d.startY, 2));
            ctx.arc(d.startX, d.startY, radius, 0, 2 * Math.PI);
            d.fill ? ctx.fill() : ctx.stroke();
            break;
        case 'text': ctx.font = d.font || '20px Arial'; ctx.fillText(d.text, d.x, d.y); break;
      }
      if (d.compositeOperation) ctx.globalCompositeOperation = 'source-over'; 
    });
    ctx.restore();

    if (activeTool === 'crop' && isCropping && cropRect) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 120, 255, 0.9)';
        ctx.lineWidth = 1.5; 
        ctx.setLineDash([6, 6]); 
        ctx.strokeRect(cropRect.x * zoomLevel, cropRect.y * zoomLevel, cropRect.width * zoomLevel, cropRect.height * zoomLevel);
        ctx.fillStyle = 'rgba(0, 120, 255, 0.1)';
        ctx.fillRect(cropRect.x * zoomLevel, cropRect.y * zoomLevel, cropRect.width * zoomLevel, cropRect.height * zoomLevel);
        ctx.restore();
    }

  }, [processedImageDataUrl, filters, rotation, flip, zoomLevel, drawings, activeTool, isCropping, cropRect]);


  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  useEffect(() => {
    if (['draw', 'line', 'rectangle', 'circle', 'eraser', 'text'].includes(activeTool)) {
      setActiveRightSidebarTab('drawing');
    } else if (activeTool === 'crop') {
      setActiveRightSidebarTab('crop');
    } else if (activeTool === 'select') {
      if (activeRightSidebarTab !== 'filters' && activeRightSidebarTab !== 'adjustments') {
          setActiveRightSidebarTab('adjustments');
      }
    }
  }, [activeTool]);

  const handleRightSidebarTabChange = (tabName) => {
    setActiveRightSidebarTab(tabName);
    if (tabName === 'crop') {
      setActiveTool('crop');
    } else if (tabName === 'filters' || tabName === 'adjustments') {
      if (activeTool !== 'select') setActiveTool('select');
    } else if (tabName === 'drawing') {
        // If no drawing tool is active, pick a default one like 'draw'
        if (!['draw', 'line', 'rectangle', 'circle', 'eraser', 'text'].includes(activeTool)){
            setActiveTool('draw');
        }
    }
  };


  const getMousePos = (e) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX / zoomLevel,
      y: (e.clientY - rect.top) * scaleY / zoomLevel,
    };
  };

  const handleCanvasMouseDown = (e) => {
    if (!processedImageDataUrl || !baseImageRef.current.complete) return;
    const pos = getMousePos(e);

    if (activeTool === 'crop') {
        setIsCropping(true);
        setCropStartPoint(pos); 
        setCropRect({ x: pos.x, y: pos.y, width: 0, height: 0 }); 
    } else if (['draw', 'line', 'rectangle', 'circle', 'eraser'].includes(activeTool)) {
        setIsDrawing(true);
        const currentLineWidth = activeTool === 'eraser' ? eraserLineWidth : drawingLineWidth;
        let newDrawingElement = {
            id: generateId(),
            type: activeTool === 'draw' ? 'freehand' : activeTool,
            color: activeTool === 'eraser' ? 'rgba(0,0,0,0)' : drawColor,
            lineWidth: currentLineWidth,
            points: [{ x: pos.x, y: pos.y }],
            startX: pos.x, startY: pos.y,
            x: pos.x, y: pos.y,
        };
        if(activeTool === 'eraser') {
            newDrawingElement.type = 'eraser'; // Explicitly set eraser type for drawing logic
            newDrawingElement.compositeOperation = 'destination-out';
        }
        setCurrentDrawing(newDrawingElement);
        if (activeTool === 'draw' || activeTool === 'eraser') { 
             setDrawings(prev => [...prev, newDrawingElement]);
        }

    } else if (activeTool === 'text') {
        const text = prompt("Enter text:");
        if (text) {
            const newTextElement = {
                id: generateId(), type: 'text', text, x: pos.x, y: pos.y, color: drawColor, font: `${drawingLineWidth * 5 + 10}px Arial` // Example font size based on line width
            };
            const newDrawings = [...drawings, newTextElement];
            setDrawings(newDrawings);
            saveToHistory({ imageDataUrl: processedImageDataUrl, filters, rotation, flip, drawings: newDrawings });
        }
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing && !isCropping) return;
    const pos = getMousePos(e); 

    if (isCropping && cropStartPoint) {
        const newCropRect = {
            x: Math.min(pos.x, cropStartPoint.x),
            y: Math.min(pos.y, cropStartPoint.y),
            width: Math.abs(pos.x - cropStartPoint.x),
            height: Math.abs(pos.y - cropStartPoint.y),
        };
        setCropRect(newCropRect);
    } else if (isDrawing && currentDrawing) {
        let updatedDrawing = { ...currentDrawing };
        if (currentDrawing.type === 'freehand' || currentDrawing.type === 'eraser') {
            updatedDrawing.points = [...currentDrawing.points, pos];
            setDrawings(prev => prev.map(d => d.id === updatedDrawing.id ? updatedDrawing : d));
        } else if (['line', 'rectangle', 'circle'].includes(currentDrawing.type)) {
            updatedDrawing.endX = pos.x;
            updatedDrawing.endY = pos.y;
            if (currentDrawing.type === 'rectangle') {
                updatedDrawing.x = Math.min(currentDrawing.startX, pos.x);
                updatedDrawing.y = Math.min(currentDrawing.startY, pos.y);
                updatedDrawing.width = Math.abs(pos.x - currentDrawing.startX);
                updatedDrawing.height = Math.abs(pos.y - currentDrawing.startY);
            } else if (currentDrawing.type === 'circle') {
                updatedDrawing.radius = Math.sqrt(Math.pow(pos.x - currentDrawing.startX, 2) + Math.pow(pos.y - currentDrawing.startY, 2));
            }
            setDrawings(prev => {
                const existing = prev.find(d => d.id === updatedDrawing.id);
                if (existing) return prev.map(d => d.id === updatedDrawing.id ? updatedDrawing : d);
                return [...prev, updatedDrawing]; 
            });
            setCurrentDrawing(updatedDrawing); 
        }
    }
  };

  const handleCanvasMouseUp = () => {
    if (isCropping) {
        setIsCropping(false); 
    }

    if (isDrawing && currentDrawing) {
        // Final drawing is already in `drawings` array through mouseMove updates for continuous drawing tools
        // or preview for shapes. Now save to history.
        saveToHistory({ imageDataUrl: processedImageDataUrl, filters, rotation, flip, drawings });
    }
    setIsDrawing(false);
    setCurrentDrawing(null);
  };

  const handleApplyOperation = async (operationFunc, successMessage) => {
    setIsLoading(true);
    try {
      const currentVisualDataUrl = await getFinalCanvasDataUrl(true); 
      const newImageDataUrl = await operationFunc(currentVisualDataUrl); 
      if (newImageDataUrl) {
        const img = new Image();
        img.onload = () => {
          baseImageRef.current = img; 
          setProcessedImageDataUrl(newImageDataUrl); 
          resetImageState(newImageDataUrl, true); 
          
          setCropRect(null);
          // setActiveTool('select'); // resetImageState might handle this or part of it
          // setActiveRightSidebarTab('adjustments'); // Handled by resetImageState logic
          console.log(successMessage);
        };
        img.onerror = () => { throw new Error("Failed to load processed image."); };
        img.src = newImageDataUrl;
      } else if (newImageDataUrl === null && operationFunc === performCrop) {
         // Crop was cancelled or invalid, do nothing further
      }
    } catch (err) {
      setError(`${operationFunc.name} Error: ${err.message}`);
      console.error(`${operationFunc.name} Error:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  const performCrop = async (sourceDataUrl) => {
    if (!cropRect || cropRect.width <= 1 || cropRect.height <= 1) { // Min 1px dimension
      setError("Invalid crop area. Dimensions must be greater than 1px.");
      return null; 
    }
    const imgToCrop = new Image();
    await new Promise((resolve, reject) => {
        imgToCrop.onload = resolve;
        imgToCrop.onerror = () => reject(new Error("Image load failed for crop"));
        imgToCrop.src = sourceDataUrl; 
    });

    const tempCanvas = hiddenCanvasRef.current || document.createElement('canvas');
    tempCanvas.width = Math.max(1, Math.round(cropRect.width)); // Ensure positive integer
    tempCanvas.height = Math.max(1, Math.round(cropRect.height));
    const ctx = tempCanvas.getContext('2d');

    ctx.drawImage(imgToCrop, 
        Math.round(cropRect.x), Math.round(cropRect.y), 
        Math.round(cropRect.width), Math.round(cropRect.height), 
        0, 0, 
        tempCanvas.width, tempCanvas.height);
    return tempCanvas.toDataURL('image/png');
  };

  const performResize = async (sourceDataUrl) => {
    if (!resizeDimensions.width || !resizeDimensions.height || resizeDimensions.width <=0 || resizeDimensions.height <=0) {
        setError("Invalid resize dimensions.");
        setShowResizeModal(false);
        return null;
    }
    setShowResizeModal(false);
    const imgToResize = new Image();
    await new Promise((resolve, reject) => {
        imgToResize.onload = resolve;
        imgToResize.onerror = () => reject(new Error("Image load failed for resize"));
        imgToResize.src = sourceDataUrl; 
    });
    const tempCanvas = hiddenCanvasRef.current || document.createElement('canvas');
    tempCanvas.width = resizeDimensions.width;
    tempCanvas.height = resizeDimensions.height;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(imgToResize, 0, 0, resizeDimensions.width, resizeDimensions.height);
    return tempCanvas.toDataURL('image/png');
  };

  const handleApplyCrop = () => handleApplyOperation(performCrop, "Crop applied.");
  const handleApplyResize = () => handleApplyOperation(performResize, "Resize applied.");


  const handleClearDrawings = () => {
    setDrawings([]);
    saveToHistory({ imageDataUrl: processedImageDataUrl, filters, rotation, flip, drawings: [] });
  };
  
  const getFinalCanvasDataUrl = useCallback(async (excludeDrawings = false) => {
    if (!processedImageDataUrl) throw new Error("No image data to process.");

    const finalImage = baseImageRef.current;
    if (!finalImage || !finalImage.complete || finalImage.naturalWidth === 0) {
        throw new Error("Base image for final rendering is not ready or invalid.");
    }
    
    const canvas = hiddenCanvasRef.current || document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let rad = rotation * Math.PI / 180;
    let absCos = Math.abs(Math.cos(rad));
    let absSin = Math.abs(Math.sin(rad));
    
    canvas.width = finalImage.naturalWidth * absCos + finalImage.naturalHeight * absSin;
    canvas.height = finalImage.naturalWidth * absSin + finalImage.naturalHeight * absCos;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    if (flip.horizontal) ctx.scale(-1, 1);
    if (flip.vertical) ctx.scale(1, -1);
    ctx.translate(-finalImage.naturalWidth / 2, -finalImage.naturalHeight / 2);

    ctx.filter = `
        brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)
        brightness(${filters.exposure}%)
        grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px)
        ${filters.sharpness > 0 ? `url(#sharpenFilterSvg)`: ''}
    `;
    ctx.drawImage(finalImage, 0, 0, finalImage.naturalWidth, finalImage.naturalHeight);
    ctx.filter = 'none';

    if (filters.vignette > 0 && finalImage.naturalWidth > 0 && finalImage.naturalHeight > 0) {
        const centerX = finalImage.naturalWidth / 2;
        const centerY = finalImage.naturalHeight / 2;
        const outerRadius = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
        const vignetteAmount = filters.vignette / 100;
        const innerRadiusFactor = 1 - (vignetteAmount * 0.85);
        const innerR = outerRadius * innerRadiusFactor;
        if (outerRadius > 0 && innerR < outerRadius) {
            let gradient = ctx.createRadialGradient(centerX, centerY, innerR, centerX, centerY, outerRadius);
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, `rgba(0,0,0,${Math.min(vignetteAmount * 0.7,1)})`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, finalImage.naturalWidth, finalImage.naturalHeight);
        }
    }
    ctx.restore(); 

    if (drawings.length > 0 && !excludeDrawings) {
        const drawingCanvas = document.createElement('canvas');
        drawingCanvas.width = finalImage.naturalWidth;
        drawingCanvas.height = finalImage.naturalHeight;
        const drawCtx = drawingCanvas.getContext('2d');

        drawings.forEach(d => {
            drawCtx.strokeStyle = d.color;
            drawCtx.fillStyle = d.color;
            drawCtx.lineWidth = d.lineWidth || 2;
            if (d.compositeOperation) drawCtx.globalCompositeOperation = d.compositeOperation;
            else drawCtx.globalCompositeOperation = 'source-over';

            switch (d.type) {
                case 'freehand':
                case 'eraser': 
                    drawCtx.beginPath();
                    d.points.forEach((p, i) => i === 0 ? drawCtx.moveTo(p.x, p.y) : drawCtx.lineTo(p.x, p.y));
                    drawCtx.stroke();
                    break;
                case 'line': drawCtx.beginPath(); drawCtx.moveTo(d.startX, d.startY); drawCtx.lineTo(d.endX, d.endY); drawCtx.stroke(); break;
                case 'rectangle': drawCtx.beginPath(); drawCtx.rect(d.x, d.y, d.width, d.height); d.fill ? drawCtx.fill() : drawCtx.stroke(); break;
                case 'circle':
                    drawCtx.beginPath();
                    const radius = d.radius || Math.sqrt(Math.pow(d.endX - d.startX, 2) + Math.pow(d.endY - d.startY, 2));
                    drawCtx.arc(d.startX, d.startY, radius, 0, 2 * Math.PI);
                    d.fill ? drawCtx.fill() : drawCtx.stroke();
                    break;
                case 'text': drawCtx.font = d.font || '20px Arial'; drawCtx.fillText(d.text, d.x, d.y); break;
            }
            drawCtx.globalCompositeOperation = 'source-over'; 
        });
        
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        if (flip.horizontal) ctx.scale(-1, 1);
        if (flip.vertical) ctx.scale(1, -1);
        ctx.translate(-finalImage.naturalWidth / 2, -finalImage.naturalHeight / 2);
        ctx.drawImage(drawingCanvas, 0, 0);
        ctx.restore();
    }
    
    return canvas.toDataURL('image/png');

  }, [processedImageDataUrl, baseImageRef, filters, rotation, flip, drawings]);


  const handleSave = async () => {
    if (!filePath || !processedImageDataUrl || !electronApiReady) {
      setError(!electronApiReady ? 'API not ready.' : 'No image loaded to save.');
      return;
    }
    setIsLoading(true); setError('');
    try {
      const finalDataUrl = await getFinalCanvasDataUrl();
      const result = await window.electronAPI.saveImageBase64(filePath, finalDataUrl);
      if (result.success) {
        console.log('Image saved successfully!');
        // Consider if we should update originalImageDataUrl here to prevent "Reset" from going too far back
        // For now, save means save, subsequent edits are on this saved state.
      } else {
        throw new Error(result.error || 'Failed to save image.');
      }
    } catch (err) {
      console.error("Save error:", err);
      setError(`Save error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAs = async () => {
    if (!processedImageDataUrl || !electronApiReady) {
      setError(!electronApiReady ? 'API not ready.' : 'No image loaded to save.');
      return;
    }
    setIsLoading(true); setError('');
    try {
      const finalDataUrlPng = await getFinalCanvasDataUrl(); 

      const currentExtension = filePath ? await getFileExtension(filePath) : '.png';
      const currentBasename = filePath ? await window.electronAPI.pathBasename(filePath) : 'edited-image.png';
      const originalFileName = currentBasename.substring(0, currentBasename.lastIndexOf('.')) || currentBasename;


      const newFilePath = await window.electronAPI.showSaveDialog({
        title: 'Save Image As',
        defaultPath: `${originalFileName}-edited${currentExtension || '.png'}`,
        filters: [
          { name: 'PNG Image', extensions: ['png'] },
          { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
        ],
      });

      if (newFilePath) {
        let dataToSave = finalDataUrlPng;
        const newExtResult = await getFileExtension(newFilePath); 
        const newExt = newExtResult ? newExtResult.toLowerCase() : '';

        if (newExt === '.jpg' || newExt === '.jpeg') {
          dataToSave = await new Promise((resolve, reject) => {
            const tempImg = new Image();
            tempImg.onload = () => {
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = tempImg.naturalWidth;
              tempCanvas.height = tempImg.naturalHeight;
              const tempCtx = tempCanvas.getContext('2d');
              tempCtx.fillStyle = '#FFFFFF'; 
              tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
              tempCtx.drawImage(tempImg, 0, 0);
              resolve(tempCanvas.toDataURL('image/jpeg', 0.9)); 
            };
            tempImg.onerror = (err) => reject(new Error("Failed to load image for JPEG conversion: " + err));
            tempImg.src = finalDataUrlPng; 
          });
        }

        const result = await window.electronAPI.saveImageBase64(newFilePath, dataToSave);
        if (result.success) {
          const savedBasename = await window.electronAPI.pathBasename(newFilePath);
          console.log(`Image saved as ${savedBasename}`);
          setFilePath(newFilePath); 
          setDisplayFileName(savedBasename); 
          // After "Save As", the current processed image is now linked to the new file path.
          // Consider if originalImageDataUrl should also update or if this "Save As" becomes the new baseline.
          // For simplicity, the current state is now associated with the new file.
        } else {
          throw new Error(result.error || 'Failed to save image.');
        }
      }
    } catch (err) {
      console.error("Save As error:", err);
      setError(`Save As error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const applyPresetFilter = (presetName) => {
    const preset = PRESET_FILTERS[presetName];
    if (preset) {
      const newFilters = { ...initialFilters, ...preset }; // Start from initial to ensure all values are defined
      setFilters(newFilters);
      commitInstantChangeToHistory(); // Save this change to history
    }
  };

  const resetCurrentFilterTab = () => {
    const filtersToReset = {
        grayscale: initialFilters.grayscale, 
        sepia: initialFilters.sepia, 
        blur: initialFilters.blur, 
        vignette: initialFilters.vignette
    };
    const newFilters = {...filters, ...filtersToReset};
    setFilters(newFilters);
    commitInstantChangeToHistory();
  };

  const resetCurrentAdjustmentTab = () => {
    const adjustmentsToReset = {
        brightness: initialFilters.brightness, 
        contrast: initialFilters.contrast, 
        saturate: initialFilters.saturate, 
        exposure: initialFilters.exposure, 
        sharpness: initialFilters.sharpness
    };
    const newFilters = {...filters, ...adjustmentsToReset};
    setFilters(newFilters);
    commitInstantChangeToHistory();
  };

  const fullyResetImage = () => {
    if (originalImageDataUrl) {
      const img = new Image();
      img.onload = () => {
        baseImageRef.current = img;
        setProcessedImageDataUrl(originalImageDataUrl);
        resetImageState(originalImageDataUrl, true, true); // full reset
      }
      img.onerror = () => setError("Failed to reload original image for reset.");
      img.src = originalImageDataUrl;
    }
  };


  const renderToolButton = (toolName, IconComponent, label, action, isActiveForce = undefined, isActionButton = false) => (
    <button
      title={label}
      onClick={action ? action : () => setActiveTool(toolName)}
      disabled={isActionButton && isActiveForce} // isActiveForce can mean "disabled" for action buttons
      className={`p-2 rounded-md flex items-center justify-center hover:bg-teal-500 hover:text-white transition-colors text-lg
                  ${(isActiveForce !== undefined && !isActionButton ? isActiveForce : activeTool === toolName && !isActionButton) ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-700'}
                  ${(isActionButton && isActiveForce) ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isActionButton ? 'w-full' : ''}
                  `}
    >
      <IconComponent />
    </button>
  );

  const renderSidebarTabButton = (tabId, IconComponent, label) => (
    <button
        title={label}
        onClick={() => handleRightSidebarTabChange(tabId)}
        className={`flex-1 p-2.5 text-xs font-medium flex flex-col items-center justify-center border-b-2 hover:bg-teal-50 transition-colors
                    ${activeRightSidebarTab === tabId ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-teal-500'}`}
    >
        <IconComponent className="mb-0.5 h-4 w-4" />
        {label}
    </button>
  );

  const renderSlider = (key, label, min, max, step, unit = '%') => (
    <div key={key} className="mb-3">
        <label htmlFor={key} className="flex justify-between text-xs font-medium text-gray-600 mb-0.5">
        <span className="capitalize">{label}</span><span>{parseFloat(filters[key]).toFixed(key === 'blur' ? 1 : 0)}{unit}</span>
        </label>
        <input type="range" id={key} name={key} min={min} max={max} 
        step={step} value={filters[key]}
        onChange={(e) => handleFilterChange(key, e.target.value)}
        onMouseUp={commitInstantChangeToHistory} 
        onTouchEnd={commitInstantChangeToHistory}
        className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-teal-600"/>
    </div>
  );

  if (!electronApiReady && !isLoading) { return <div className="p-4 text-red-600">Electron API not ready. Please restart the application.</div> }
  if (!originalImageDataUrl && !isLoading && !initialFilePath) { return <div className="flex items-center justify-center h-full text-gray-500">No image loaded. Open an image to start.</div> }


  return (
    <div className="flex flex-col h-full bg-gray-100 text-gray-800 relative select-none">
      <canvas ref={hiddenCanvasRef} style={{ display: 'none' }}></canvas>
      <svg style={{ display: 'none' }}><filter id="sharpenFilterSvg"><feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" /></filter></svg>

      {/* Top Bar */}
      <div className="bg-teal-700 text-white p-2 flex justify-between items-center shadow-md sticky top-0 z-20">
        <h1 className="text-lg font-semibold truncate pl-2" title={displayFileName || "Image Editor"}>
          Editor {displayFileName ? <span className="font-normal text-teal-200">- {displayFileName}</span> : ''}
        </h1>
        <div className="flex items-center space-x-1.5">
          {renderToolButton('undo_action', FiRotateCcw, 'Undo (Ctrl+Z)', handleUndo, historyIndex <= 0, true)}
          {renderToolButton('redo_action', FiRotateCw, 'Redo (Ctrl+Y)', handleRedo, historyIndex >= history.length - 1, true)}
          <button onClick={handleSave} disabled={!filePath || isLoading || !electronApiReady} className="px-3 py-1.5 text-sm font-medium text-white bg-teal-500 rounded-md hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center"><FiSave className="mr-1.5"/>Save</button>
          <button onClick={handleSaveAs} disabled={!processedImageDataUrl || isLoading || !electronApiReady} className="px-3 py-1.5 text-sm font-medium text-white bg-teal-500 rounded-md hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center"><FiDownloadCloud className="mr-1.5"/>Save As</button>
        </div>
      </div>

      {isLoading && ( <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50"><div className="p-4 bg-white rounded shadow-lg text-gray-700">Processing...</div></div> )}
      {error && ( <div onClick={() => setError('')} className="cursor-pointer m-2 p-2 text-sm text-red-700 bg-red-100 border border-red-300 rounded text-center shadow absolute top-12 left-1/2 transform -translate-x-1/2 z-30 w-auto max-w-md">{error} <FiX className="inline ml-2"/></div> )}

      {/* Main Content Area (Toolbar, Canvas, Right Sidebar) */}
      <div className="flex flex-1 p-2 space-x-2 overflow-hidden">
        {/* Left Toolbar */}
        <div className="w-16 bg-white border border-gray-300 rounded-lg shadow-sm p-2 flex flex-col items-center space-y-1.5">
          {renderToolButton('select', FiMousePointer, 'Select / Pan')}
          {renderToolButton('crop', FiCrop, 'Crop Image (Activates Crop Tab)')}
          {renderToolButton('resize_action', FiMaximize2, 'Resize Image', () => setShowResizeModal(true), false, true)}
          <hr className="w-full border-gray-300 my-1" />
          {renderToolButton('draw', FiEdit3, 'Freehand Draw (Activates Drawing Tab)')}
          {renderToolButton('text', FiType, 'Add Text (Activates Drawing Tab)')}
          {renderToolButton('line', FiMinus, 'Draw Line (Activates Drawing Tab)')}
          {renderToolButton('rectangle', FiSquare, 'Draw Rectangle (Activates Drawing Tab)')}
          {renderToolButton('circle', FiCircle, 'Draw Circle (Activates Drawing Tab)')}
          {renderToolButton('eraser', FiX, 'Eraser (Activates Drawing Tab)')}
          <hr className="w-full border-gray-300 my-1" />
          {renderToolButton('clear_drawings_action', FiTrash2, 'Clear All Drawings', handleClearDrawings, drawings.length === 0, true)}
          <hr className="w-full border-gray-300 my-1" />
          <button
            title="Reset All Changes to Original Image"
            onClick={fullyResetImage}
            disabled={!originalImageDataUrl || processedImageDataUrl === originalImageDataUrl}
            className="p-2 rounded-md flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors text-lg bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed w-full"
            >
            <FiRefreshCcw />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center bg-gray-300 p-1 border border-gray-300 rounded-lg shadow-inner overflow-auto relative">
          {!processedImageDataUrl && !isLoading && <div className="text-gray-500">Loading image or no image selected...</div>}
          {processedImageDataUrl && 
            <canvas
              ref={previewCanvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp} // End drawing if mouse leaves canvas
              className="max-w-full max-h-full object-contain"
              style={{ cursor: activeTool === 'select' ? 'grab' : (activeTool === 'text' ? 'text' : (activeTool==='crop' ? 'crosshair' : 'crosshair'))}}
            />
          }
        </div>

        {/* Right Sidebar */}
        <div className="w-72 bg-white border border-gray-300 rounded-lg shadow-sm flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                {renderSidebarTabButton('filters', FiFilter, 'Filters')}
                {renderSidebarTabButton('adjustments', FiSliders, 'Adjust')}
                {renderSidebarTabButton('crop', FiCrop, 'Crop')}
                {renderSidebarTabButton('drawing', FiEdit, 'Draw')}
            </div>

            {/* Content based on active tab */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
                {activeRightSidebarTab === 'filters' && (
                    <>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Preset Filters</h4>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {Object.keys(PRESET_FILTERS).map(name => (
                                <button key={name} onClick={() => applyPresetFilter(name)}
                                className="p-1.5 text-xs bg-gray-100 hover:bg-teal-100 border border-gray-300 rounded text-gray-700 truncate">
                                    {name}
                                </button>
                            ))}
                        </div>
                        <hr className="my-3"/>
                        {renderSlider('sepia', 'Sepia', 0, 100, 1)}
                        {renderSlider('grayscale', 'Grayscale', 0, 100, 1)}
                        {renderSlider('blur', 'Blur', 0, 10, 0.1, 'px')}
                        {renderSlider('vignette', 'Vignette', 0, 100, 1)}
                        <button onClick={resetCurrentFilterTab} className="mt-3 w-full p-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded">Reset Filters</button>
                    </>
                )}

                {activeRightSidebarTab === 'adjustments' && (
                    <>
                        {renderSlider('brightness', 'Brightness', 0, 200, 1)}
                        {renderSlider('contrast', 'Contrast', 0, 200, 1)}
                        {renderSlider('saturate', 'Saturation', 0, 200, 1)}
                        {renderSlider('exposure', 'Exposure', 0, 200, 1)} {/* CSS brightness as exposure */}
                        {renderSlider('sharpness', 'Sharpness', 0, 100, 1)} {/* Uses SVG filter */}
                         <hr className="my-3"/>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Transform</h4>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <button onClick={() => handleRotate(-90)} className="p-1.5 text-xs bg-gray-100 hover:bg-teal-100 border rounded flex items-center justify-center"><FiRotateCcw className="mr-1"/> Rotate L</button>
                            <button onClick={() => handleRotate(90)} className="p-1.5 text-xs bg-gray-100 hover:bg-teal-100 border rounded flex items-center justify-center"><FiRotateCw className="mr-1"/> Rotate R</button>
                            <button onClick={() => handleFlip('horizontal')} className="p-1.5 text-xs bg-gray-100 hover:bg-teal-100 border rounded">Flip H</button>
                            <button onClick={() => handleFlip('vertical')} className="p-1.5 text-xs bg-gray-100 hover:bg-teal-100 border rounded">Flip V</button>
                        </div>
                         <label className="text-xs font-medium text-gray-600 mb-0.5 block">Zoom ({Math.round(zoomLevel*100)}%)</label>
                        <div className="flex items-center space-x-1.5">
                            <button onClick={() => handleZoom(-0.1)} className="p-1 bg-gray-200 rounded hover:bg-gray-300"><FiZoomOut/></button>
                            <input type="range" min="0.1" max="5" step="0.05" value={zoomLevel} onChange={e => setZoomLevel(parseFloat(e.target.value))} className="w-full h-1.5 accent-teal-600 appearance-none bg-gray-300 rounded-lg"/>
                            <button onClick={() => handleZoom(0.1)} className="p-1 bg-gray-200 rounded hover:bg-gray-300"><FiZoomIn/></button>
                        </div>
                        <button onClick={resetCurrentAdjustmentTab} className="mt-4 w-full p-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded">Reset Adjustments</button>
                    </>
                )}

                {activeRightSidebarTab === 'crop' && (
                    <>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Crop Image</h4>
                        {!isCropping && !cropRect && <p className="text-xs text-gray-500">Click and drag on the image to select an area to crop.</p>}
                        {cropRect && (
                            <div className="text-xs text-gray-600 space-y-0.5 mb-2">
                                <p>X: {Math.round(cropRect.x)}, Y: {Math.round(cropRect.y)}</p>
                                <p>W: {Math.round(cropRect.width)}, H: {Math.round(cropRect.height)}</p>
                            </div>
                        )}
                        <button onClick={handleApplyCrop} disabled={!cropRect || cropRect.width <= 1 || cropRect.height <= 1 || isLoading} 
                                className="w-full p-2 text-sm bg-teal-500 text-white rounded hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed">
                            Apply Crop
                        </button>
                         <button onClick={() => { setCropRect(null); setActiveTool('select');}} 
                                className="mt-2 w-full p-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded">
                            Cancel Crop
                        </button>
                    </>
                )}

                {activeRightSidebarTab === 'drawing' && (
                    <>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Drawing Tools</h4>
                        {(activeTool === 'draw' || activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'text') && (
                             <div className="mb-3">
                                <label htmlFor="drawColor" className="text-xs font-medium text-gray-600 mr-2 mb-1 block">Color:</label>
                                <div className="flex items-center">
                                    <input type="color" id="drawColor" value={drawColor} onChange={e => setDrawColor(e.target.value)} className="w-8 h-8 border border-gray-300 rounded cursor-pointer"/>
                                    <span className="ml-2 text-xs p-1 bg-gray-100 border rounded">{drawColor}</span>
                                </div>
                            </div>
                        )}
                        {(activeTool === 'draw' || activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle') && (
                            <div className="mb-3">
                                <label htmlFor="drawingLineWidth" className="flex justify-between text-xs font-medium text-gray-600 mb-0.5">
                                    <span>Brush Size</span><span>{drawingLineWidth}px</span>
                                </label>
                                <input type="range" id="drawingLineWidth" min="1" max="50" step="1" value={drawingLineWidth}
                                    onChange={e => setDrawingLineWidth(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-teal-600"/>
                            </div>
                        )}
                         {activeTool === 'text' && ( // Font size for text tool, using drawingLineWidth for simplicity
                            <div className="mb-3">
                                <label htmlFor="textFontSize" className="flex justify-between text-xs font-medium text-gray-600 mb-0.5">
                                    <span>Font Size</span><span>{drawingLineWidth * 5 + 10}px</span>
                                </label>
                                <input type="range" id="textFontSize" min="1" max="20" step="1" value={drawingLineWidth} // Max 100px font effectively
                                    onChange={e => setDrawingLineWidth(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-teal-600"/>
                            </div>
                        )}
                        {activeTool === 'eraser' && (
                            <div className="mb-3">
                                <label htmlFor="eraserLineWidth" className="flex justify-between text-xs font-medium text-gray-600 mb-0.5">
                                   <span>Eraser Size</span><span>{eraserLineWidth}px</span>
                                </label>
                                <input type="range" id="eraserLineWidth" min="5" max="100" step="1" value={eraserLineWidth}
                                    onChange={e => setEraserLineWidth(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-teal-600"/>
                            </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2">Select a drawing tool from the left toolbar to activate its options here.</p>
                        {/* Clear Drawings button is now global on left toolbar */}
                    </>
                )}
            </div>
        </div>
      </div>

      {showResizeModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30 p-4">
            <div className="bg-white p-5 rounded-lg shadow-xl w-full max-w-xs">
                <h3 className="text-lg font-semibold mb-3">Resize Image</h3>
                <div className="mb-2.5">
                    <label htmlFor="resizeWidth" className="text-sm font-medium text-gray-700 block mb-0.5">Width (px):</label>
                    <input type="number" id="resizeWidth" value={resizeDimensions.width} 
                           onChange={e => setResizeDimensions(d => ({...d, width: parseInt(e.target.value) || 0}))} 
                           className="w-full p-1.5 border border-gray-300 rounded text-sm"/>
                </div>
                <div className="mb-3">
                    <label htmlFor="resizeHeight" className="text-sm font-medium text-gray-700 block mb-0.5">Height (px):</label>
                    <input type="number" id="resizeHeight" value={resizeDimensions.height}
                           onChange={e => setResizeDimensions(d => ({...d, height: parseInt(e.target.value) || 0}))} 
                           className="w-full p-1.5 border border-gray-300 rounded text-sm"/>
                </div>
                <div className="flex justify-end space-x-2">
                    <button onClick={() => setShowResizeModal(false)} className="px-3 py-1.5 text-sm bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                    <button onClick={handleApplyResize} className="px-3 py-1.5 text-sm bg-teal-500 text-white rounded hover:bg-teal-600 disabled:isLoading" disabled={isLoading}>Apply Resize</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}