'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
// Simple unique ID generator (though not used extensively in minimized version)
// const generateId = () => `_${Math.random().toString(36).substr(2, 9)}`;

import {
  FiCrop, FiMaximize, FiZoomIn, FiZoomOut,
  FiMousePointer, FiX, FiCornerUpLeft, FiCornerUpRight, FiTrash2, FiRotateCcw, FiRotateCw,
  FiSliders, FiFilter, FiSave, FiDownloadCloud, FiRefreshCcw, FiImage // Added Image icon for placeholder
} from 'react-icons/fi';

const initialFilters = {
  brightness: 100, contrast: 100, saturate: 100,
  grayscale: 0, sepia: 0, blur: 0,
};

const PRESET_FILTERS = {
  'Original': { ...initialFilters },
  'Vintage': { brightness: 95, contrast: 115, saturate: 80, sepia: 40, grayscale: 0, blur: 0.2 },
  'Black & White': { brightness: 100, contrast: 120, saturate: 0, sepia: 0, grayscale: 100, blur: 0 },
  'Cool Light': { brightness: 105, contrast: 95, saturate: 110, sepia: 0, grayscale: 0, blur: 0 },
  'Warm Glow': { brightness: 100, contrast: 105, saturate: 110, sepia: 15, grayscale: 0, blur: 0.1 },
};

