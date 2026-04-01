import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, File, X, CheckCircle2, AlertCircle, Loader2, FileText, Image as ImageIcon, Music, Video, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  type: string;
  error?: string;
}

export default function App() {
  const [userName, setUserName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'completed' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelection = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    const file = newFiles[0];

    // Check if file is a ZIP
    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('Bitte lade nur ZIP-Dateien hoch.');
      return;
    }

    setSelectedFile(file);
    setUploadStatus('idle');
    setErrorMessage(null);
    setProgress(0);
  };

  const sendDesign = async () => {
    if (!selectedFile) return;
    if (!userName.trim()) {
      alert('Bitte gib deinen Namen ein.');
      return;
    }

    setUploadStatus('uploading');
    setErrorMessage(null);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('userName', userName);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload fehlgeschlagen');
      }

      const result = await response.json();
      console.log('Upload success:', result);

      setProgress(100);
      setUploadStatus('completed');

      // Scroll to top after success
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Reset after a few seconds
      setTimeout(() => {
        setSelectedFile(null);
        setUploadStatus('idle');
        setProgress(0);
        setUserName('');
      }, 5000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten');
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelection(e.dataTransfer.files);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-sans text-[#1A1A1A] p-4 md:p-8 lg:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-12">
          <h1 className="text-4xl font-light tracking-tight mb-2">Design Upload</h1>
          <p className="text-gray-500 font-light">Lade dein Vasen-Design als ZIP-Datei hoch.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Zone */}
          <div className="lg:col-span-2 space-y-6">
            {/* Name Input */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <label htmlFor="userName" className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Dein Name
              </label>
              <input
                type="text"
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Vorname Nachname"
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            {!selectedFile || uploadStatus === 'completed' ? (
              <motion.div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative h-80 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300
                  ${isDragging ? 'border-blue-500 bg-blue-50/50 scale-[1.02]' : 'border-gray-300 bg-white hover:border-gray-400'}
                `}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <input
                  type="file"
                  accept=".zip"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={(e) => handleFileSelection(e.target.files)}
                />
                
                {uploadStatus === 'completed' ? (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-xl font-medium mb-1 text-green-600">Erfolgreich gesendet!</h3>
                    <p className="text-gray-400 text-sm">Dein Design ist auf dem Weg.</p>
                  </motion.div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                      <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-600' : 'text-blue-500'}`} />
                    </div>
                    <h3 className="text-xl font-medium mb-1">ZIP-Datei hierher ziehen</h3>
                    <p className="text-gray-400 text-sm">oder klicken zum Auswählen</p>
                  </>
                )}
                
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Nur .ZIP</span>
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Vasen Design</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center shrink-0">
                    <File className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{selectedFile.name}</h3>
                    <p className="text-xs text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {uploadStatus === 'uploading' ? (
                  <div className="space-y-4">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-center text-sm text-gray-400 animate-pulse">Wird gesendet...</p>
                  </div>
                ) : (
                  <button
                    onClick={sendDesign}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    Design Senden
                  </button>
                )}

                {uploadStatus === 'error' && (
                  <p className="text-red-500 text-sm text-center mt-4 flex flex-col items-center justify-center gap-2">
                    <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Fehler beim Senden</span>
                    <span className="text-xs opacity-70">{errorMessage}</span>
                  </p>
                )}
              </motion.div>
            )}
          </div>

          {/* Sidebar / Stats */}
          <div className="space-y-8">
            <div className="bg-[#1A1A1A] text-white rounded-3xl p-6 shadow-xl">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Anforderungen</h3>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-[10px] font-bold">1</div>
                  <p className="text-xs text-gray-300 leading-relaxed">Bitte nur ZIP-Dateien hochladen.</p>
                </li>
                <li className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-[10px] font-bold">2</div>
                  <p className="text-xs text-gray-300 leading-relaxed">Die Datei sollte alle relevanten STL-Daten für die Vase enthalten.</p>
                </li>
                <li className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-[10px] font-bold">3</div>
                  <p className="text-xs text-gray-300 leading-relaxed">Nach dem Klick auf "Senden" wird dein Design direkt an uns übertragen.</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
