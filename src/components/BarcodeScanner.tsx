import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { XCircle, Camera, RefreshCw } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const startScanner = async () => {
    try {
      setError(null);
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        // Prefer back camera
        const backCamera = devices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('retro') ||
          device.label.toLowerCase().includes('posteriore')
        );
        const cameraId = backCamera ? backCamera.id : devices[0].id;

        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode("reader");
        }

        await html5QrCodeRef.current.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            stopScanner();
            onScan(decodedText);
          },
          (errorMessage) => {
            // Silently handle scan errors (they happen every frame if no code found)
          }
        );
        setIsScanning(true);
      } else {
        setError("Nessuna fotocamera trovata.");
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setError("Errore nell'accesso alla fotocamera. Assicurati di aver concesso i permessi.");
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Camera className="text-emerald-600" size={20} />
            <h3 className="font-bold text-lg">Scansiona Barcode</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <XCircle size={28} />
          </button>
        </div>

        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          <div id="reader" className="w-full h-full"></div>
          
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/60">
              <div className="bg-white p-6 rounded-2xl shadow-xl max-w-xs">
                <p className="text-red-600 font-medium mb-4 text-sm">{error}</p>
                <button 
                  onClick={startScanner}
                  className="flex items-center gap-2 mx-auto bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                >
                  <RefreshCw size={16} /> Riprova
                </button>
              </div>
            </div>
          )}

          {!isScanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white text-sm font-medium">Inizializzazione fotocamera...</p>
              </div>
            </div>
          )}
          
          {/* Scanning Overlay */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[150px] border-2 border-emerald-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-500 -translate-x-1 -translate-y-1"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-500 translate-x-1 -translate-y-1"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-500 -translate-x-1 translate-y-1"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-500 translate-x-1 translate-y-1"></div>
                <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500/50 animate-scan shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 bg-gray-50 text-center shrink-0">
          <p className="text-sm text-gray-600 font-medium">
            Posiziona il codice a barre all'interno del riquadro
          </p>
          <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-bold">
            Supporta EAN, UPC, Code 128 e altri
          </p>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        #reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
    </div>
  );
};