const MAX_HISTORY_LENGTH = 20; // Reduced slightly for a simpler editor

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

  const [activeTool, setActiveTool] = useState('select');
  const [activeRightSidebarTab, setActiveRightSidebarTab] = useState('adjustments');

  const [cropRect, setCropRect] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStartPoint, setCropStartPoint] = useState(null);

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
    if (!fp || !electronApiReady || !window.electronAPI.pathExtname) return '';
    try {
      const ext = await window.electronAPI.pathExtname(fp);
      return ext;
    } catch (e) { console.error("Error getting file extension:", e); return ''; }
  };
  
  const resetImageState = (newImageDataUrl, recordHistory = true, fullReset = false) => {
    setFilters(initialFilters);
    setRotation(0);
    setFlip({ horizontal: false, vertical: false });
    setZoomLevel(1);
    setCropRect(null);
    setIsCropping(false);
    
    if (fullReset) {
        setActiveTool('select');
        setActiveRightSidebarTab('adjustments');
    } else if (activeTool === 'crop'){
        setActiveTool('select');
    }
    
    if (recordHistory && newImageDataUrl) {
        saveToHistory({ imageDataUrl: newImageDataUrl, filters: initialFilters, rotation: 0, flip: { horizontal: false, vertical: false } });
    }
  };

  const loadImage = useCallback(async (fp) => {
    if (!fp) { setOriginalImageDataUrl(null); setProcessedImageDataUrl(null); setError(''); return; }
    if (!electronApiReady) { setError('API not ready, cannot load image.'); return; }
    setIsLoading(true); setError('');
    try {
      const dataUrl = await window.electronAPI.readImageAsBase64(fp);
      const img = new Image();
      img.onload = () => {
        baseImageRef.current = img;
        setOriginalImageDataUrl(dataUrl); 
        setProcessedImageDataUrl(dataUrl); 
        resetImageState(dataUrl, true, true);
      };
      img.onerror = () => { setError('Failed to parse loaded image data.'); setOriginalImageDataUrl(null); setProcessedImageDataUrl(null); }
      img.src = dataUrl;
      setFilePath(fp);
    } catch (err) {
      console.error("Failed to load image:", err); setError(`Error loading image: ${err.message}`);
      setOriginalImageDataUrl(null); setProcessedImageDataUrl(null);
    } finally { setIsLoading(false); }
  }, [electronApiReady]); 

  useEffect(() => {
    if (initialFilePath && electronApiReady) { loadImage(initialFilePath); }
  }, [initialFilePath, loadImage, electronApiReady]);

  const saveToHistory = useCallback((stateSnapshot) => {
    setHistory(prevHistory => {
        const newHistory = prevHistory.slice(0, historyIndex + 1);
        newHistory.push(stateSnapshot);
        if (newHistory.length > MAX_HISTORY_LENGTH) { newHistory.shift(); }
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
        setHistoryIndex(index);
    }
    img.onerror = () => { console.error("Error loading image from history"); setError("Error restoring history state."); }
    img.src = state.imageDataUrl; 
  };

  const handleUndo = () => (historyIndex > 0) && applyHistoryState(historyIndex - 1);
  const handleRedo = () => (historyIndex < history.length - 1) && applyHistoryState(historyIndex + 1);

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: parseFloat(value) }));
  };

  const commitInstantChangeToHistory = useCallback(() => {
    saveToHistory({ imageDataUrl: processedImageDataUrl, filters, rotation, flip });
  }, [processedImageDataUrl, filters, rotation, flip, saveToHistory]);

  const handleRotate = (degrees) => {
    const newRotation = (rotation + degrees + 360) % 360;
    setRotation(newRotation);
    saveToHistory({ imageDataUrl: processedImageDataUrl, filters, rotation: newRotation, flip });
  };

  const handleFlip = (axis) => {
    const newFlip = { ...flip, [axis]: !flip[axis] };
    setFlip(newFlip);
    saveToHistory({ imageDataUrl: processedImageDataUrl, filters, rotation, flip: newFlip });
  };

  const handleZoom = (delta) => setZoomLevel(prev => Math.max(0.1, Math.min(prev + delta, 3))); // Max zoom reduced

  const drawCanvas = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !baseImageRef.current || !baseImageRef.current.complete || baseImageRef.current.naturalWidth === 0) {
        if(canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0,0, canvas.width, canvas.height); }
        return;
    }
    const ctx = canvas.getContext('2d');
    const img = baseImageRef.current;
    const displayWidth = img.naturalWidth * zoomLevel;
    const displayHeight = img.naturalHeight * zoomLevel;
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Background for canvas area
    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#374151' : '#e5e7eb'; // Tailwind gray-700 / gray-200
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
      grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px)
    `;
    try {
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
    } catch (e) {
      console.error("Error drawing image:", e); setError("Error displaying image."); ctx.restore(); return;
    }
    ctx.restore(); 

    if (activeTool === 'crop' && isCropping && cropRect) {
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)'; // Tailwind blue-500
        ctx.lineWidth = 1.5; 
        ctx.setLineDash([6, 6]); 
        ctx.strokeRect(cropRect.x * zoomLevel, cropRect.y * zoomLevel, cropRect.width * zoomLevel, cropRect.height * zoomLevel);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(cropRect.x * zoomLevel, cropRect.y * zoomLevel, cropRect.width * zoomLevel, cropRect.height * zoomLevel);
        ctx.restore();
    }
  }, [processedImageDataUrl, filters, rotation, flip, zoomLevel, activeTool, isCropping, cropRect]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  useEffect(() => {
    if (activeTool === 'crop') {
      setActiveRightSidebarTab('crop');
    } else if (activeTool === 'select') {
      if (activeRightSidebarTab !== 'filters' && activeRightSidebarTab !== 'adjustments') {
          setActiveRightSidebarTab('adjustments');
      }
    }
  }, [activeTool, activeRightSidebarTab]);

  const handleRightSidebarTabChange = (tabName) => {
    setActiveRightSidebarTab(tabName);
    if (tabName === 'crop') { setActiveTool('crop'); }
    else if (tabName === 'filters' || tabName === 'adjustments') {
      if (activeTool !== 'select') setActiveTool('select');
    }
  };

  const getMousePos = (e) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width) / zoomLevel,
      y: (e.clientY - rect.top) * (canvas.height / rect.height) / zoomLevel,
    };
  };

  const handleCanvasMouseDown = (e) => {
    if (!processedImageDataUrl || !baseImageRef.current.complete) return;
    const pos = getMousePos(e);
    if (activeTool === 'crop') {
        setIsCropping(true);
        setCropStartPoint(pos); 
        setCropRect({ x: pos.x, y: pos.y, width: 0, height: 0 }); 
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!isCropping || !cropStartPoint) return;
    const pos = getMousePos(e); 
    const newCropRect = {
        x: Math.min(pos.x, cropStartPoint.x),
        y: Math.min(pos.y, cropStartPoint.y),
        width: Math.abs(pos.x - cropStartPoint.x),
        height: Math.abs(pos.y - cropStartPoint.y),
    };
    setCropRect(newCropRect);
  };

  const handleCanvasMouseUp = () => {
    if (isCropping) { setIsCropping(false); }
  };

  const handleApplyOperation = async (operationFunc, successMessage) => {
    setIsLoading(true);
    try {
      const currentVisualDataUrl = await getFinalCanvasDataUrl(); 
      const newImageDataUrl = await operationFunc(currentVisualDataUrl); 
      if (newImageDataUrl) {
        const img = new Image();
        img.onload = () => {
          baseImageRef.current = img; 
          setProcessedImageDataUrl(newImageDataUrl); 
          resetImageState(newImageDataUrl, true); 
          setCropRect(null);
          console.log(successMessage);
        };
        img.onerror = () => { throw new Error("Failed to load processed image."); };
        img.src = newImageDataUrl;
      }
    } catch (err) {
      setError(`${operationFunc.name} Error: ${err.message}`); console.error(`${operationFunc.name} Error:`, err);
    } finally { setIsLoading(false); }
  };

  const performCrop = async (sourceDataUrl) => {
    if (!cropRect || cropRect.width <= 1 || cropRect.height <= 1) {
      setError("Invalid crop area."); return null; 
    }
    const imgToCrop = new Image();
    await new Promise((resolve, reject) => {
        imgToCrop.onload = resolve; imgToCrop.onerror = () => reject(new Error("Image load failed for crop"));
        imgToCrop.src = sourceDataUrl; 
    });
    const tempCanvas = hiddenCanvasRef.current || document.createElement('canvas');
    tempCanvas.width = Math.max(1, Math.round(cropRect.width));
    tempCanvas.height = Math.max(1, Math.round(cropRect.height));
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(imgToCrop, 
        Math.round(cropRect.x), Math.round(cropRect.y), Math.round(cropRect.width), Math.round(cropRect.height), 
        0, 0, tempCanvas.width, tempCanvas.height);
    return tempCanvas.toDataURL('image/png');
  };

  const handleApplyCrop = () => handleApplyOperation(performCrop, "Crop applied.");
  
  const getFinalCanvasDataUrl = useCallback(async () => {
    if (!processedImageDataUrl) throw new Error("No image data.");
    const finalImage = baseImageRef.current;
    if (!finalImage || !finalImage.complete || finalImage.naturalWidth === 0) {
        throw new Error("Base image not ready.");
    }
    const canvas = hiddenCanvasRef.current || document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let rad = rotation * Math.PI / 180;
    let absCos = Math.abs(Math.cos(rad)); let absSin = Math.abs(Math.sin(rad));
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
        grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px)
    `;
    ctx.drawImage(finalImage, 0, 0, finalImage.naturalWidth, finalImage.naturalHeight);
    ctx.restore(); 
    return canvas.toDataURL('image/png');
  }, [processedImageDataUrl, baseImageRef, filters, rotation, flip]);

  const handleSave = async () => {
    if (!filePath || !processedImageDataUrl || !electronApiReady) { setError(!electronApiReady ? 'API not ready.' : 'No image loaded.'); return; }
    setIsLoading(true); setError('');
    try {
      const finalDataUrl = await getFinalCanvasDataUrl();
      const result = await window.electronAPI.saveImageBase64(filePath, finalDataUrl);
      if (!result.success) { throw new Error(result.error || 'Failed to save.'); }
      console.log('Image saved!');
    } catch (err) { console.error("Save error:", err); setError(`Save error: ${err.message}`); }
    finally { setIsLoading(false); }
  };

  const handleSaveAs = async () => {
    if (!processedImageDataUrl || !electronApiReady) { setError(!electronApiReady ? 'API not ready.' : 'No image loaded.'); return; }
    setIsLoading(true); setError('');
    try {
      const finalDataUrlPng = await getFinalCanvasDataUrl(); 
      const currentBasename = filePath ? await window.electronAPI.pathBasename(filePath) : 'edited-image.png';
      const originalFileName = currentBasename.substring(0, currentBasename.lastIndexOf('.')) || currentBasename;
      const newFilePath = await window.electronAPI.showSaveDialog({
        title: 'Save Image As', defaultPath: `${originalFileName}-edited.png`,
        filters: [{ name: 'PNG Image', extensions: ['png'] }, { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }],
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
              tempCanvas.width = tempImg.naturalWidth; tempCanvas.height = tempImg.naturalHeight;
              const tempCtx = tempCanvas.getContext('2d');
              tempCtx.fillStyle = '#FFFFFF'; tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
              tempCtx.drawImage(tempImg, 0, 0);
              resolve(tempCanvas.toDataURL('image/jpeg', 0.9)); 
            };
            tempImg.onerror = (err) => reject(new Error("JPEG conversion failed: " + err));
            tempImg.src = finalDataUrlPng; 
          });
        }
        const result = await window.electronAPI.saveImageBase64(newFilePath, dataToSave);
        if (result.success) {
          const savedBasename = await window.electronAPI.pathBasename(newFilePath);
          console.log(`Image saved as ${savedBasename}`); setFilePath(newFilePath); setDisplayFileName(savedBasename); 
        } else { throw new Error(result.error || 'Failed to save.'); }
      }
    } catch (err) { console.error("Save As error:", err); setError(`Save As error: ${err.message}`); }
    finally { setIsLoading(false); }
  };

  const applyPresetFilter = (presetName) => {
    const preset = PRESET_FILTERS[presetName];
    if (preset) {
      const newFilters = { ...initialFilters, ...preset };
      setFilters(newFilters);
      commitInstantChangeToHistory();
    }
  };

  const resetCurrentFilterTab = () => {
    const filtersToReset = { grayscale: initialFilters.grayscale, sepia: initialFilters.sepia, blur: initialFilters.blur };
    const newFilters = {...filters, ...filtersToReset};
    setFilters(newFilters); commitInstantChangeToHistory();
  };

  const resetCurrentAdjustmentTab = () => {
    const adjustmentsToReset = { brightness: initialFilters.brightness, contrast: initialFilters.contrast, saturate: initialFilters.saturate };
    const newFilters = {...filters, ...adjustmentsToReset};
    setFilters(newFilters); commitInstantChangeToHistory();
  };

  const fullyResetImage = () => {
    if (originalImageDataUrl) {
      const img = new Image();
      img.onload = () => { baseImageRef.current = img; setProcessedImageDataUrl(originalImageDataUrl); resetImageState(originalImageDataUrl, true, true); }
      img.onerror = () => setError("Failed to reload original image for reset.");
      img.src = originalImageDataUrl;
    }
  };

  const renderToolButton = (toolName, IconComponent, label, action, isActiveForce = undefined, isActionButton = false) => (
    <button
      title={label}
      onClick={action ? action : () => setActiveTool(toolName)}
      disabled={isActionButton && isActiveForce}
      className={`p-2.5 rounded-md flex items-center justify-center hover:bg-neutral-500 [.dark_&]:hover:bg-neutral-600 hover:text-white [.dark_&]:hover:text-white transition-colors text-xl
                  ${(isActiveForce !== undefined && !isActionButton ? isActiveForce : activeTool === toolName && !isActionButton) 
                    ? 'bg-neutral-600 text-white [.dark_&]:bg-neutral-500 [.dark_&]:text-white' 
                    : 'bg-gray-200 text-gray-700 [.dark_&]:bg-neutral-700 [.dark_&]:text-neutral-200'}
                  ${(isActionButton && isActiveForce) ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isActionButton ? 'w-full' : ''}`}
    > <IconComponent /> </button>
  );

  const renderSidebarTabButton = (tabId, IconComponent, label) => (
    <button
        title={label} onClick={() => handleRightSidebarTabChange(tabId)}
        className={`flex-1 p-2.5 text-xs font-medium flex flex-col items-center justify-center border-b-2 hover:bg-neutral-50 [.dark_&]:hover:bg-neutral-700/50 transition-colors
                    ${activeRightSidebarTab === tabId 
                        ? 'border-neutral-500 text-neutral-600 [.dark_&]:text-neutral-400' 
                        : 'border-transparent text-gray-500 [.dark_&]:text-neutral-400 hover:text-neutral-500 [.dark_&]:hover:text-neutral-400'}`}
    > <IconComponent className="mb-0.5 h-4 w-4" /> {label} </button>
  );

  const renderSlider = (key, label, min, max, step, unit = '%') => (
    <div key={key} className="mb-3.5">
        <label htmlFor={key} className="flex justify-between text-xs font-medium text-gray-600 [.dark_&]:text-neutral-300 mb-1">
        <span className="capitalize">{label}</span><span>{parseFloat(filters[key]).toFixed(key === 'blur' ? 1 : 0)}{unit}</span>
        </label>
        <input type="range" id={key} name={key} min={min} max={max} 
        step={step} value={filters[key]}
        onChange={(e) => handleFilterChange(key, e.target.value)}
        onMouseUp={commitInstantChangeToHistory} onTouchEnd={commitInstantChangeToHistory}
        className="w-full h-2 bg-gray-200 [.dark_&]:bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-neutral-600 [.dark_&]:accent-neutral-500"/>
    </div>
  );

  if (!electronApiReady && !isLoading) { return <div className="p-4 text-red-600 [.dark_&]:text-red-400">Electron API not ready. Please restart.</div> }
  if (!originalImageDataUrl && !isLoading && !initialFilePath) { 
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 [.dark_&]:text-neutral-400 bg-gray-100 [.dark_&]:bg-neutral-800">
        <FiImage size={48} className="mb-4 opacity-50" />
        No image loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 [.dark_&]:bg-neutral-900 text-gray-800 [.dark_&]:text-neutral-200 relative select-none">
      <canvas ref={hiddenCanvasRef} style={{ display: 'none' }}></canvas>

      {/* Top Bar */}
      <div className="bg-gray-200 [.dark_&]:bg-neutral-800 text-white p-2 flex justify-between items-center shadow-md sticky top-0 z-20">
        <h1 className="text-lg font-semibold truncate pl-2" title={displayFileName || "Image Editor"}>
          Editor {displayFileName ? <span className="font-normal text-black [.dark_&]:text-neutral-300">- {displayFileName}</span> : ''}
        </h1>
        <div className="flex items-center space-x-1.5">
          {renderToolButton('undo_action', FiCornerUpLeft, 'Undo', handleUndo, historyIndex <= 0, true)}
          {renderToolButton('redo_action', FiCornerUpRight, 'Redo', handleRedo, historyIndex >= history.length - 1, true)}
          <button onClick={handleSave} disabled={!filePath || isLoading || !electronApiReady} className="px-3 py-1.5 text-sm font-medium text-white bg-neutral-500 [.dark_&]:bg-neutral-600 rounded-md hover:bg-neutral-600 [.dark_&]:hover:bg-neutral-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center"><FiSave className="mr-1.5"/>Save</button>
          <button onClick={handleSaveAs} disabled={!processedImageDataUrl || isLoading || !electronApiReady} className="px-3 py-1.5 text-sm font-medium text-white bg-neutral-500 [.dark_&]:bg-neutral-600 rounded-md hover:bg-neutral-600 [.dark_&]:hover:bg-neutral-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center"><FiDownloadCloud className="mr-1.5"/>Save As</button>
        </div>
      </div>

      {isLoading && ( <div className="absolute inset-0 flex items-center justify-center bg-white/75 [.dark_&]:bg-neutral-900/75 z-50"><div className="p-4 bg-white [.dark_&]:bg-neutral-700 rounded shadow-lg text-gray-700 [.dark_&]:text-neutral-200">Processing...</div></div> )}
      {error && ( <div onClick={() => setError('')} className="cursor-pointer m-2 p-2 text-sm text-red-700 bg-red-100 [.dark_&]:text-red-300 [.dark_&]:bg-red-900/80 border border-red-300 [.dark_&]:border-red-700 rounded text-center shadow absolute top-12 left-1/2 transform -translate-x-1/2 z-30 w-auto max-w-md">{error} <FiX className="inline ml-2"/></div> )}

      <div className="flex flex-1 p-2 space-x-2 overflow-hidden">
        {/* Left Toolbar */}
        <div className="w-16 bg-white [.dark_&]:bg-neutral-800 border border-gray-300 [.dark_&]:border-neutral-700 rounded-lg shadow-sm p-2 flex flex-col items-center space-y-2">
          {renderToolButton('select', FiMousePointer, 'Select / Pan')}
          {renderToolButton('crop', FiCrop, 'Crop Image')}
          <hr className="w-full border-gray-300 [.dark_&]:border-neutral-600 my-1" />
          <button
            title="Reset All Changes"
            onClick={fullyResetImage}
            disabled={!originalImageDataUrl || isLoading}
            className="p-2.5 rounded-md flex items-center justify-center hover:bg-red-500 [.dark_&]:hover:bg-red-600 hover:text-white [.dark_&]:hover:text-white transition-colors text-xl bg-gray-200 text-gray-700 [.dark_&]:bg-neutral-700 [.dark_&]:text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed w-full"
          > <FiRefreshCcw /> </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center bg-gray-200 [.dark_&]:bg-neutral-800/50 p-1 border border-gray-300 [.dark_&]:border-neutral-700 rounded-lg shadow-inner overflow-auto relative">
          {!processedImageDataUrl && !isLoading && <div className="text-gray-500 [.dark_&]:text-neutral-400">Loading...</div>}
          {processedImageDataUrl && 
            <canvas
              ref={previewCanvasRef}
              onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}
              className="max-w-full max-h-full object-contain shadow-lg"
              style={{ cursor: activeTool === 'select' ? 'grab' : 'crosshair'}}
            />
          }
        </div>

        {/* Right Sidebar */}
        <div className="w-64 bg-white [.dark_&]:bg-neutral-800 border border-gray-300 [.dark_&]:border-neutral-700 rounded-lg shadow-sm flex flex-col">
            <div className="flex border-b border-gray-200 [.dark_&]:border-neutral-700">
                {renderSidebarTabButton('filters', FiFilter, 'Filters')}
                {renderSidebarTabButton('adjustments', FiSliders, 'Adjust')}
                {renderSidebarTabButton('crop', FiCrop, 'Crop')}
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 [.dark_&]:scrollbar-thumb-neutral-600 scrollbar-track-transparent p-3.5 space-y-4">
                {activeRightSidebarTab === 'filters' && (
                    <>
                        <h4 className="text-sm font-semibold text-gray-700 [.dark_&]:text-neutral-200 mb-2">Presets</h4>
                        <div className="grid grid-cols-2 gap-2 mb-3.5">
                            {Object.keys(PRESET_FILTERS).map(name => (
                                <button key={name} onClick={() => applyPresetFilter(name)}
                                className="p-1.5 text-xs bg-gray-100 [.dark_&]:bg-neutral-700 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-700 border border-gray-300 [.dark_&]:border-neutral-600 rounded text-gray-700 [.dark_&]:text-neutral-200 truncate">
                                    {name}
                                </button>
                            ))}
                        </div>
                        <hr className="[.dark_&]:border-neutral-600 my-3"/>
                        {renderSlider('sepia', 'Sepia', 0, 100, 1)}
                        {renderSlider('grayscale', 'Grayscale', 0, 100, 1)}
                        {renderSlider('blur', 'Blur', 0, 5, 0.1, 'px')} {/* Max blur reduced */}
                        <button onClick={resetCurrentFilterTab} className="mt-3 w-full p-1.5 text-xs bg-gray-200 [.dark_&]:bg-neutral-700 hover:bg-gray-300 [.dark_&]:hover:bg-neutral-600 rounded">Reset Filters</button>
                    </>
                )}
                {activeRightSidebarTab === 'adjustments' && (
                    <>
                        {renderSlider('brightness', 'Brightness', 50, 150, 1)} {/* Range adjusted */}
                        {renderSlider('contrast', 'Contrast', 50, 150, 1)}   {/* Range adjusted */}
                        {renderSlider('saturate', 'Saturation', 0, 200, 1)}
                         <hr className="[.dark_&]:border-neutral-600 my-3"/>
                        <h4 className="text-xs font-semibold text-gray-500 [.dark_&]:text-neutral-400 uppercase tracking-wider mb-2">Transform</h4>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <button onClick={() => handleRotate(-90)} className="p-2 text-xs bg-gray-100 [.dark_&]:bg-neutral-700 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-700 border [.dark_&]:border-neutral-600 rounded flex items-center justify-center"><FiRotateCcw className="mr-1"/> Left</button>
                            <button onClick={() => handleRotate(90)} className="p-2 text-xs bg-gray-100 [.dark_&]:bg-neutral-700 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-700 border [.dark_&]:border-neutral-600 rounded flex items-center justify-center"><FiRotateCw className="mr-1"/> Right</button>
                            <button onClick={() => handleFlip('horizontal')} className="p-2 text-xs bg-gray-100 [.dark_&]:bg-neutral-700 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-700 border [.dark_&]:border-neutral-600 rounded col-span-1">Flip H</button>
                            <button onClick={() => handleFlip('vertical')} className="p-2 text-xs bg-gray-100 [.dark_&]:bg-neutral-700 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-700 border [.dark_&]:border-neutral-600 rounded col-span-1">Flip V</button>
                        </div>
                         <label className="text-xs font-medium text-gray-600 [.dark_&]:text-neutral-300 mb-1 block">Zoom ({Math.round(zoomLevel*100)}%)</label>
                        <div className="flex items-center space-x-1.5">
                            <button onClick={() => handleZoom(-0.1)} className="p-1.5 bg-gray-200 [.dark_&]:bg-neutral-700 rounded hover:bg-gray-300 [.dark_&]:hover:bg-neutral-600"><FiZoomOut/></button>
                            <input type="range" min="0.1" max="3" step="0.05" value={zoomLevel} onChange={e => setZoomLevel(parseFloat(e.target.value))} className="w-full h-2 accent-neutral-600 [.dark_&]:accent-neutral-500 appearance-none bg-gray-200 [.dark_&]:bg-neutral-600 rounded-lg"/>
                            <button onClick={() => handleZoom(0.1)} className="p-1.5 bg-gray-200 [.dark_&]:bg-neutral-700 rounded hover:bg-gray-300 [.dark_&]:hover:bg-neutral-600"><FiZoomIn/></button>
                        </div>
                        <button onClick={resetCurrentAdjustmentTab} className="mt-4 w-full p-1.5 text-xs bg-gray-200 [.dark_&]:bg-neutral-700 hover:bg-gray-300 [.dark_&]:hover:bg-neutral-600 rounded">Reset Adjustments</button>
                    </>
                )}
                {activeRightSidebarTab === 'crop' && (
                    <>
                        <h4 className="text-sm font-semibold text-gray-700 [.dark_&]:text-neutral-200 mb-2">Crop Image</h4>
                        {!isCropping && !cropRect && <p className="text-xs text-gray-500 [.dark_&]:text-neutral-400">Click and drag on the image to select an area to crop.</p>}
                        {cropRect && (
                            <div className="text-xs text-gray-600 [.dark_&]:text-neutral-300 space-y-0.5 mb-2">
                                <p>X: {Math.round(cropRect.x)}, Y: {Math.round(cropRect.y)}</p>
                                <p>W: {Math.round(cropRect.width)}, H: {Math.round(cropRect.height)}</p>
                            </div>
                        )}
                        <button onClick={handleApplyCrop} disabled={!cropRect || cropRect.width <= 1 || cropRect.height <= 1 || isLoading} 
                                className="w-full p-2 text-sm bg-neutral-500 [.dark_&]:bg-neutral-600 text-white rounded hover:bg-neutral-600 [.dark_&]:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            Apply Crop
                        </button>
                         <button onClick={() => { setCropRect(null); setActiveTool('select');}} 
                                className="mt-2 w-full p-1.5 text-xs bg-gray-200 [.dark_&]:bg-neutral-700 hover:bg-gray-300 [.dark_&]:hover:bg-neutral-600 rounded">
                            Cancel
                        </button>
                    </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}