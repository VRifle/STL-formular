import React, { useState, useRef } from 'react';
import { Upload, Printer, CheckCircle2, AlertCircle, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.toLowerCase().endsWith('.stl')) {
        setFile(selectedFile);
        setErrorMessage('');
      } else {
        setErrorMessage('Bitte laden Sie nur .stl Dateien hoch.');
        setFile(null);
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      setErrorMessage('Bitte füllen Sie alle Pflichtfelder aus.');
      return;
    }

    if (!file) {
      setErrorMessage('Bitte wählen Sie eine STL-Datei aus.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    const data = new FormData();
    data.append('name', formData.name);
    data.append('email', formData.email);
    if (file) {
      data.append('file', file);
    }

    try {
      console.log('Sende Daten an:', `${window.location.origin}/api/contact`);
      const response = await fetch('/api/contact', {
        method: 'POST',
        body: data,
      });

      const result = await response.json();

      if (response.ok) {
        setStatus('success');
        setFormData({ name: '', email: '' });
        setFile(null);
      } else {
        setStatus('error');
        setErrorMessage(result.error || `Server-Fehler: ${response.status}`);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setStatus('error');
      const msg = error instanceof Error ? error.message : 'Unbekannter Netzwerkfehler';
      setErrorMessage(`Verbindung zum Server fehlgeschlagen: ${msg}. Bitte prüfen Sie Ihre Internetverbindung oder verkleinern Sie die Datei.`);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4 font-sans text-[#1a1a1a]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden"
      >
        <div className="p-8 md:p-12">
          <header className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Design-Upload</h1>
            <p className="text-muted-foreground text-sm">Lade deine soeben gespeicherte Datei hier hoch</p>
          </header>

          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="text-2xl font-medium mb-2">STL gesendet!</h2>
                <p className="text-muted-foreground mb-8">Vielen Dank für Ihren Upload. Wir melden uns in Kürze bei Ihnen.</p>
                <button 
                  onClick={() => setStatus('idle')}
                  className="px-6 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-black/80 transition-colors"
                >
                  Neuer Upload
                </button>
              </motion.div>
            ) : (
              <motion.form 
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit} 
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-xl bg-[#f9f9f9] border border-transparent focus:bg-white focus:border-black/10 transition-all outline-none text-sm"
                      placeholder="Ihr Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-xl bg-[#f9f9f9] border border-transparent focus:bg-white focus:border-black/10 transition-all outline-none text-sm"
                      placeholder="ihre@email.de"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    STL Datei <span className="text-red-500">*</span>
                  </label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${file ? 'border-emerald-200 bg-emerald-50/30' : 'border-black/5 bg-[#f9f9f9] hover:bg-[#f0f0f0]'}`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".stl"
                      className="hidden"
                    />
                    
                    {file ? (
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-emerald-500">
                          <FileText size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeFile(); }}
                          className="p-2 hover:bg-black/5 rounded-full transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-muted-foreground">
                          <Upload size={20} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">Datei auswählen oder hierher ziehen</p>
                          <p className="text-xs text-muted-foreground mt-1">Nur .stl Dateien bis 50MB</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {errorMessage && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl"
                  >
                    <AlertCircle size={16} />
                    <span>{errorMessage}</span>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-medium transition-all ${status === 'loading' ? 'bg-black/20 cursor-not-allowed' : 'bg-black text-white hover:bg-black/80 shadow-lg shadow-black/10'}`}
                >
                  {status === 'loading' ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Printer size={18} />
                      <span>STL senden</span>
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
